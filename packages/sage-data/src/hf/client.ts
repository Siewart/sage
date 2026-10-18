import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { listFiles } from "@huggingface/hub";

import { DuckDbQuery } from "../duckdb/query.js";
import { tableFilesFrom } from "../duckdb/open.js";
import { SyncDuckDb } from "../duckdb/sync-client.js";
import { quoteString } from "../duckdb/sql.js";
import type { BinTime, Row } from "../types.js";
import { extractZip } from "../zip.js";
import { downloadToFile, isCompleteDownload } from "../download.js";
import { zipExtractedBytes } from "../zip-metadata.js";
import { createHash } from "node:crypto";
import {
  fillTemplate,
  layoutSchema,
  resolveTableName,
  SAGE_TABLES,
  tableStem,
  templatePlaceholders,
  templateToRegExp,
  type SageLayout,
} from "./layout.js";

/**
 * Reading the SAGE corpus from Hugging Face.
 *
 * Files are fetched through the Hub API and cached on disk; DuckDB then reads
 * the cached Parquet. Downloading rather than querying over HTTP keeps repeated
 * runs cheap and keeps the DuckDB side free of the `httpfs` extension.
 *
 * Most of the corpus ships one zipped bundle of Parquet files per match rather
 * than loose files, so a match is normally one download that is unpacked into
 * the cache; loose per-table files are the fallback for the parts that have
 * them.
 */

export interface HuggingFaceOptions {
  /** Hub access token, for private or gated repositories. */
  accessToken?: string | undefined;
  /** Cache root; defaults to `$SAGE_HF_CACHE`, else `~/.cache/sage-hf`. */
  cacheDir?: string | undefined;
  onProgress?: ((message: string) => void) | undefined;
  signal?: AbortSignal | undefined;
  onBytes?: ((received: number, total?: number) => void) | undefined;
}

export interface MatchRef {
  /** Facet values identifying which corpus and resolution this match is from. */
  facets: Record<string, string>;
  /** Match id as it appears in the repository path. */
  match: string;
}

/** A path in the POSIX spelling DuckDB's glob and file arguments expect. */
export function posixPath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

export function defaultCacheDir(): string {
  return (
    process.env["SAGE_DATA_DIR"] ??
    process.env["SAGE_HF_CACHE"] ??
    path.join(os.homedir(), ".cache", "sage")
  );
}

export function loadLayout(manifestPath: string): SageLayout {
  return layoutSchema.parse(
    JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as unknown,
  );
}

export function saveLayout(manifestPath: string, layout: SageLayout): void {
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, `${JSON.stringify(layout, null, 2)}\n`);
}

export interface RepoFile {
  path: string;
  size?: number;
}
/** Metadata is pinned and cached independently of downloads. Old path-only caches work offline. */
export async function listRepoEntries(
  repo: string,
  options: HuggingFaceOptions & { revision?: string | undefined } = {},
): Promise<RepoFile[]> {
  const root = options.cacheDir ?? defaultCacheDir();
  const key = createHash("sha256")
    .update(repo + ":" + (options.revision ?? "main"))
    .digest("hex");
  const cached = path.join(root, "indexes", key + ".files.json"),
    old = path.join(root, "indexes", key + ".json");
  if (/^[a-f0-9]{40}$/.test(options.revision ?? "") && fs.existsSync(cached))
    return JSON.parse(fs.readFileSync(cached, "utf8"));
  const files: RepoFile[] = [];
  try {
    for await (const entry of listFiles({
      repo: { type: "dataset", name: repo },
      revision: options.revision ?? "main",
      recursive: true,
      fetch: (url, init) =>
        fetch(url, {
          ...init,
          signal: options.signal
            ? AbortSignal.any([options.signal, AbortSignal.timeout(30000)])
            : AbortSignal.timeout(30000),
        }),
      ...(options.accessToken ? { accessToken: options.accessToken } : {}),
    })) {
      options.signal?.throwIfAborted();
      if (entry.type === "file")
        files.push({ path: entry.path, size: entry.lfs?.size ?? entry.size });
    }
  } catch (error) {
    options.signal?.throwIfAborted();
    if (fs.existsSync(old))
      return (JSON.parse(fs.readFileSync(old, "utf8")) as string[]).map(
        (path) => ({ path }),
      );
    throw error;
  }
  fs.mkdirSync(path.dirname(cached), { recursive: true });
  fs.writeFileSync(cached, JSON.stringify(files));
  fs.writeFileSync(old, JSON.stringify(files.map((file) => file.path)));
  return files;
}
/** Every file path, preserving the CLI's existing contract. */
export async function listRepoFiles(
  repo: string,
  options: HuggingFaceOptions & { revision?: string | undefined } = {},
): Promise<string[]> {
  return (await listRepoEntries(repo, options)).map((file) => file.path);
}

