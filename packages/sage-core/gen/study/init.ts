import { DataSet } from "../../src/utility/data-set.js";
import { mapQuality } from "../../src/aoe2/map-quality.js";
import { addGameInfoParams, addPlayerParams } from "../../src/aoe2/player-info.js";
import { playerData } from "../../src/aoe2/expert-insights/player-data.js";
import { civilizationData } from "../../src/aoe2/expert-insights/civilization-data.js";

export type PlayerKey = keyof typeof playerData;
export type ModuleConfig = "all" | "base" | "eventStructuring" | "expertInsights";

export interface DatasetConfig {
  key: "T1" | "T2" | "T3" | "T4";
  label: string;
  descriptorPath: string;
  players: [PlayerKey, PlayerKey];
}

export const DATASET_CONFIGS: DatasetConfig[] = [
  {
    key: "T1",
    label: "Kotd4-Groups S06G3-Mbl vs Vinchester",
    descriptorPath: "data/Kotd4-Groups S06G3-Mbl vs Vinchester/descriptor.json",
    players: ["vinchester", "mbl"],
  },
  {
    key: "T2",
    label: "Kotd4-Groups S06G3-Mr_Yo vs Daut",
    descriptorPath: "data/Kotd4-Groups S06G3-Mr_Yo vs Daut/descriptor.json",
    players: ["yo", "daut"],
  },
  {
    key: "T3",
    label: "Kotd4-Groups S17G2-Tatoh vs Nicov",
    descriptorPath: "data/Kotd4-Groups S17G2-Tatoh vs Nicov/descriptor.json",
    players: ["tatoh", "nicov"],
  },
  {
    key: "T4",
    label: "Kotd4-SF S02G3-TheViper vs Jordan",
    descriptorPath: "data/Kotd4-SF S02G3-TheViper vs Jordan/descriptor.json",
    players: ["viper", "jordan"],
  },
];

export const MODULE_CONFIGS: { id: string; config: ModuleConfig }[] = [
  { id: "M1", config: "all" },
  { id: "M2", config: "base" },
  { id: "M3", config: "eventStructuring" },
  { id: "M4", config: "expertInsights" },
];

export function makeDataSetFromPath(descriptorPath: string) {
  const ds = mapQuality(addPlayerParams(addGameInfoParams(new DataSet(descriptorPath))));
  return ds.addParams("expertInsights", (_dt) => ({
    playerTrivia: {} as Record<number, (typeof playerData)[PlayerKey]>,
    civilizationInfo: {
      [ds.derivedParams.players[0]?.civilizationName ?? "unknown"]:
        civilizationData[ds.derivedParams.players[0]?.civilizationId as keyof typeof civilizationData],
      [ds.derivedParams.players[1]?.civilizationName ?? "unknown"]:
        civilizationData[ds.derivedParams.players[1]?.civilizationId as keyof typeof civilizationData],
    },
  }));
}

export function makeDataSet(cfg: DatasetConfig, anonymize: boolean = true) {
  const ds = mapQuality(addPlayerParams(addGameInfoParams(new DataSet(cfg.descriptorPath))));
  if (anonymize) {
    ds.derivedParams.players.forEach((player, i) => {
      const key = cfg.players[i];
      if (key) player.playerName = playerData[key].name;
    });
  }
  return ds.addParams("expertInsights", (_dt) => ({
    playerTrivia: {
      1: playerData[cfg.players[0]],
      2: playerData[cfg.players[1]],
    },
    civilizationInfo: {
      [ds.derivedParams.players[0]!.civilizationName]:
        civilizationData[ds.derivedParams.players[0]!.civilizationId as keyof typeof civilizationData]!,
      [ds.derivedParams.players[1]!.civilizationName]:
        civilizationData[ds.derivedParams.players[1]!.civilizationId as keyof typeof civilizationData]!,
    },
  }));
}
