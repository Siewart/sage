import * as path from "node:path";

import {
  DEFAULT_TABLE_ALIASES,
  normalizeTableName,
  resolveTableName,
  type SageLayout,
} from "./layout.js";

/**
 * Work out a dataset repository's layout from its file listing.
 *
 * This is deliberately a pure function over a list of paths: the shape of the
 * SAGE corpus on the Hub is not knowable from here, and inferring it at every
 * startup would be both slow and fragile. The probe runs once, prints what it
 * concluded and why, and writes a manifest to commit. Where it cannot decide,
 * it says so in `warnings` rather than guessing silently.
 *
 * It recognises the three shapes a dataset export realistically takes:
 *
 *   directory-per-match   `.../<match>/entities.parquet`
 *   table-per-directory   `.../<match>/entities/part-0.parquet`
 *   archive-per-match     `.../<match>/<match>.parquet.zip`
 *
 * and treats every path segment above the match as a facet — typically the
 * corpus (KotD IV vs. the May 2026 export) and the snapshot resolution.
 *
 * The archive shape is what the SAGE corpus actually ships: one zipped bundle
 * of a match's Parquet files per match, with only a hand-unpacked sample stored
 * as loose files. A probe that looked for loose Parquet alone would report a
 * two-match corpus out of several thousand, which is exactly the kind of
 * silent near-miss the warnings exist to catch.
 */

export interface ProbeInput {
  repo: string;
  revision?: string;
  /** Every file path in the repository, repo-relative, using `/`. */
  paths: readonly string[];
  tableAliases?: Record<string, string>;
}

export interface ProbeResult {
  layout: SageLayout;
  /** One entry per match found, for a quick sanity check. */
  sampleMatches: string[];
  matchCount: number;
  /** Table -> number of files, summed across matches. */
  tableFileCounts: Record<string, number>;
}

interface ParsedFile {
  path: string;
  directory: string;
  table: string;
  /** True when the table is a directory of shards rather than a single file. */
  sharded: boolean;
}

const PARQUET = /\.parquet$/i;
const PARQUET_ARCHIVE = /\.parquet\.zip$/i;

