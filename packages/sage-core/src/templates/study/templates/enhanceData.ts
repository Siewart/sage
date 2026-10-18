import { GameState } from "../../../gamestate-extractor.js";
import { Context } from "../study-context.js";
import { initDataSetWithOverrides } from "../study-data-sets.js";
import { GameStateExtractor } from "../../../gamestate-extractor.js";
import { idToAge } from "../../../aoe2/ids.js";

export function getPlayerGameState(
  context: Context<ReturnType<typeof initDataSetWithOverrides>>,
  playerId: number,
  timeMs: number,
): GameState | null {
  try {
    const dataSet = context.getDataSet();
    const extractor = new GameStateExtractor(dataSet);
    return extractor.extractGameState(timeMs, playerId);
  } catch (error) {
    console.warn(
      `Failed to get game state for player ${playerId} at time ${timeMs}:`,
      error,
    );
    return null;
  }
}

function removeUnitCounts(
  unitCounts:
    | Record<string, { countForward: number; countTotal: number }>
    | undefined,
): Record<string, { countForward: number; countTotal: number }> | undefined {
  if (!unitCounts) return undefined;

  const cleanedCounts: Record<
    string,
    { countForward: number; countTotal: number }
  > = {};
  for (const [unit, count] of Object.entries(unitCounts)) {
    if (["", "Flare"].includes(unit)) continue;
    if (count.countTotal > 0) {
      cleanedCounts[unit] = count;
    }
  }
  return Object.keys(cleanedCounts).length > 0 ? cleanedCounts : undefined;
}

function cleanTechnologies(
  technologies:
    | {
        [techName: string]:
          | "researched"
          | "researching"
          | "queued"
          | "unavailable"
          | "available";
      }
    | undefined,
):
  | {
      [techName: string]: "researched" | "researching" | "queued";
    }
  | undefined {
  if (!technologies) return undefined;

  const cleanedTechnologies: Record<
    string,
    "researched" | "researching" | "queued"
  > = {};
  for (const [tech, state] of Object.entries(technologies)) {
    if (tech === "" || tech.startsWith("Tech_")) {
      continue;
    }
    if (state !== "unavailable" && state !== "available") {
      // Reporting note: the LLM sometimes confuses available with researched
      cleanedTechnologies[tech] = state;
    }
  }
  return Object.keys(cleanedTechnologies).length > 0
    ? cleanedTechnologies
    : undefined;
}

export function enhanceDataForLLM<T>(
  anyObject: T,
  context: Context<ReturnType<typeof initDataSetWithOverrides>>,
  timeMs: number,
  endTimeMs: number | undefined = undefined,
  expertInsights: boolean = false,
  resourceData: boolean = false,
) {
  return {
    ...anyObject,
    startPlayerInfo: getPlayersInfo(context, timeMs, expertInsights),
    endPlayerInfo: endTimeMs
      ? getPlayersInfo(context, endTimeMs, expertInsights)
      : undefined,
    mapInfo: getMapInfo(context, resourceData),
  };
}

function getCleanedState(
  playerId: 1 | 2,
  timeMs: number,
  context: Context<ReturnType<typeof initDataSetWithOverrides>>,
) {
  const state = getPlayerGameState(context, playerId, timeMs);
  const cleanedUnitCounts = removeUnitCounts(state?.unitCounts);
  const cleanedBuildingCounts = removeUnitCounts(state?.buildingCounts);
  const cleanedTechnologies = cleanTechnologies(state?.technologies);

  return {
    age: state?.age ? (idToAge[state.age] ?? "unknown") : "unknown",
    unitCount: cleanedUnitCounts ?? {},
    buildingCount: cleanedBuildingCounts ?? {},
    villagerDistribution: state?.villagerDistribution ?? {},
    technologies: cleanedTechnologies ?? {},
    totalEcoUnits: state?.totalEcoUnits ?? 0,
    totalMilitaryUnits: state?.totalMilitaryUnits ?? 0,
    score: state?.score ?? 0,
  };
}

function getPlayerInfo(
  playerId: 1 | 2,
  context: Context<ReturnType<typeof initDataSetWithOverrides>>,
  timeMs: number,
  withInsights: boolean = false,
) {
  return {
    playerInfo: {
      color:
        context.getDataSet().derivedParams?.players?.[playerId - 1]?.color ??
        "unknown",
      name:
        context.getDataSet().derivedParams?.players?.[playerId - 1]
          ?.playerName ?? `Player ${playerId}`,
      id: playerId,
      civilization:
        context.getDataSet().derivedParams?.players?.[playerId - 1]
          ?.civilizationName ?? "unknown",
      looksLikeStrategy: withInsights // Reporting note: previously it said "detectedStrategy", which was realised by the LLM as "detected strategy", which is not as if it's a human watching the game
        ? {
            type: context.getPlayerStrategy(playerId)?.type,
            firstSeenTime: context.getPlayerStrategy(playerId)?.firstSeenTime,
          }
        : undefined,
      gameState: getCleanedState(playerId, timeMs, context),
    },
    expertInsights: withInsights
      ? context.getDataSet().derivedParams?.expertInsights
      : undefined,
  };
}

function getPlayersInfo(
  context: Context<ReturnType<typeof initDataSetWithOverrides>>,
  timeMs: number,
  withInsights: boolean = false,
) {
  return [
    getPlayerInfo(1, context, timeMs, withInsights),
    getPlayerInfo(2, context, timeMs, withInsights),
  ];
}

function getMapInfo(
  context: Context<ReturnType<typeof initDataSetWithOverrides>>,
  resourceData: boolean = false,
) {
  const mapInfo = context.getDataSet().derivedParams?.mapInfo;
  if (!mapInfo) {
    return undefined;
  }
  function getPlayerMapResources(playerIndex: number) {
    return {
      forageBushes: cleanResourceEntry(
        mapInfo.players[playerIndex]?.forageBushes,
      ),
      goldMines: cleanResourceEntry(mapInfo.players[playerIndex]?.goldMines),
      stoneMines: cleanResourceEntry(mapInfo.players[playerIndex]?.stoneMines),
      huntables: cleanResourceEntry(mapInfo.players[playerIndex]?.huntables),
      lurables: cleanResourceEntry(mapInfo.players[playerIndex]?.lurables),
      herdables: cleanResourceEntry(mapInfo.players[playerIndex]?.herdables),
      hills: cleanResourceEntry(mapInfo.players[playerIndex]?.hills),
      woodLines: cleanResourceEntry(mapInfo.players[playerIndex]?.woodLines),
    };
  }

  return {
    mapName: context.getDataSet().derivedParams.gameInfo.mapName,
    mapWidth: context.getDataSet().derivedParams.gameInfo.mapWidth,
    mapHeight: context.getDataSet().derivedParams.gameInfo.mapHeight,
    player1: resourceData ? getPlayerMapResources(0) : undefined,
    player2: resourceData ? getPlayerMapResources(1) : undefined,
  };
}

export function cleanResourceEntry<T extends { ids: number[] }>(
  resourceEntry: T[] | undefined,
): Omit<T, "ids">[] | undefined {
  // remove all unitIds
  if (!resourceEntry) return undefined;
  return resourceEntry.map(({ ids: _ids, ...rest }) => rest);
}

// TODO: Add position coordinates AND position name to resources and events
