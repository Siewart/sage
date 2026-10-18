import * as fs from "node:fs";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import * as aq from "arquero";

import { SyncDuckDb } from "./sync-client.js";
import { quoteString } from "./sql.js";

/**
 * Convert a match's Arrow files to Parquet.
 *
 * The Hugging Face corpus is Parquet, but the four matches committed under
 * `data/` are Arrow IPC, and DuckDB's Arrow reader ships as a loadable
 * extension rather than a built-in. Converting lets the parity check run both
 * backends over *identical* data, which is the only way a cross-backend diff
 * means anything — the Arrow files under `data/` and the Hugging Face corpus
 * are different vintages of the same matches (see `data/DATA.MD`).
 *
 * Newline-delimited JSON is the bridge: DuckDB's JSON reader is built in, and
 * scanning the whole file (`sample_size = -1`) gets nested columns like
 * `currentAction` and `attributesHeld` typed correctly.
 *
 * A descriptor that already names Parquet files — the shape the Hugging Face
 * corpus ships alongside its Arrow one — is passed through untouched.
 */
export interface ConvertOptions {
  /** Overwrite Parquet files that already exist. */
  force?: boolean | undefined;
  onProgress?: ((message: string) => void) | undefined;
}

const jsonReplacer = (_key: string, value: unknown) =>
  typeof value === "bigint" ? Number(value) : value;

export function arrowFileToParquet(
  arrowPath: string,
  parquetPath: string,
  options: ConvertOptions = {},
): string {
  // A descriptor may already name Parquet: the Hugging Face corpus ships one
  // descriptor per format, and the Parquet one points at Parquet files. There
  // is nothing to convert, and treating one as Arrow reads it as garbage.
  if (/\.parquet$/i.test(arrowPath)) return arrowPath;

  if (
    !options.force &&
    fs.existsSync(parquetPath) &&
    fs.statSync(parquetPath).mtimeMs >= fs.statSync(arrowPath).mtimeMs
  )
    return parquetPath;

  if (fs.statSync(arrowPath).size > 128 * 1024 * 1024) {
    throw new Error(
      "Large Arrow files require record-batch preparation: python scripts/prepare_arrow.py <descriptor> --output <directory>. HF Parquet needs no conversion.",
    );
  }
  fs.mkdirSync(path.dirname(parquetPath), { recursive: true });
  const table = aq.fromArrow(fs.readFileSync(arrowPath));
  const temporaryPath = `${parquetPath}.${randomUUID()}.partial`;
  const jsonPath = `${temporaryPath}.ndjson`;

  // Written with synchronous file descriptors: DuckDB reads the file in the
  // worker as soon as this returns, so a buffered stream would race it.
  const fd = fs.openSync(jsonPath, "w");
  try {
    const rows = table.objects() as Record<string, unknown>[];
    const CHUNK = 2000;
    for (let start = 0; start < rows.length; start += CHUNK) {
      const chunk = rows
        .slice(start, start + CHUNK)
        .map((row) => JSON.stringify(row, jsonReplacer))
        .join("\n");
      fs.writeSync(fd, chunk + "\n");
    }
  } finally {
    fs.closeSync(fd);
  }

  // An empty table would give DuckDB nothing to infer from; write an empty file.
  const db = new SyncDuckDb();
  try {
    db.exec(
      `COPY (SELECT * FROM read_json(${quoteString(jsonPath)}, ` +
        `format = 'newline_delimited', sample_size = -1, map_inference_threshold = -1)) ` +
        `TO ${quoteString(temporaryPath)} (FORMAT parquet)`,
    );
  } finally {
    db.close();
    fs.rmSync(jsonPath, { force: true });
  }
  fs.renameSync(temporaryPath, parquetPath);
  options.onProgress?.(`${path.basename(arrowPath)} -> ${parquetPath}`);
  return parquetPath;
}

/** Convert every Arrow file referenced by a descriptor, returning the Parquet paths. */
export function descriptorToParquet(
  descriptorPath: string,
  outputDir: string,
  options: ConvertOptions = {},
): Record<string, string> {
  const descriptor = JSON.parse(fs.readFileSync(descriptorPath, "utf-8")) as {
    dictionaries?: { type: string; path: string }[];
    binned?: { type: string; path: string }[];
    /** What the Hugging Face corpus calls `binned`. */
    windowed?: { type: string; path: string }[];
    series?: { type: string; path: string }[];
    records?: { type: string; path: string }[];
  };
  const entries = [
    ...(descriptor.dictionaries ?? []),
    ...(descriptor.binned ?? descriptor.windowed ?? []),
    ...(descriptor.series ?? []),
    ...(descriptor.records ?? []),
  ];

  const out: Record<string, string> = {};
  for (const entry of entries) {
    const arrowPath = path.isAbsolute(entry.path)
      ? entry.path
      : path.join(path.dirname(descriptorPath), entry.path);
    const parquetPath = path.join(outputDir, `${entry.type}.parquet`);
    out[entry.type] = arrowFileToParquet(arrowPath, parquetPath, options);
  }
  return out;
}
