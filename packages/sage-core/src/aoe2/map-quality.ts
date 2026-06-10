import {
  DataSet,
  DefaultAoE2BinnedTables,
  DefaultAoE2Tables,
  ParamOf,
  ParamsOf,
  TablesOf,
} from "../utility/data-set.js";
import { PlayerParams } from "./types/derived/playerParams.js";
import { addMapQuality, MapInfo } from "./map-quality/core.js";

export { makeLocationList, getNamedLocation } from "./map-quality/location-labels.js";
export {
  addMapQuality,
  assignOwnersToClusters,
  assignPositionsToOwnedClusters,
  cluster2d,
  goldSizeToName,
  hillSizeToName,
  stoneSizeToName,
} from "./map-quality/core.js";

export type { MapInfo, MapQuality, ResourceQuality } from "./map-quality/core.js";

// Compatibility alias for existing callers.
export function mapQuality<
  T extends DefaultAoE2Tables,
  B extends DefaultAoE2BinnedTables,
  P extends ParamsOf<[ParamOf<"players", Array<PlayerParams>>]>,
  D extends TablesOf<[]>,
>(
  dataSet: DataSet<T, B, P, D>,
): DataSet<T, B, P & ParamsOf<[ParamOf<"mapInfo", MapInfo>]>, D> {
  return addMapQuality(dataSet);
}
