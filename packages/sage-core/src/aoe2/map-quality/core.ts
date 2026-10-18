import { ColumnTable, escape, from, op } from "arquero";
import { clustersToTable } from "../../data/cluster.js";
import type { Cluster, ClusterOptions, MapFilter } from "../../data/types.js";
import {
  DataSet,
  DefaultAoE2BinnedTables,
  DefaultAoE2Tables,
  ParamOf,
  ParamsOf,
  TablesOf,
} from "../../utility/data-set.js";
import { Params, Struct } from "arquero/dist/types/table/types.js";
import { cardinalLocation } from "../location-names.js";
import { masterGroups, masterToId, terrainGroups } from "../ids.js";
import { PlayerParams } from "../types/derived/playerParams.js";
import { euclidean } from "../../functions/euclidean.js";
import "../../functions/dbscan.js";

export type ResourceQuality = {
  absoluteSize: number;
  referenceType: string;
  forwardedness: number | undefined;
  playerRelativePosition: string;
  mapAbsolutePosition: string;
  owner: number | undefined;
  ids: Array<number>;
  distanceToTC: number | undefined;
  xCenter: number;
  yCenter: number;
};

export type MapQuality = {
  goldMines: Array<ResourceQuality>;
  huntables: Array<ResourceQuality>;
  lurables: Array<ResourceQuality>;
  herdables: Array<ResourceQuality>;
  stoneMines: Array<ResourceQuality>;
  forageBushes: Array<ResourceQuality>;
  woodLines: Array<ResourceQuality>;
  hills: Array<ResourceQuality>;
};

export type MapInfo = {
  hills: ColumnTable;
  ponds: ColumnTable;
  huntables: ColumnTable;
  herdables: ColumnTable;
  goldMines: ColumnTable;
  stoneMines: ColumnTable;
  forageBushes: ColumnTable;
  woodLines: ColumnTable;
  lurables: ColumnTable;
  players: Array<MapQuality>;
  neutral: MapQuality;
};

type SizeToNameFunction = (
  clusterSize: number,
  distanceToTC?: number | undefined,
) => string;

export function addMapQuality<
  T extends DefaultAoE2Tables,
  B extends DefaultAoE2BinnedTables,
  P extends ParamsOf<[ParamOf<"players", Array<PlayerParams>>]>,
  D extends TablesOf<[]>,