export function probeLayout(input: ProbeInput): ProbeResult {
  const aliases = input.tableAliases ?? DEFAULT_TABLE_ALIASES;
  const warnings: string[] = [];

  const archives = input.paths.filter((p) => PARQUET_ARCHIVE.test(p));

  const parsed: ParsedFile[] = [];
  for (const filePath of input.paths) {
    if (!PARQUET.test(filePath)) continue;
    const segments = filePath.split("/");
    const fileName = segments[segments.length - 1] as string;
    const stem = fileName.replace(PARQUET, "");

    // Shape A: the file itself names the table.
    const direct = resolveTableName(stem, aliases);
    if (direct) {
      parsed.push({
        path: filePath,
        directory: segments.slice(0, -1).join("/"),
        table: direct,
        sharded: false,
      });
      continue;
    }
    // Shape B: the parent directory names the table and the file is a shard.
    const parent = segments[segments.length - 2];
    const viaParent = parent ? resolveTableName(parent, aliases) : undefined;
    if (viaParent) {
      parsed.push({
        path: filePath,
        directory: segments.slice(0, -2).join("/"),
        table: viaParent,
        sharded: true,
      });
    }
  }

  if (parsed.length === 0 && archives.length === 0) {
    throw new Error(
      `No Parquet files or .parquet.zip archives in ${input.repo} matched a ` +
        `known SAGE table name (${Object.keys(aliases).join(", ")}). Pass ` +
        `tableAliases, or write the manifest by hand.`,
    );
  }

  const byDirectory = new Map<string, ParsedFile[]>();
  for (const file of parsed) {
    const list = byDirectory.get(file.directory);
    if (list) list.push(file);
    else byDirectory.set(file.directory, [file]);
  }
  const archiveDirectories = new Set(
    archives.map((p) => p.split("/").slice(0, -1).join("/")),
  );
  for (const directory of archiveDirectories) {
    if (!byDirectory.has(directory)) byDirectory.set(directory, []);
  }

  const directories = [...byDirectory.keys()].sort();
  const depths = new Set(directories.map((d) => d.split("/").length));
  if (depths.size > 1) {
    warnings.push(
      `Match directories sit at different depths (${[...depths].sort().join(", ")} ` +
        `segments). The template uses the most common depth; check the others.`,
    );
  }

  const { template: directoryTemplate, facets } = inferDirectoryTemplate(
    directories,
    warnings,
  );

  const sharded = [
    ...new Set(parsed.filter((f) => f.sharded).map((f) => f.table)),
  ].sort();
  const anySharded = sharded.length > 0;
  if (
    anySharded &&
    sharded.length !== new Set(parsed.map((f) => f.table)).size
  ) {
    warnings.push(
      `Some tables are sharded (${sharded.join(", ")}) and others are single ` +
        `files. One template cannot express both; the sharded ones need a ` +
        `hand-written template.`,
    );
  }

  const template = anySharded
    ? `${directoryTemplate}/{table}/*.parquet`
    : `${directoryTemplate}/{table}.parquet`;

  const archiveTemplate = inferArchiveTemplate(
    archives,
    directoryTemplate,
    archiveDirectories.size,
    directories.length,
    warnings,
  );

  // Remember the stem each table is actually stored under. Aliases only map
  // stem -> table; going back the other way needs the original spelling, or
  // `researchStates` fills `{table}` and asks the Hub for a file that is
  // really called `research-states.parquet`.
  const tableStems: Record<string, string> = {};
  for (const file of parsed) {
    const segments = file.path.split("/");
    const stem = (
      file.sharded
        ? (segments[segments.length - 2] as string)
        : (segments[segments.length - 1] as string)
    ).replace(PARQUET, "");
    tableStems[file.table] = stem;
  }

  const tableFileCounts: Record<string, number> = {};
  for (const file of parsed) {
    tableFileCounts[file.table] = (tableFileCounts[file.table] ?? 0) + 1;
  }

  const expected = new Set(Object.values(aliases));
  const found = new Set(Object.keys(tableFileCounts));
  const missing = [...expected].filter((t) => !found.has(t));
  // Nothing is missing when the tables live inside archives; which tables an
  // archive holds is only knowable once one is unpacked.
  if (missing.length > 0 && !archiveTemplate) {
    warnings.push(`No files found for table(s): ${missing.join(", ")}.`);
  }

  const metadataTemplate = findMetadataTemplate(
    input.paths,
    directoryTemplate,
    warnings,
  );

  const layout: SageLayout = {
    repo: input.repo,
    revision: input.revision ?? "main",
    template,
    facets,
    defaultFacets: Object.fromEntries(
      Object.entries(facets).map(([key, values]) => [key, values[0] as string]),
    ),
    tableAliases: aliases,
    tableStems,
    ...(archiveTemplate
      ? { archiveTemplate, archiveKind: "zip" as const }
      : { archiveKind: "none" as const }),
    metadataKind: metadataTemplate ? "descriptor" : "none",
    ...(metadataTemplate ? { metadataTemplate } : {}),
    shardedTables: sharded,
    warnings,
  };

  return {
    layout,
    sampleMatches: directories.slice(0, 5),
    matchCount: directories.length,
    tableFileCounts,
  };
}

/**
 * Split the directories holding matches into fixed text, facets and the match
 * id. A segment position whose values repeat across many directories is a
 * facet; the deepest varying position is the match itself.
 */
