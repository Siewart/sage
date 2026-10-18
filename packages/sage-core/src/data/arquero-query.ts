import * as aq from "arquero";
import { escape } from "arquero";
import type { ColumnTable } from "arquero";
import type { Struct } from "arquero/dist/types/table/types.js";

import { clusterRows } from "./cluster.js";
import type {
  BinTime,
  Cluster,
  ClusterOptions,
  EntityFilter,
  EventFilter,
  GameSettings,
  MapFilter,
  NamedEntityFilter,
  PlayerFilter,
  MasterFilter,
  ResearchFilter,
  Row,
  StringFilter,
  SageQuery,
  WorldFilter,
} from "./types.js";

/** The subset of `DataSet` this backend needs, so tests can pass a stub. */
export interface ArqueroTables {
  name: string;
  t: {
    entities: ColumnTable;
    masters: ColumnTable;
    strings: ColumnTable;
    researchStates: ColumnTable;
    players: ColumnTable;
    events: ColumnTable;
    map: ColumnTable;
    settings: ColumnTable;
    world: ColumnTable;
  };
  descriptor: { metadata: { binTimes: Array<[number, number]> } };
}

const distance = (ax: number, ay: number, bx: number, by: number) =>
  Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);

/** Project only when asked, so callers keep whatever the source table carries. */
const project = (table: ColumnTable, columns?: readonly string[]) =>
  columns && columns.length > 0 ? table.select(...columns) : table;

const dedupe = (columns: readonly string[]) => [...new Set(columns)];

/**
 * `SageQuery` over the Arrow files loaded into Arquero by `DataSet`.
 *
 * This is the reference implementation: it reproduces, verb for verb, the
 * queries the pipeline used to make inline, so switching the pipeline onto
 * `SageQuery` cannot change any generated report. The DuckDB backend is checked
 * against it rather than the other way round.
 */
export class ArqueroQuery implements SageQuery {
  readonly backend = "arquero" as const;
  readonly supportsSql = false;

  /**
   * Filtering a whole match table is the expensive part of this backend, and
   * the pipeline asks the same "this window, this player" question several
   * times per snapshot: units, buildings, villagers, technologies, ages. The
   * window-and-owner slice is cached so the narrower predicates run over a few
   * hundred rows rather than the whole table — the same saving the extractor
   * used to get by pre-filtering once and passing the result around.
   *
   * The pipeline walks windows in order, so a handful of entries suffices;
   * past that the oldest is dropped rather than holding a match twice over.
   */
  private static readonly SLICE_CACHE_SIZE = 8;
  private readonly entitySlices = new Map<string, ColumnTable>();
  private readonly researchSlices = new Map<string, ColumnTable>();
  private numberedMap: ColumnTable | undefined;

  constructor(private readonly source: ArqueroTables) {}

  private cached(
    cache: Map<string, ColumnTable>,
    key: string,
    build: () => ColumnTable,
  ): ColumnTable {
    const hit = cache.get(key);
    if (hit) return hit;
    const table = build();
    cache.set(key, table);
    if (cache.size > ArqueroQuery.SLICE_CACHE_SIZE) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    return table;
  }

  get name() {
    return this.source.name;
  }

  settings(): GameSettings {
    return this.source.t.settings.object() as unknown as GameSettings;
  }

  binTimes(): readonly BinTime[] {
    return this.source.descriptor.metadata.binTimes;
  }

  timeToWindow(timeMs: number): number {
    return this.binTimes().findIndex((b) => b[0] <= timeMs && b[1] >= timeMs);
  }

  binToTimes(bin: number): BinTime {
    const binTime = this.binTimes()[bin];
    if (!binTime) throw new Error(`Bin ${bin} does not exist.`);
    return binTime;
  }

  players(filter: PlayerFilter = {}): Row[] {
    const { bin, id, minId } = filter;
    let table = this.source.t.players;
    if (bin !== undefined || id !== undefined || minId !== undefined) {
      table = table.filter(
        escape(
          (d: Struct) =>
            (bin === undefined || d["sage:binId"] === bin) &&
            (id === undefined || d["id"] === id) &&
            (minId === undefined || d["id"] > minId),
        ),
      );
    }
    return project(table, filter.columns).objects() as Row[];
  }

  entities(filter: EntityFilter): Row[] {
    return project(
      this.filteredEntities(filter),
      filter.columns,
    ).objects() as Row[];
  }

  namedEntities(filter: NamedEntityFilter): Row[] {
    const columns = dedupe([
      "id",
      "refMasterId",
      "ownerId",
      "sage:binId",
      ...(filter.columns ?? []),
    ]);
    return this.filteredEntities(filter)
      .select(...columns)
      .lookup(
        this.source.t.masters,
        [
          ["refMasterId", "sage:binId", "ownerId"],
          ["id", "sage:binId", "playerId"],
        ],
        ["stringId", ...(filter.masterColumns ?? [])],
      )
      .lookup(this.source.t.strings, ["stringId", "id"], ["string"])
      .rename({ string: "name" })
      .objects() as Row[];
  }

  masters(filter: MasterFilter): Row[] {
    const { bin, ids, playerId } = filter;
    const idSet = ids ? new Set(ids) : undefined;
    const table = this.source.t.masters.filter(
      escape(
        (d: Struct) =>
          d["sage:binId"] === bin &&
          (playerId === undefined || d["playerId"] === playerId) &&
          (idSet === undefined || idSet.has(d["id"] as number)),
      ),
    );
    return project(table, filter.columns).objects() as Row[];
  }

