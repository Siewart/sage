import { ColumnTable, escape, from, op } from "arquero";
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
    const hills = t.t.map
      .derive({ id: op.row_number() })
      .filter((d) => d["elevationLevel"] > 1);
    const clusteredHills = assignPositionsToOwnedClusters(
      assignOwnersToClusters(
        cluster2d(hills, "x", "y", "id", { minSize: 8 }),
        t.derivedParams.players,
        38,
      ),
      hillSizeToName,
    );
    const mapHills = ownedClustersToPlayerMap(clusteredHills);

    const ponds = t.t.map
      .derive({ id: op.row_number() })
      .filter((d, $) =>
        op.includes($["h"]["terrainGroups"]["Water"], d["terrainType"]),
      );
    const clusteredPonds = assignPositionsToOwnedClusters(
      assignOwnersToClusters(
        cluster2d(ponds, "x", "y", "id", { minSize: 4 }),
        t.derivedParams.players,
        38,
      ),
    );

    const huntables = t.t.entities.filter(
      (d, $) =>
        d["sage:binId"] === 0 &&
        d["ownerId"] === 0 &&
        op.includes($["h"]["masterGroups"]["Huntables"], d["refMasterId"]),
    );
    const clusteredHuntables = assignPositionsToOwnedClusters(
      assignOwnersToClusters(
        cluster2d(huntables, "worldX", "worldY", "id", {
          maxDistance: 8,
          minSize: 2,
        }),
        t.derivedParams.players,
        38,
      ),
    );
    const mapHuntables = ownedClustersToPlayerMap(clusteredHuntables);

    const herdables = t.t.entities.filter(
      (d, $) =>
        d["sage:binId"] === 0 &&
        op.includes($["h"]["masterGroups"]["Herdables"], d["refMasterId"]),
    );
    const clusteredHerdables = assignPositionsToOwnedClusters(
      assignOwnersToClusters(
        cluster2d(herdables, "worldX", "worldY", "id", {
          maxDistance: 3,
          minSize: 2,
        }),
        t.derivedParams.players,
        38,
      ),
    );
    const mapHerdables = ownedClustersToPlayerMap(clusteredHerdables);

    const goldMines = t.t.entities.filter(
      (d, $) =>
        d["sage:binId"] === 0 &&
        d["ownerId"] === 0 &&
        $["h"]["masterToId"]["Gold Mine"] === d["refMasterId"],
    );
    const clusteredGoldMines = assignPositionsToOwnedClusters(
      assignOwnersToClusters(
        cluster2d(goldMines, "worldX", "worldY", "id", {
          maxDistance: 2,
          minSize: 2,
        }),
        t.derivedParams.players,
        38,
      ),
      goldSizeToName,
    );
    const mapGoldMines = ownedClustersToPlayerMap(clusteredGoldMines);

    const stoneMines = t.t.entities.filter(
      (d, $) =>
        d["sage:binId"] === 0 &&
        d["ownerId"] === 0 &&
        $["h"]["masterToId"]["Stone Mine"] === d["refMasterId"],
    );
    const clusteredStoneMines = assignPositionsToOwnedClusters(
      assignOwnersToClusters(
        cluster2d(stoneMines, "worldX", "worldY", "id", {
          maxDistance: 2,
          minSize: 2,
        }),
        t.derivedParams.players,
        38,
      ),
      stoneSizeToName,
    );
    const mapStoneMines = ownedClustersToPlayerMap(clusteredStoneMines);

    const forageBushes = t.t.entities.filter(
      (d, $) =>
        d["sage:binId"] === 0 &&
        d["ownerId"] === 0 &&
        op.includes($["h"]["masterGroups"]["Forage Bushes"], d["refMasterId"]),
    );
    const clusteredForageBushes = assignPositionsToOwnedClusters(
      assignOwnersToClusters(
        cluster2d(forageBushes, "worldX", "worldY", "id", {
          maxDistance: 2,
          minSize: 2,
        }),
        t.derivedParams.players,
        38,
      ),
    );
    const mapForageBushes = ownedClustersToPlayerMap(clusteredForageBushes);

    const woodLines = t.t.entities.filter(
      (d, $) =>
        d["sage:binId"] === 0 &&
        d["ownerId"] === 0 &&
        op.includes($["h"]["masterGroups"]["Trees"], d["refMasterId"]),
    );
    const clusteredWoodLines = assignPositionsToOwnedClusters(
      assignOwnersToClusters(
        cluster2d(woodLines, "worldX", "worldY", "id", {
          maxDistance: 3,
          minSize: 3,
        }),
        t.derivedParams.players,
        28,
      ),
    );
    const mapWoodLines = ownedClustersToPlayerMap(clusteredWoodLines);

    const lurables = t.t.entities.filter(
      (d, $) =>
        d["sage:binId"] === 0 &&
        d["ownerId"] === 0 &&
        op.includes($["h"]["masterGroups"]["Lurables"], d["refMasterId"]),
    );
    const clusteredLurables = assignPositionsToOwnedClusters(
      assignOwnersToClusters(
        cluster2d(lurables, "worldX", "worldY", "id", {
          maxDistance: 1,
          minSize: 1,
        }),
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