>(
  dataSet: DataSet<T, B, P, D>,
): DataSet<T, B, P & ParamsOf<[ParamOf<"mapInfo", MapInfo>]>, D> {
  return dataSet.addParams("mapInfo", (t) => {
    // Gaia-owned resources live in the first snapshot window; clustering them
    // is the same shape every time, so it runs through the query layer's
    // cluster helpers rather than nine hand-written filter-and-cluster chains.
    // `assignPositionsToOwnedClusters` reads map dimensions off the table's
    // `dp` param, which used to arrive because clusters were derived from a
    // DataSet table. Clusters are now built from plain rows, so the param is
    // attached here instead.
    const withParams = (clusters: Cluster[]) =>
      clustersToTable(clusters).params({ dp: t.derivedParams }) as ColumnTable;

    const clusterResources = (
      masterIds: readonly number[],
      options: ClusterOptions,
      { gaiaOnly = true }: { gaiaOnly?: boolean } = {},
    ) =>
      withParams(
        t.query.clusterEntities(
          gaiaOnly ? { bin: 0, ownerId: 0, masterIds } : { bin: 0, masterIds },
          options,
        ),
      );
    const clusterTerrain = (filter: MapFilter, options: ClusterOptions) =>
      withParams(t.query.clusterMapCells(filter, options));

    const clusteredHills = assignPositionsToOwnedClusters(
      assignOwnersToClusters(
        clusterTerrain({ minElevationExclusive: 1 }, { minSize: 8 }),
        t.derivedParams.players,
        38,
      ),
      hillSizeToName,
    );
    const mapHills = ownedClustersToPlayerMap(clusteredHills);

    const clusteredPonds = assignPositionsToOwnedClusters(
      assignOwnersToClusters(
        clusterTerrain({ terrainTypes: terrainGroups.Water }, { minSize: 4 }),
        t.derivedParams.players,
        38,
      ),
    );

    const clusteredHuntables = assignPositionsToOwnedClusters(
      assignOwnersToClusters(
        clusterResources(masterGroups.Huntables, {
          maxDistance: 8,
          minSize: 2,
        }),
        t.derivedParams.players,
        38,
      ),
    );
    const mapHuntables = ownedClustersToPlayerMap(clusteredHuntables);

    // Herdables can already have been claimed, so they are not filtered by owner.
    const clusteredHerdables = assignPositionsToOwnedClusters(
      assignOwnersToClusters(
        clusterResources(
          masterGroups.Herdables,
          { maxDistance: 3, minSize: 2 },
          { gaiaOnly: false },
        ),
        t.derivedParams.players,
        38,
      ),
    );
    const mapHerdables = ownedClustersToPlayerMap(clusteredHerdables);

    const clusteredGoldMines = assignPositionsToOwnedClusters(
      assignOwnersToClusters(
        clusterResources([masterToId["Gold Mine"]], {
          maxDistance: 2,
          minSize: 2,
        }),
        t.derivedParams.players,
        38,
      ),
      goldSizeToName,
    );
    const mapGoldMines = ownedClustersToPlayerMap(clusteredGoldMines);

    const clusteredStoneMines = assignPositionsToOwnedClusters(
      assignOwnersToClusters(
        clusterResources([masterToId["Stone Mine"]], {
          maxDistance: 2,
          minSize: 2,
        }),
        t.derivedParams.players,
        38,
      ),
      stoneSizeToName,
    );
    const mapStoneMines = ownedClustersToPlayerMap(clusteredStoneMines);

    const clusteredForageBushes = assignPositionsToOwnedClusters(
      assignOwnersToClusters(
        clusterResources(masterGroups["Forage Bushes"], {
          maxDistance: 2,
          minSize: 2,
        }),
        t.derivedParams.players,
        38,
      ),
    );
    const mapForageBushes = ownedClustersToPlayerMap(clusteredForageBushes);

    const clusteredWoodLines = assignPositionsToOwnedClusters(
      assignOwnersToClusters(
        clusterResources(masterGroups.Trees, { maxDistance: 3, minSize: 3 }),
        t.derivedParams.players,
        28,
      ),
    );
    const mapWoodLines = ownedClustersToPlayerMap(clusteredWoodLines);

    const clusteredLurables = assignPositionsToOwnedClusters(
      assignOwnersToClusters(
        clusterResources(masterGroups.Lurables, { maxDistance: 1, minSize: 1 }),
        t.derivedParams.players,
        38,
      ),
    );
    const mapLurables = ownedClustersToPlayerMap(clusteredLurables);

    const qualityMaps = {
      goldMines: mapGoldMines,
      huntables: mapHuntables,
      lurables: mapLurables,
      herdables: mapHerdables,
      stoneMines: mapStoneMines,
      forageBushes: mapForageBushes,
      woodLines: mapWoodLines,
      hills: mapHills,
    };

    return {
      hills: clusteredHills,
      ponds: clusteredPonds,
      huntables: clusteredHuntables,
      herdables: clusteredHerdables,
      goldMines: clusteredGoldMines,
      stoneMines: clusteredStoneMines,
      forageBushes: clusteredForageBushes,
      woodLines: clusteredWoodLines,
      lurables: clusteredLurables,
      players: [
        mapsToPlayerMap(1, qualityMaps),
        mapsToPlayerMap(2, qualityMaps),
      ],
      neutral: mapsToPlayerMap(0, qualityMaps),
    };
  });
}

