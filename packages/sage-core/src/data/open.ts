import { DataSet } from "../utility/data-set.js";
import { ArqueroQuery } from "./arquero-query.js";
import { openDuckDbMatch, type OpenDuckDbOptions } from "./duckdb/open.js";
import type { BackendKind, SageQuery } from "./types.js";

export interface OpenMatchOptions extends OpenDuckDbOptions {
  backend?: BackendKind | undefined;
}

/**
 * Open a match on the Arquero backend.
 *
 * `DataSet` builds its own `ArqueroQuery`, so this hands that one back rather
 * than making a second with its own caches.
 */
export function openArqueroMatch(descriptorPath: string): ArqueroQuery {
  return new DataSet(descriptorPath, {}, {}, { backend: "arquero" })
    .query as ArqueroQuery;
}

/** Open one match on either backend. Both satisfy the same `SageQuery` contract. */
export function openMatch(
  descriptorPath: string,
  options: OpenMatchOptions = {},
): SageQuery {
  return (options.backend ?? "duckdb") === "duckdb"
    ? openDuckDbMatch(descriptorPath, options)
    : openArqueroMatch(descriptorPath);
}

export { openDuckDbMatch };
