import { clustersToTable } from "../../src/data/cluster.js";
import {
  assignOwnersToClusters,
  assignPositionsToOwnedClusters,
} from "../../src/aoe2/map-quality/core.js";
test("empty resource/terrain clusters remain empty through ownership and position analysis", () => {
  const input = clustersToTable([]).params({
    dp: { gameInfo: { mapWidth: 120, mapHeight: 120 } },
  });
  const owned = assignOwnersToClusters(
    input,
    [
      { playerId: 1, startX: 20, startY: 20 },
      { playerId: 2, startX: 100, startY: 100 },
    ] as any,
    38,
  );
  expect(owned.numRows()).toBe(0);
  expect(owned.columnNames()).toContain("ids");
  expect(assignPositionsToOwnedClusters(owned).objects()).toEqual([]);
});
