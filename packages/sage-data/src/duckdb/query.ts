import { clusterRows } from "../cluster.js";
import type {
  BinTime,
  Cluster,
  ClusterOptions,
  EntityFilter,
  EventFilter,
  GameSettings,
  MapFilter,
  MasterFilter,
  NamedEntityFilter,
  PlayerFilter,
  ResearchFilter,
  Row,
  SageQuery,
  StringFilter,
  WorldFilter,
} from "../types.js";
import { SyncDuckDb } from "./sync-client.js";
import {
  columnsSql,
  registerStatements,
  rowCountSql,
  type TableColumns,
  type TableFiles,
} from "./register.js";
import {
  entitiesSql,
  eventsSql,
  mapCellsSql,
  mastersSql,
  namedEntitiesSql,
  namedResearchStatesSql,
  playersSql,
  researchStatesSql,
  settingsSql,
  stringsSql,
  VIEWS,
  worldSql,
} from "./sql.js";

export interface DuckDbMatchSource {
  name: string;
  files: TableFiles;
  /** Snapshot window bounds; the pipeline needs these to map time to a bin. */
  binTimes: readonly BinTime[];
  /** DuckDB database path; defaults to in-memory. */
  databasePath?: string | undefined;
}

/**
 * `SageQuery` backed by DuckDB over Parquet.
 *
 * Filtering and joining happen in DuckDB, so only the rows a query actually
 * asks for cross into JS, where the Arquero backend has to hold an entire
 * match's tables in memory. The motivation is the one-second-resolution export,
 * which is roughly sixty times the rows per match.
 *
 * Exercised against the sixty-second matches under `data/` converted to
 * Parquet, and against the Hugging Face corpus at one-second resolution — where
 * the snapshot-window column is named `sage:windowId` rather than `sage:binId`
 * and gets renamed at registration.
 */
export class DuckDbQuery implements SageQuery {
  readonly backend = "duckdb" as const;
  readonly supportsSql = true;
  readonly name: string;

  private readonly db: SyncDuckDb;
  private readonly bins: readonly BinTime[];
  private cachedSettings: GameSettings | undefined;

  constructor(source: DuckDbMatchSource) {
    this.name = source.name;
    this.bins = source.binTimes;

    // A table split across shards needs each shard's row count to keep __ord
    // monotone across files. Single-file tables — the common case — need none
    // of this, so the counting connection is only opened when one is sharded.
    const tables = Object.keys(VIEWS) as (keyof typeof VIEWS)[];
    const sharded = tables.filter(
      (table) => (source.files[table]?.length ?? 0) > 1,
    );
    const present = tables.filter(
      (table) => (source.files[table]?.length ?? 0) > 0,
    );

    // One connection answers both: the per-shard row counts, and each table's
    // column names, which decide whether the window column needs renaming.
    // Both read Parquet metadata only, so this stays cheap even at one-second
    // resolution.
    const rowCounts: Partial<Record<keyof typeof VIEWS, number[]>> = {};
    const columns: TableColumns = {};
    const probe = new SyncDuckDb({ databasePath: source.databasePath });
    try {
      for (const table of sharded) {
        rowCounts[table] = probe
          .query(rowCountSql(source.files[table]))
          .map((row) => Number(row["n"]));
      }
      for (const table of present) {
        columns[table] = probe
          .query(columnsSql(source.files[table][0] as string))
          .map((row) => String(row["name"]));
      }
    } finally {
      probe.close();
    }

    this.db = new SyncDuckDb({
      databasePath: source.databasePath,
      statements: registerStatements(source.files, rowCounts, columns),
    });
  }

  settings(): GameSettings {
    if (!this.cachedSettings) {
      const [row] = this.db.query(settingsSql());
      if (!row) throw new Error(`No settings row for match ${this.name}`);
      this.cachedSettings = row as unknown as GameSettings;
    }
    return this.cachedSettings;
  }

  binTimes(): readonly BinTime[] {
    return this.bins;
  }

  timeToWindow(timeMs: number): number {
    return this.bins.findIndex((b) => b[0] <= timeMs && b[1] >= timeMs);
  }

  binToTimes(bin: number): BinTime {
    const binTime = this.bins[bin];
    if (!binTime) throw new Error(`Bin ${bin} does not exist.`);
    return binTime;
  }

  players(filter: PlayerFilter = {}): Row[] {
    return this.db.query(playersSql(filter));
  }

  entities(filter: EntityFilter): Row[] {
    return this.db.query(entitiesSql(filter));
  }

  namedEntities(filter: NamedEntityFilter): Row[] {
    return this.db.query(namedEntitiesSql(filter));
  }

  masters(filter: MasterFilter): Row[] {
    return this.db.query(mastersSql(filter));
  }

  strings(filter: StringFilter = {}): Row[] {
    return this.db.query(stringsSql(filter));
  }

  researchStates(filter: ResearchFilter): Row[] {
    return this.db.query(researchStatesSql(filter));
  }

  namedResearchStates(filter: ResearchFilter): Row[] {
    return this.db.query(namedResearchStatesSql(filter));
  }

  events(filter: EventFilter = {}): Row[] {
    return this.db.query(eventsSql(filter));
  }

  mapCells(filter: MapFilter = {}): Row[] {
    return this.db.query(mapCellsSql(filter));
  }

  world(filter: WorldFilter = {}): Row[] {
    return this.db.query(worldSql(filter));
  }

  clusterEntities(filter: EntityFilter, options?: ClusterOptions): Cluster[] {
    const rows = this.entities({
      ...filter,
      columns: ["id", "worldX", "worldY"],
    });
    return clusterRows(rows, "worldX", "worldY", "id", options);
  }

  clusterMapCells(filter: MapFilter, options?: ClusterOptions): Cluster[] {
    const rows = this.mapCells({ ...filter, columns: ["id", "x", "y"] });
    return clusterRows(rows, "x", "y", "id", options);
  }

  sql(query: string): Row[] {
    return this.db.query(query);
  }

  close(): void {
    this.db.close();
  }
}
