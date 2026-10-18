/**
 * Backend-agnostic data access for SAGE match data.
 *
 * The pipeline used to reach straight into Arquero `ColumnTable`s held by
 * `DataSet`. Every one of those call sites ended in `.objects()`, so the real
 * boundary was always "named query in, plain rows out" — that is what
 * {@link SageQuery} formalises. Two backends implement it: `arquero`, reading
 * the Arrow files shipped in `data/`, and `duckdb`, reading Parquet pulled from
 * Hugging Face. Both must answer every query identically; `parity.ts` checks it.
 */

/** Row order is the order rows appear in the source file, unless noted. */
export type Row = Record<string, unknown>;

/**
 * The snapshot-window column both backends expose.
 *
 * The matches under `data/` name it this; the Hugging Face corpus names the
 * same column `sage:windowId`. Rather than teach every query about both, each
 * backend renames what it finds onto {@link BIN_ID} as the data is registered
 * or loaded, so the two vintages are interchangeable from here up.
 */
export const BIN_ID = "sage:binId";

/** Window-column spellings seen in dataset exports. */
export const WINDOW_ID_ALIASES = ["sage:windowId", "sage:windowID"] as const;

/** The window column needing a rename, or undefined when none does. */
export function windowColumnToRename(
  columns: readonly string[] | undefined,
): string | undefined {
  if (!columns || columns.includes(BIN_ID)) return undefined;
  return WINDOW_ID_ALIASES.find((alias) => columns.includes(alias));
}

export type BackendKind = "arquero" | "duckdb";

export interface GameSettings {
  mapWidth: number;
  mapHeight: number;
  mapName: string;
}

/** A half-open-in-practice `[startMs, endMs]` pair per snapshot window. */
export type BinTime = readonly [number, number];

export interface PlayerFilter {
  /** Snapshot window. Omit to read every window. */
  bin?: number | undefined;
  id?: number | undefined;
  /** Keep players with `id > minId`; `0` drops Gaia. */
  minId?: number | undefined;
  columns?: readonly string[] | undefined;
}

export interface EntityFilter {
  /** Snapshot window. Omit to search every window. */
  bin?: number | undefined;
  ownerId?: number | undefined;
  /** Entity `id`s to keep. */
  ids?: readonly number[] | undefined;
  /** `refMasterId`s to keep. */
  masterIds?: readonly number[] | undefined;
  /** Keep entities within `radius` tiles of `(x, y)`, by Euclidean distance. */
  near?: { x: number; y: number; radius: number } | undefined;
  /** Extra entity columns to project beyond the shape's defaults. */
  columns?: readonly string[] | undefined;
}

export interface NamedEntityFilter extends EntityFilter {
  /**
   * Extra `masters` columns to carry through the join. Where a name exists on
   * both tables (`hp`, `type`), the master value wins.
   */
  masterColumns?: readonly string[] | undefined;
}

export interface MasterFilter {
  bin: number;
  /** `masters.id` values to keep. */
  ids?: readonly number[] | undefined;
  playerId?: number | undefined;
  columns?: readonly string[] | undefined;
}

export interface StringFilter {
  /** `strings.id` values to keep. */
  ids?: readonly number[] | undefined;
}

export interface ResearchFilter {
  bin: number;
  playerId?: number | undefined;
  researchIds?: readonly number[] | undefined;
  columns?: readonly string[] | undefined;
}

export interface EventFilter {
  /** `sage:modelType` values to keep, e.g. `["damage", "death"]`. */
  modelTypes?: readonly string[] | undefined;
  /** `tag` values to keep, e.g. `["underConstruction", "constructed"]`. */
  tags?: readonly string[] | undefined;
  /** Inclusive `worldTime` bounds in milliseconds. */
  timeRange?: readonly [number, number] | undefined;
  /** Require `subjectPlayerId > 0`. */
  requireSubjectPlayer?: boolean | undefined;
  /** Require `objectPlayerId > 0`. */
  requireObjectPlayer?: boolean | undefined;
  columns?: readonly string[] | undefined;
}

export interface MapFilter {
  /** Keep cells with `elevationLevel > minElevationExclusive`. */
  minElevationExclusive?: number | undefined;
  /** Keep cells whose `terrainType` is in this list. */
  terrainTypes?: readonly number[] | undefined;
  columns?: readonly string[] | undefined;
}

export interface WorldFilter {
  bin?: number | undefined;
  columns?: readonly string[] | undefined;
}

export interface ClusterOptions {
  /** DBSCAN epsilon, in tiles. */
  maxDistance?: number | undefined;
  /** DBSCAN minimum points for a cluster. */
  minSize?: number | undefined;
}

/** One DBSCAN cluster, in the shape the map-quality code consumes. */
export interface Cluster {
  dbscan: number;
  clusterX: number;
  clusterY: number;
  size: number;
  ids: number[];
}

/**
 * The queries the pipeline actually makes, named and parameterised.
 *
 * Everything is synchronous: the DuckDB backend loads a match up front (see
 * `DuckDbQuery.open`) so that call sites deep in the templates do not have to
 * become async. Corpus-wide work, which cannot be preloaded, goes through the
 * async {@link SageCorpus} instead.
 */
export interface SageQuery {
  readonly backend: BackendKind;
  readonly name: string;

  /** Single-record game settings. */
  settings(): GameSettings;
  binTimes(): readonly BinTime[];
  /** Index of the snapshot window containing `timeMs`, or `-1`. */
  timeToWindow(timeMs: number): number;
  binToTimes(bin: number): BinTime;

  players(filter?: PlayerFilter): Row[];
  entities(filter: EntityFilter): Row[];
  /**
   * Entities joined to `masters` on `(refMasterId, bin, ownerId)` and then to
   * `strings`, exposing the display name as `name`. Join keys are unique in
   * every table, so this is a plain left join in SQL and an Arquero `lookup`.
   */
  namedEntities(filter: NamedEntityFilter): Row[];
  /** Per-window, per-player master (unit and building template) records. */
  masters(filter: MasterFilter): Row[];
  /** The string dictionary: `id` to `string`. */
  strings(filter?: StringFilter): Row[];
  researchStates(filter: ResearchFilter): Row[];
  /** Research states joined to `strings`, exposing the name as `name`. */
  namedResearchStates(filter: ResearchFilter): Row[];
  events(filter?: EventFilter): Row[];
  mapCells(filter?: MapFilter): Row[];
  world(filter?: WorldFilter): Row[];

  /** DBSCAN over matching entities' `(worldX, worldY)`. */
  clusterEntities(filter: EntityFilter, options?: ClusterOptions): Cluster[];
  /** DBSCAN over matching map cells' `(x, y)`; cells are identified by row index. */
  clusterMapCells(filter: MapFilter, options?: ClusterOptions): Cluster[];

  /**
   * Raw SQL against the match's tables. DuckDB only — the Arquero backend
   * throws, so guard with `supportsSql` before calling.
   */
  sql(query: string): Row[];
  readonly supportsSql: boolean;

  close(): void;
}