  strings(filter: StringFilter = {}): Row[] {
    const { ids } = filter;
    if (ids === undefined) return this.source.t.strings.objects() as Row[];
    const idSet = new Set(ids);
    return this.source.t.strings
      .filter(escape((d: Struct) => idSet.has(d["id"] as number)))
      .objects() as Row[];
  }

  researchStates(filter: ResearchFilter): Row[] {
    return project(
      this.filteredResearch(filter),
      filter.columns,
    ).objects() as Row[];
  }

  namedResearchStates(filter: ResearchFilter): Row[] {
    const columns = dedupe([
      "stringId",
      "researchId",
      "playerId",
      "state",
      ...(filter.columns ?? []),
    ]);
    return this.filteredResearch(filter)
      .select(...columns)
      .lookup(this.source.t.strings, ["stringId", "id"], ["string"])
      .rename({ string: "name" })
      .objects() as Row[];
  }

  events(filter: EventFilter = {}): Row[] {
    const {
      modelTypes,
      tags,
      timeRange,
      requireSubjectPlayer,
      requireObjectPlayer,
    } = filter;
    const table = this.source.t.events.filter(
      escape(
        (d: Struct) =>
          (modelTypes === undefined ||
            modelTypes.includes(d["sage:modelType"] as string)) &&
          (tags === undefined || tags.includes(d["tag"] as string)) &&
          (timeRange === undefined ||
            (d["worldTime"] >= timeRange[0] &&
              d["worldTime"] <= timeRange[1])) &&
          (!requireSubjectPlayer || d["subjectPlayerId"] > 0) &&
          (!requireObjectPlayer || d["objectPlayerId"] > 0),
      ),
    );
    return project(table, filter.columns).objects() as Row[];
  }

  mapCells(filter: MapFilter = {}): Row[] {
    return project(this.filteredMap(filter), filter.columns).objects() as Row[];
  }

  world(filter: WorldFilter = {}): Row[] {
    const { bin } = filter;
    const table =
      bin === undefined
        ? this.source.t.world
        : this.source.t.world.filter(
            escape((d: Struct) => d["sage:binId"] === bin),
          );
    return project(table, filter.columns).objects() as Row[];
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

  sql(): Row[] {
    throw new Error(
      "The arquero backend has no SQL support; use the duckdb backend or guard with supportsSql.",
    );
  }

  close(): void {
    /* Arrow tables are plain memory; nothing to release. */
  }

  private filteredEntities(filter: EntityFilter): ColumnTable {
    const { bin, ownerId, ids, masterIds, near } = filter;
    const slice = this.cached(
      this.entitySlices,
      `${bin ?? "*"}|${ownerId ?? "*"}`,
      () =>
        bin === undefined && ownerId === undefined
          ? this.source.t.entities
          : this.source.t.entities.filter(
              escape(
                (d: Struct) =>
                  (bin === undefined || d["sage:binId"] === bin) &&
                  (ownerId === undefined || d["ownerId"] === ownerId),
              ),
            ),
    );
    if (ids === undefined && masterIds === undefined && near === undefined) {
      return slice;
    }

    const idSet = ids ? new Set(ids) : undefined;
    const masterSet = masterIds ? new Set(masterIds) : undefined;
    return slice.filter(
      escape(
        (d: Struct) =>
          (idSet === undefined || idSet.has(d["id"] as number)) &&
          (masterSet === undefined ||
            masterSet.has(d["refMasterId"] as number)) &&
          (near === undefined ||
            distance(d["worldX"], d["worldY"], near.x, near.y) <= near.radius),
      ),
    );
  }

  private filteredResearch(filter: ResearchFilter): ColumnTable {
    const { bin, playerId, researchIds } = filter;
    const slice = this.cached(
      this.researchSlices,
      `${bin}|${playerId ?? "*"}`,
      () =>
        this.source.t.researchStates.filter(
          escape(
            (d: Struct) =>
              d["sage:binId"] === bin &&
              (playerId === undefined || d["playerId"] === playerId),
          ),
        ),
    );
    if (researchIds === undefined) return slice;

    const researchSet = new Set(researchIds);
    return slice.filter(
      escape((d: Struct) => researchSet.has(d["researchId"] as number)),
    );
  }

  /**
   * `id` is the 1-based position of the cell in the unfiltered map table, so
   * that filtered subsets still identify cells consistently. Assigning it
   * before filtering is what the original map-quality code did.
   */
  private filteredMap(filter: MapFilter): ColumnTable {
    const { minElevationExclusive, terrainTypes } = filter;
    const terrainSet = terrainTypes ? new Set(terrainTypes) : undefined;
    this.numberedMap ??= this.source.t.map.derive({ id: aq.op.row_number() });
    const table = this.numberedMap;
    if (minElevationExclusive === undefined && terrainSet === undefined) {
      return table;
    }
    return table.filter(
      escape(
        (d: Struct) =>
          (minElevationExclusive === undefined ||
            d["elevationLevel"] > minElevationExclusive) &&
          (terrainSet === undefined ||
            terrainSet.has(d["terrainType"] as number)),
      ),
    );
  }
}