export interface MatchSpace {
  downloadBytes?: number;
  diskBytes?: number;
  additionalDiskBytes?: number;
}
export function repoFileUrl(layout: SageLayout, repoPath: string) {
  return `https://huggingface.co/datasets/${layout.repo}/resolve/${layout.revision}/${repoPath.split("/").map(encodeURIComponent).join("/")}`;
}
export async function matchSpace(
  layout: SageLayout,
  ref: MatchRef,
  entries: readonly RepoFile[],
  options: HuggingFaceOptions = {},
): Promise<MatchSpace> {
  const values = facetValues(layout, ref),
    byPath = new Map(entries.map((file) => [file.path, file]));
  const archivePath = layout.archiveTemplate
    ? fillTemplate(layout.archiveTemplate, values)
    : undefined;
  const archive = archivePath ? byPath.get(archivePath) : undefined;
  const root = options.cacheDir ?? defaultCacheDir();
  if (archive && archive.size !== undefined) {
    const archiveFile = path.join(
      root,
      layout.repo,
      layout.revision,
      archive.path,
    );
    const metadataFile = archiveFile + ".space.json";
    let extracted: number | undefined;
    try {
      extracted = JSON.parse(
        fs.readFileSync(metadataFile, "utf8"),
      ).extractedBytes;
    } catch {
      /* first preview */
    }
    if (extracted === undefined) {
      const read = async (start: number, end: number) => {
        if (
          fs.existsSync(archiveFile) &&
          fs.statSync(archiveFile).size === archive.size
        ) {
          const fd = fs.openSync(archiveFile, "r");
          try {
            const bytes = Buffer.alloc(end - start + 1);
            const count = fs.readSync(fd, bytes, 0, bytes.length, start);
            return bytes.subarray(0, count);
          } finally {
            fs.closeSync(fd);
          }
        }
        const response = await fetch(repoFileUrl(layout, archive.path), {
          headers: {
            Range: `bytes=${start}-${end}`,
            ...(options.accessToken
              ? { Authorization: `Bearer ${options.accessToken}` }
              : {}),
          },
          signal: AbortSignal.timeout(10000),
        });
        if (response.status !== 206) {
          await response.body?.cancel();
          throw new Error("Archive size preview unavailable");
        }
        const reader = response.body!.getReader(),
          chunks: Uint8Array[] = [];
        let total = 0;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            total += value.length;
            if (total > end - start + 1)
              throw new Error("Oversized archive metadata");
            chunks.push(value);
          }
        } finally {
          await reader.cancel();
        }
        const result = new Uint8Array(total);
        let offset = 0;
        for (const chunk of chunks) {
          result.set(chunk, offset);
          offset += chunk.length;
        }
        return result;
      };
      try {
        extracted = await zipExtractedBytes(archive.size, read);
        if (extracted !== undefined) {
          fs.mkdirSync(path.dirname(metadataFile), { recursive: true });
          fs.writeFileSync(
            metadataFile,
            JSON.stringify({ extractedBytes: extracted }),
          );
        }
      } catch {
        /* transfer size remains useful when range previews fail */
      }
    }
    const complete = isCompleteDownload(
      archiveFile,
      repoFileUrl(layout, archive.path),
    );
    const diskBytes =
      extracted === undefined ? undefined : archive.size + extracted;
    const extractedComplete = fs.existsSync(
      path.join(path.dirname(archiveFile), "tables/.complete.json"),
    );
    return {
      downloadBytes: complete ? 0 : archive.size,
      ...(diskBytes === undefined
        ? {}
        : {
            diskBytes,
            additionalDiskBytes: Math.max(
              0,
              diskBytes -
                (complete ? archive.size : 0) -
                (extractedComplete ? extracted! : 0),
            ),
          }),
    };
  }
  const files = [
    ...SAGE_TABLES.map((table) =>
      fillTemplate(layout.template, {
        ...values,
        table: tableStem(layout, table),
      }),
    ),
    ...(layout.metadataTemplate
      ? [fillTemplate(layout.metadataTemplate, values)]
      : []),
  ].map((p) => byPath.get(p));
  if (files.some((file) => file?.size === undefined)) return {};
  const diskBytes = files.reduce((sum, file) => sum + file!.size!, 0);
  const needed = files.reduce(
    (sum, file) =>
      sum +
      (isCompleteDownload(
        path.join(root, layout.repo, layout.revision, file!.path),
        repoFileUrl(layout, file!.path),
      )
        ? 0
        : file!.size!),
    0,
  );
  return { downloadBytes: needed, diskBytes, additionalDiskBytes: needed };
}