function inferDirectoryTemplate(
  directories: readonly string[],
  warnings: string[],
): { template: string; facets: Record<string, string[]> } {
  const split = directories.map((d) => d.split("/"));
  const depth = mode(split.map((s) => s.length));
  const atDepth = split.filter((s) => s.length === depth);

  const parts: string[] = [];
  const facets: Record<string, string[]> = {};
  let facetIndex = 0;

  for (let position = 0; position < depth; position++) {
    const values = [...new Set(atDepth.map((s) => s[position] as string))];
    const isLast = position === depth - 1;

    if (isLast) {
      parts.push("{match}");
      continue;
    }
    if (values.length === 1) {
      parts.push(values[0] as string);
      continue;
    }
    // A handful of repeated values is a facet; many distinct values this high
    // up means the match id spans more than one segment.
    if (values.length <= Math.max(8, atDepth.length / 20)) {
      const name = facetName(values, facetIndex++);
      facets[name] = values.sort();
      parts.push(`{${name}}`);
    } else {
      warnings.push(
        `Path segment ${position} has ${values.length} distinct values; ` +
          `treating it as part of the match id.`,
      );
      parts.push("{match}");
    }
  }

  // Collapse a match id that spans several segments into one placeholder.
  const template = parts
    .join("/")
    .replace(/\{match\}(\/\{match\})+/g, "{match}");
  return { template, facets };
}

/** Name a facet after what its values look like, falling back to `facet<N>`. */
function facetName(values: readonly string[], index: number): string {
  const normalized = values.map((v) => normalizeTableName(v));
  // `1s` / `60s`, and the bare-millisecond spelling the SAGE corpus uses
  // (`1000`, `60000`) — a segment whose values are all numeric is a sampling
  // interval, not a corpus name.
  if (normalized.every((v) => /^\d+(s|sec|second|seconds|ms)?$/.test(v))) {
    return "resolution";
  }
  if (normalized.some((v) => v.includes("kotd") || v.includes("corpus"))) {
    return "corpus";
  }
  return index === 0 ? "corpus" : `facet${index}`;
}

/**
 * The archive path template, when matches ship as one archive each.
 *
 * The archive is expected to sit in the match directory. Its own name is not
 * assumed: it is read off the listing, and only a name that is either constant
 * or exactly the match directory's name can be templated.
 */
function inferArchiveTemplate(
  archives: readonly string[],
  directoryTemplate: string,
  archiveDirectoryCount: number,
  directoryCount: number,
  warnings: string[],
): string | undefined {
  if (archives.length === 0) return undefined;

  const names = archives.map((p) => p.split("/").slice(-1)[0] as string);
  const directories = archives.map(
    (p) => p.split("/").slice(-2, -1)[0] as string,
  );
  const namedAfterDirectory = archives.every(
    (_, index) => names[index] === `${directories[index]}.parquet.zip`,
  );
  const constantName = new Set(names).size === 1;

  if (!namedAfterDirectory && !constantName) {
    warnings.push(
      `Found ${archives.length} .parquet.zip archives but their names follow ` +
        `no pattern this can template; set archiveTemplate by hand.`,
    );
    return undefined;
  }

  if (archiveDirectoryCount < directoryCount) {
    warnings.push(
      `${archiveDirectoryCount} of ${directoryCount} match directories hold a ` +
        `.parquet.zip archive; the rest hold loose Parquet files. Both shapes ` +
        `are read — the archive is tried first, loose files second.`,
    );
  }

  return namedAfterDirectory
    ? `${directoryTemplate}/{match}.parquet.zip`
    : `${directoryTemplate}/${names[0] as string}`;
}

function findMetadataTemplate(
  paths: readonly string[],
  directoryTemplate: string,
  warnings: string[],
): string | undefined {
  const jsonNames = new Set(
    paths
      .filter((p) => p.toLowerCase().endsWith(".json"))
      .map((p) => path.posix.basename(p)),
  );
  for (const candidate of ["descriptor.json", "metadata.json", "match.json"]) {
    if (jsonNames.has(candidate)) return `${directoryTemplate}/${candidate}`;
  }
  warnings.push(
    "No per-match descriptor JSON found. Snapshot-window bounds (binTimes) " +
      "must come from somewhere: set metadataTemplate by hand, or the DuckDB " +
      "backend cannot map a game time to a bin.",
  );
  return undefined;
}

function mode(values: readonly number[]): number {
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  let best = values[0] as number;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}