export function cluster2d(
  table: ColumnTable,
  xValue: string,
  yValue: string,
  identifier: string,
  clusterOptions?: {
    maxDistance?: number;
    minSize?: number;
  },
) {
  const defaultOptions = {
    maxDistance: 2,
    minSize: 2,
  };

  const opts = { ...defaultOptions, ...clusterOptions };
  return table
    .select(identifier, xValue, yValue)
    .dbscan([xValue, yValue], opts.maxDistance, opts.minSize, "dbscan")
    .groupby("dbscan")
    .rollup({
      dbscan: op.any("dbscan"),
      clusterX: op.mean(xValue),
      clusterY: op.mean(yValue),
      size: op.count(),
      ids: op.array_agg(identifier),
    });
}

export function assignOwnersToClusters(
  table: ColumnTable,
  players: Array<PlayerParams>,
  maxDistance: number,
) {
  // An empty grouped rollup can produce an undefined aggregate row in Arquero.
  // Keep the schema and params, but do not manufacture a resource cluster.
  if (table.numRows() === 0)
    return table
      .select("dbscan", "clusterX", "clusterY", "ids")
      .rename({ dbscan: "clusterId" })
      .derive({
        owner: () => null,
        ownerX: () => null,
        ownerY: () => null,
        idCount: () => 0,
        distance: () => null,
      });
  return table
    .cross(from(players).select("playerId", "startX", "startY"))
    .params({ maxDistance })
    .derive({
      distance: escape((d: Struct) =>
        euclidean([d["clusterX"], d["clusterY"]], [d["startX"], d["startY"]]),
      ),
    })
    .orderby("distance")
    .groupby("dbscan")
    .rollup({
      idArr: op.array_agg("playerId"),
      distArr: op.array_agg("distance"),
      ownerX: op.array_agg("startX"),
      ownerY: op.array_agg("startY"),
      ids: op.any("ids"),
      clusterX: op.any("clusterX"),
      clusterY: op.any("clusterY"),
    })
    .derive({
      nearestId: (d: Struct, $: Params) =>
        d["distArr"][0] < $["maxDistance"] ? d["idArr"][0] : null,
      distance: (d: Struct, $: Params) =>
        d["distArr"][0] < $["maxDistance"] ? d["distArr"][0] : null,
      idCount: (d: Struct) => d["ids"].length,
      ownerX: (d: Struct, $: Params) =>
        d["distArr"][0] < $["maxDistance"] ? d["ownerX"][0] : null,
      ownerY: (d: Struct, $: Params) =>
        d["distArr"][0] < $["maxDistance"] ? d["ownerY"][0] : null,
    })
    .select({
      dbscan: "clusterId",
      nearestId: "owner",
      ownerX: "ownerX",
      ownerY: "ownerY",
      idCount: "idCount",
      ids: "ids",
      distance: "distance",
      clusterX: "clusterX",
      clusterY: "clusterY",
    });
}

export const goldSizeToName: SizeToNameFunction = (
  clusterSize: number,
  _distanceToTC: number | undefined = undefined,
): string => {
  switch (clusterSize) {
    case 4:
      return "tertiary";
    case 5:
      return "secondary";
    case 7:
      return "main";
    default:
      return "unknown";
  }
};

export const stoneSizeToName: SizeToNameFunction = (
  clusterSize: number,
  _distanceToTC: number | undefined = undefined,
): string => {
  switch (clusterSize) {
    case 4:
      return "secondary";
    case 5:
      return "main";
    default:
      return "unknown";
  }
};

export const hillSizeToName: SizeToNameFunction = (
  clusterSize: number,
  _distanceToTC: number | undefined = undefined,
): string => {
  if (clusterSize > 60) {
    return "large";
  }
  if (clusterSize > 30) {
    return "medium";
  }
  return "small";
};

