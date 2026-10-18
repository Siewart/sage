import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { createHash } from "node:crypto";

import type { BinTime } from "../types.js";
import { descriptorToParquet } from "./convert.js";
import { DuckDbQuery } from "./query.js";
import type { TableFiles } from "./register.js";
import { VIEWS } from "./sql.js";

export interface OpenDuckDbOptions {
  /**
   * Where Parquet conversions of local Arrow matches are cached. Relative paths
   * resolve against the working directory, which the CLI sets to the package root.
   */
  cacheDir?: string | undefined;
  onProgress?: ((message: string) => void) | undefined;
}

export function defaultPreparedDirectory(): string {
  return path.join(
    process.env["SAGE_DATA_DIR"] ?? path.join(os.homedir(), ".cache", "sage"),
    "prepared",
  );
}
export const DEFAULT_PARQUET_CACHE = defaultPreparedDirectory();

/** Build the per-table file map DuckDB registers views over. */
export function tableFilesFrom(
  paths: Readonly<Record<string, string | readonly string[]>>,
): TableFiles {
  const files = {} as TableFiles;
  for (const table of Object.keys(VIEWS) as (keyof typeof VIEWS)[]) {
    const entry = paths[table];
    files[table] =
      entry === undefined
        ? []
        : (Array.isArray(entry) ? entry : [entry as string]).map((p) =>
            path.resolve(p),
          );
  }
  return files;
}

/**
 * Open a local Arrow match through DuckDB, converting it to Parquet on first
 * use and caching the result.
 *
 * This is what the parity check runs against, and it is the offline path. The
 * production DuckDB path reads Parquet pulled from Hugging Face, which needs no
 * conversion — see `../hf/`.
 */
export function openDuckDbMatch(
  descriptorPath: string,
  options: OpenDuckDbOptions = {},
): DuckDbQuery {
  const descriptor = JSON.parse(fs.readFileSync(descriptorPath, "utf-8")) as {
    name: string;
    metadata: { binTimes: BinTime[] };
  };
  const cacheDir = preparedMatchDirectory(descriptorPath, options.cacheDir);
  const parquet = descriptorToParquet(descriptorPath, cacheDir, {
    onProgress: options.onProgress,
  });

  return new DuckDbQuery({
    name: descriptor.name,
    files: tableFilesFrom(parquet),
    binTimes: descriptor.metadata.binTimes,
  });
}

export function preparedMatchDirectory(
  descriptorPath: string,
  root = defaultPreparedDirectory(),
): string {
  return path.join(
    root,
    createHash("sha256")
      .update(path.resolve(descriptorPath))
      .update(fs.readFileSync(descriptorPath))
      .digest("hex")
      .slice(0, 20),
  );
}