/** Matches present in the repository, derived from a file listing and the layout. */
export function matchesFromPaths(
  layout: SageLayout,
  paths: readonly string[],
): MatchRef[] {
  // Both shapes count: a match present only as an archive is still a match.
  const patterns = [layout.template, layout.archiveTemplate]
    .filter((t): t is string => Boolean(t))
    .map((t) => templateToRegExp(t));
  const seen = new Map<string, MatchRef>();
  for (const filePath of paths) {
    for (const { pattern, keys } of patterns) {
      const result = pattern.exec(filePath);
      if (!result) continue;
      const values: Record<string, string> = {};
      keys.forEach((key, index) => {
        values[key] = result[index + 1] as string;
      });
      const match = values["match"];
      if (!match) continue;
      const facets = Object.fromEntries(
        Object.entries(values).filter(
          ([key]) => key !== "match" && key !== "table",
        ),
      );
      const id = `${Object.values(facets).join("/")}/${match}`;
      if (!seen.has(id)) seen.set(id, { facets, match });
      break;
    }
  }
  return [...seen.values()];
}

/** Download one repository file into the cache, returning its local path. */
export async function fetchFile(
  layout: SageLayout,
  repoPath: string,
  options: HuggingFaceOptions = {},
): Promise<string> {
  const local = await tryFetchFile(layout, repoPath, options);
  if (!local) throw new Error(`${repoPath} not found in ${layout.repo}`);
  return local;
}

/** As {@link fetchFile}, but `undefined` when the repository has no such file. */
export async function tryFetchFile(
  layout: SageLayout,
  repoPath: string,
  options: HuggingFaceOptions = {},
): Promise<string | undefined> {
  layout = await resolveLayout(layout, options);
  const root = path.resolve(options.cacheDir ?? defaultCacheDir());
  if (
    [layout.repo, layout.revision, repoPath].some(
      (value) => value.split(/[\\/]/).includes("..") || path.isAbsolute(value),
    )
  )
    throw new Error("Invalid dataset path");
  const local = path.resolve(root, layout.repo, layout.revision, repoPath);
  if (!local.startsWith(root + path.sep))
    throw new Error("Dataset path escapes cache");
  const url = `https://huggingface.co/datasets/${layout.repo}/resolve/${layout.revision}/${repoPath.split("/").map(encodeURIComponent).join("/")}`;
  if (isCompleteDownload(local, url)) return local;
  const result = await downloadToFile(url, local, options);
  if (result) options.onProgress?.(`downloaded ${repoPath}`);
  return result;
}