export function assignPositionsToOwnedClusters(
  table: ColumnTable,
  sizeToName: SizeToNameFunction = () => "regular",
) {
  return table.derive({
    size: escape((d: Struct) => {
      if (d["owner"] !== undefined) {
        return sizeToName(d["idCount"], d["distance"]);
      }
      return "neutral";
    }),
    cardinalPosition: escape((d: Struct) => {
      const x = d["clusterX"];
      const y = d["clusterY"];
      return cardinalLocation(x, y);
    }),
    dot: escape((d: Struct, $: Params) => {
      if (d["owner"] === undefined) {
        return undefined;
      }
      let clusterVx = d["clusterX"] - $["dp"]["gameInfo"]["mapWidth"] / 2;
      let clusterVy = d["clusterY"] - $["dp"]["gameInfo"]["mapHeight"] / 2;
      const clusterVlen = op.sqrt(clusterVx ** 2 + clusterVy ** 2);
      clusterVx /= clusterVlen;
      clusterVy /= clusterVlen;
      let ownerVx = d["ownerX"] - $["dp"]["gameInfo"]["mapWidth"] / 2;
      let ownerVy = d["ownerY"] - $["dp"]["gameInfo"]["mapHeight"] / 2;
      const ownerVlen = op.sqrt(ownerVx ** 2 + ownerVy ** 2);
      ownerVx /= ownerVlen;
      ownerVy /= ownerVlen;
      return clusterVx * ownerVx + clusterVy * ownerVy;
    }),
    relativePosition: escape((d: Struct, $: Params) => {
      if (d["owner"] === undefined) {
        return "neutral";
      }
      let clusterVx = d["clusterX"] - $["dp"]["gameInfo"]["mapWidth"] / 2;
      let clusterVy = d["clusterY"] - $["dp"]["gameInfo"]["mapHeight"] / 2;
      const clusterVlen = op.sqrt(clusterVx ** 2 + clusterVy ** 2);
      clusterVx /= clusterVlen;
      clusterVy /= clusterVlen;
      let ownerVx = d["ownerX"] - $["dp"]["gameInfo"]["mapWidth"] / 2;
      let ownerVy = d["ownerY"] - $["dp"]["gameInfo"]["mapHeight"] / 2;
      const ownerVlen = op.sqrt(ownerVx ** 2 + ownerVy ** 2);
      ownerVx /= ownerVlen;
      ownerVy /= ownerVlen;
      const dot = clusterVx * ownerVx + clusterVy * ownerVy;
      return dot > 0.5 ? "forward" : "backward";
    }),
  });
}

function ownedClustersToPlayerMap(
  table: ColumnTable,
): Map<number, ResourceQuality[]> {
  return table
    .impute({ owner: 0 })
    .groupby("owner")
    .select({
      idCount: "absoluteSize",
      size: "referenceType",
      clusterX: "xCenter",
      clusterY: "yCenter",
      relativePosition: "playerRelativePosition",
      cardinalPosition: "mapAbsolutePosition",
      dot: "forwardedness",
      ids: "ids",
      distance: "distanceToTC",
      owner: "owner",
    })
    .objects({ grouped: "map" }) as unknown as Map<number, ResourceQuality[]>;
}

function mapsToPlayerMap(
  player: number,
  maps: {
    goldMines: Map<number, ResourceQuality[]>;
    huntables: Map<number, ResourceQuality[]>;
    lurables: Map<number, ResourceQuality[]>;
    herdables: Map<number, ResourceQuality[]>;
    stoneMines: Map<number, ResourceQuality[]>;
    forageBushes: Map<number, ResourceQuality[]>;
    woodLines: Map<number, ResourceQuality[]>;
    hills: Map<number, ResourceQuality[]>;
  },
): MapQuality {
  return {
    goldMines: maps.goldMines.get(player) ?? [],
    huntables: maps.huntables.get(player) ?? [],
    lurables: maps.lurables.get(player) ?? [],
    herdables: maps.herdables.get(player) ?? [],
    stoneMines: maps.stoneMines.get(player) ?? [],
    forageBushes: maps.forageBushes.get(player) ?? [],
    woodLines: maps.woodLines.get(player) ?? [],
    hills: maps.hills.get(player) ?? [],
  };
}
