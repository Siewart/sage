import { mapQuality } from "../../aoe2/map-quality.js";
import { addGameInfoParams, addPlayerParams } from "../../aoe2/player-info.js";
import { playerData } from "../../aoe2/expert-insights/player-data.js";
import { DataSet } from "../../utility/data-set.js";
import { civilizationData } from "../../aoe2/expert-insights/civilization-data.js";

export function initDataSet(descriptorPath: string) {
  const dataSet = new DataSet(descriptorPath);
  const dsWithGameInfo = addGameInfoParams(dataSet);
  const dsWithPlayerParams = addPlayerParams(dsWithGameInfo);
  const dsWithMapQuality = mapQuality(dsWithPlayerParams);
  return dsWithMapQuality;
}

export function initDataSetWithOverrides(
  descriptorPath: string,
  players: Array<keyof typeof playerData | undefined> = [],
) {
  const ds = initDataSet(descriptorPath);
  // Override player names with expert data
  ds.derivedParams.players.forEach((player, index) => {
    if (players[index]) {
      player.playerName = playerData[players[index]].name;
    }
  });
  const withInsights = ds.addParams("expertInsights", (_dt) => ({
    playerTrivia: {
      // Hard coded for study
      1: playerData[players[0]!],
      2: playerData[players[1]!],
    },
    civilizationInfo: {
      [ds.derivedParams.players[0]!.civilizationName]:
        civilizationData[
          ds.derivedParams.players[0]!
            .civilizationId as keyof typeof civilizationData
        ]!,
      [ds.derivedParams.players[1]!.civilizationName]:
        civilizationData[
          ds.derivedParams.players[1]!
            .civilizationId as keyof typeof civilizationData
        ]!,
    },
  }));
  return withInsights;
}
