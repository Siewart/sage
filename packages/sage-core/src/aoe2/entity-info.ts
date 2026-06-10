import { Struct } from "arquero/dist/types/table/types.js";
import { escape } from "arquero";
import { DataSet } from "../utility/data-set.js";

export const getEntityInfos = (
  // TODO: Normalize naming convention
  dataSet: DataSet,
  entityId: Array<number>,
  time: number,
  entityValues: Array<string> = [],
  masterValues: Array<string> = [],
) => {
  const windowId = dataSet.timeToWindow(time);
  return dataSet.t.entities
    .filter(
      escape(
        (e: Struct) =>
          entityId.includes(e["id"]) && e["sage:binId"] === windowId,
      ),
    )
    .select("refMasterId", "id", "sage:binId", "ownerId", ...entityValues)
    .lookup(
      dataSet.t.masters,
      [
        ["refMasterId", "sage:binId", "ownerId"],
        ["id", "sage:binId", "playerId"],
      ],
      ["stringId", ...masterValues],
    )
    .lookup(dataSet.t.strings, ["stringId", "id"], ["string"])
    .rename({
      string: "name",
      id: "entityId",
    })
    .objects() as Array<{
    refMasterId: number;
    entityId: number;
    stringId: number;
    name: string;
  }>;
};

export const getTechInfo = (
  // TODO: Normalize naming convention
  dataSet: DataSet,
  researchId: number,
  playerId: number,
  time: number,
  researchStateValues: Array<string> = [],
) => {
  const windowId = dataSet.timeToWindow(time);
  return dataSet.t.researchStates
    .filter(
      escape(
        (e: Struct) =>
          researchId === e["researchId"] &&
          e["sage:binId"] === windowId &&
          playerId === e["playerId"],
      ),
    )
    .select("stringId", "researchId", "playerId", ...researchStateValues)
    .lookup(dataSet.t.strings, ["stringId", "id"], ["string"])
    .rename({
      string: "name",
    })
    .object() as {
    stringId: number;
    researchId: number;
    playerId: number;
    name: string;
  };
};