/**
 * Where an archive's contents are unpacked, beside the archive itself.
 *
 * Deliberately short and independent of the archive's own name: an archive is
 * named after the directory holding it, so appending to that name spelled the
 * match twice in one path. On Windows that reached 253 of the 260 characters
 * MAX_PATH allows before the user's home directory was even a long one.
 */
function unpackedDir(archivePath: string): string {
  return path.join(path.dirname(archivePath), "tables");
}

function facetValues(
  layout: SageLayout,
  ref: MatchRef,
): Record<string, string> {
  const values: Record<string, string> = {
    ...layout.defaultFacets,
    ...ref.facets,
    match: ref.match,
  };
  for (const key of templatePlaceholders(layout.template)) {
    if (key !== "table" && values[key] === undefined) {
      throw new Error(
        `No value for facet {${key}}; known facets: ${JSON.stringify(layout.facets)}`,
      );
    }
  }
  return values;
}

/**
 * Download a match's tables and open it in DuckDB.
 *
 * Snapshot-window bounds come from the match's descriptor when the layout has
 * one. Without them the pipeline cannot map a game time to a bin, so this
 * fails loudly rather than inventing bins.
 */
export async function openHuggingFaceMatch(
  layout: SageLayout,
  ref: MatchRef,
  options: HuggingFaceOptions = {},
): Promise<DuckDbQuery> {
  layout = await resolveLayout(layout, options);
  const values = facetValues(layout, ref);
  const { tables, descriptorPath } = await fetchMatchFiles(
    layout,
    values,
    options,
  );

  if (!descriptorPath) {
    throw new Error(
      `Layout for ${layout.repo} has no per-match descriptor, so snapshot ` +
        `window bounds are unknown. Set metadataTemplate in the manifest.`,
    );
  }
  const descriptor = JSON.parse(fs.readFileSync(descriptorPath, "utf-8")) as {
    name?: string;
    metadata?: { binTimes?: BinTime[] };
  };
  const binTimes = descriptor.metadata?.binTimes;
  if (!binTimes) {
    throw new Error(`${descriptorPath} has no metadata.binTimes`);
  }

  return new DuckDbQuery({
    name: descriptor.name ?? ref.match,
    files: tableFilesFrom(tables),
    binTimes,
  });
}

export interface MatchFiles {
  /** SAGE table name -> local Parquet path. */
  tables: Record<string, string>;
  /** Local path of the match descriptor, when the repository has one. */
  descriptorPath: string | undefined;
}

/**
 * Put a match's tables on local disk, whichever shape the repository stores.
 *
 * The archive is tried first where the manifest names one, because that is how
 * all but a handful of the corpus is stored; a match that has no archive falls
 * back to loose per-table files. An archive that carries its own descriptor
 * saves a second request for it.
 */
export async function fetchMatchFiles(
  layout: SageLayout,
  values: Readonly<Record<string, string>>,
  options: HuggingFaceOptions = {},
): Promise<MatchFiles> {
  layout = await resolveLayout(layout, options);
  const tables: Record<string, string> = {};
  let descriptorPath: string | undefined;

  if (layout.archiveTemplate && layout.archiveKind === "zip") {
    const repoPath = fillTemplate(layout.archiveTemplate, values);
    const archive = await tryFetchFile(layout, repoPath, options);
    if (archive) {
      const unpacked = await extractZip(
        archive,
        unpackedDir(archive),
        options.signal,
      );
      options.onProgress?.(`unpacked ${repoPath}`);
      for (const [name, filePath] of Object.entries(unpacked)) {
        if (name === "descriptor.json") descriptorPath = filePath;
        if (!name.toLowerCase().endsWith(".parquet")) continue;
        const table = resolveTableName(
          name.replace(/\.parquet$/i, ""),
          layout.tableAliases,
        );
        // An archive holds tables the pipeline does not read — `fow`,
        // `commands` — so an unrecognised name is expected, not a problem.
        if (table) tables[table] = filePath;
      }
      const missing = SAGE_TABLES.filter((table) => !tables[table]);
      if (missing.length > 0) {
        throw new Error(
          `${repoPath} has no file for table(s): ${missing.join(", ")}`,
        );
      }
    }
  }

  if (Object.keys(tables).length === 0) {
    for (const table of SAGE_TABLES) {
      const repoPath = fillTemplate(layout.template, {
        ...values,
        table: tableStem(layout, table),
      });
      if (repoPath.includes("*")) {
        throw new Error(
          `Table "${table}" is sharded (${repoPath}). Sharded tables need the ` +
            `file list resolved from a repository listing first.`,
        );
      }
      tables[table] = await fetchFile(layout, repoPath, options);
    }
  }

  if (
    !descriptorPath &&
    layout.metadataKind === "descriptor" &&
    layout.metadataTemplate
  ) {
    descriptorPath = await fetchFile(
      layout,
      fillTemplate(layout.metadataTemplate, values),
      options,
    );
  }

  return { tables, descriptorPath };
}

