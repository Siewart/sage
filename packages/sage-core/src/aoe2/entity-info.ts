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
  return dataSet.query
    .namedEntities({
      bin: windowId,
      ids: entityId,
      columns: entityValues,
      masterColumns: masterValues,
    })
    .map(({ id, ...rest }) => ({ ...rest, entityId: id })) as unknown as Array<{
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
  const [row] = dataSet.query.namedResearchStates({
    bin: windowId,
    playerId,
    researchIds: [researchId],
    columns: researchStateValues,
  });
  return row as unknown as {
    stringId: number;
    researchId: number;
    playerId: number;
    name: string;
  };
};