/**
 * Corpus-wide SQL over cached Parquet.
 *
 * The per-match `SageQuery` answers the pipeline's questions about one game.
 * This answers questions about the corpus — which matches to run at all — which
 * is what an agentic planner needs before it can pick content.
 */
export class SageCorpus {
  private readonly db: SyncDuckDb;

  constructor(private readonly cacheRoot: string = defaultCacheDir()) {
    this.db = new SyncDuckDb();
  }

  /**
   * Query one SAGE table across every cached match at once. `{table}` in the
   * SQL is replaced by a `read_parquet` over every cached copy of that table,
   * with `filename` exposed so rows can be traced back to a match.
   */
  queryTable(table: (typeof SAGE_TABLES)[number], sql: string): Row[] {
    // DuckDB's glob syntax is POSIX; `path.join` would emit backslashes on
    // Windows, which read_parquet reads as escapes rather than separators.
    const glob = posixPath(path.join(this.cacheRoot, "**", `${table}.parquet`));
    return this.db.query(
      sql.replace(
        /\{table\}/g,
        `read_parquet(${quoteString(glob)}, filename = true, union_by_name = true)`,
      ),
    );
  }

  /** Raw SQL; use `read_parquet` with paths under the cache root. */
  query(sql: string): Row[] {
    return this.db.query(sql);
  }

  close(): void {
    this.db.close();
  }
}

/** Pin symbolic revisions before caching so a later update never relabels old bytes. */
export async function resolveLayout(
  layout: SageLayout,
  options: HuggingFaceOptions = {},
): Promise<SageLayout> {
  if (/^[a-f0-9]{40}$/.test(layout.revision)) return layout;
  const key = createHash("sha256")
    .update(layout.repo + ":" + layout.revision)
    .digest("hex");
  const cached = path.join(
    options.cacheDir ?? defaultCacheDir(),
    "revisions",
    key + ".json",
  );
  try {
    const response = await fetch(
      `https://huggingface.co/api/datasets/${layout.repo}/revision/${encodeURIComponent(layout.revision)}?expand%5B%5D=sha`,
      {
        headers: options.accessToken
          ? { Authorization: `Bearer ${options.accessToken}` }
          : {},
        signal: options.signal ?? null,
      },
    );
    if (!response.ok)
      throw new Error(`Cannot resolve dataset revision (${response.status})`);
    const info = (await response.json()) as { sha?: string };
    if (!info.sha || !/^[a-f0-9]{40}$/.test(info.sha))
      throw new Error("Invalid dataset revision");
    const pinned = { ...layout, revision: info.sha };
    fs.mkdirSync(path.dirname(cached), { recursive: true });
    fs.writeFileSync(cached, JSON.stringify(pinned));
    return pinned;
  } catch (error) {
    options.signal?.throwIfAborted();
    if (fs.existsSync(cached)) {
      options.onProgress?.("Offline: using the last resolved dataset revision");
      return layoutSchema.parse(JSON.parse(fs.readFileSync(cached, "utf8")));
    }
    throw error;
  }
}
