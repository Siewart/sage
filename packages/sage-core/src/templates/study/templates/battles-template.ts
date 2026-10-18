import { prepareHydration } from "../../../events/hydration.js";
import { createTemplate } from "../../../events/instant-traverser.js";
import { BattlesEvent } from "../study-events.js";
import {
  eventBase,
  eventInsights,
  eventEventStructuring,
  eventAll,
} from "../../../gemini/prompts.js";
import { enhanceDataForLLM } from "./enhanceData.js";
import { initDataSetWithOverrides } from "../study-data-sets.js";
import { Context } from "../study-context.js";
import {
  makeLocationList,
  getNamedLocation,
} from "../../../aoe2/map-quality.js";
import { summarizeBattle, summarizeOngoingBattle } from "./battle-summary.js";
export { classifyBattleFacts } from "./battle-summary.js";

const formatTime = (timeMs: number): string => {
  const totalSeconds = Math.floor(timeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const formatCoordinates = (worldX: number, worldY: number): string => {
  return ` (${Math.round(worldX)}, ${Math.round(worldY)})`;
};

const formatTimestampInfo = (timeMs: number): string => {
  return ` [${timeMs}ms | ${formatTime(timeMs)}]`;
};

const getLocationName = (
  context: Context<ReturnType<typeof initDataSetWithOverrides>>,
  worldX: number,
  worldY: number,
): string => {
  try {
    const dataSet = context.getDataSet();
    const locationList = makeLocationList(dataSet);
    return getNamedLocation(locationList, worldX, worldY);
  } catch (error) {
    console.warn(
      "Failed to get named location, falling back to coordinates:",
      error,
    );
    return `(${worldX}, ${worldY})`;
  }
};

const mkInterpreter =
  (
    context: Context<ReturnType<typeof initDataSetWithOverrides>>,
    expertInsights = false,
  ) =>
  (input: BattlesEvent) => {
    if (!input || input.type !== "battles" || !input.clusters) return null;
    const { startTime, endTime } = input;
    const finished = input.clusters.map((battle) =>
      summarizeBattle(battle, context),
    );
    const ongoing = (input.ongoingBattleClusters ?? []).map((battle) =>
      summarizeOngoingBattle(battle, context, input.startTime),
    );
    const facts = {
      type: input.type,
      worldTime: input.worldTime,
      startTime: input.startTime,
      endTime: input.endTime,
      totalDamageEvents: finished.reduce(
        (sum, battle) => sum + battle.facts.damageEventCount,
        0,
      ),
      totalCasualtiesPlayer1: finished.reduce(
        (sum, battle) =>
          sum +
          Object.values(battle.facts.player1.casualties).reduce(
            (a, b) => a + b,
            0,
          ),
        0,
      ),
      totalCasualtiesPlayer2: finished.reduce(
        (sum, battle) =>
          sum +
          Object.values(battle.facts.player2.casualties).reduce(
            (a, b) => a + b,
            0,
          ),
        0,
      ),
      finishedBattles: finished.map((battle) => battle.facts),
      ongoingBattles: ongoing.map((battle) => battle.facts),
    };
    const strategies = new Map(
      [1, 2].map((id) => [id, context.getPlayerStrategy(id)]),
    );
    const capturedContext = Object.create(context) as typeof context;
    capturedContext.getPlayerStrategy = (id) => strategies.get(id);
    return prepareHydration(facts, () =>
      enhanceDataForLLM(
        {
          ...facts,
          finishedBattles: finished.map((battle) => ({
            ...battle.hydrate(),
            location: getLocationName(
              context,
              battle.facts.worldX,
              battle.facts.worldY,
            ),
          })),
          ongoingBattles: ongoing.map((battle) => ({
            ...battle.hydrate(),
            location: getLocationName(
              context,
              battle.facts.worldX,
              battle.facts.worldY,
            ),
          })),
        },
        capturedContext,
        startTime,
        endTime,
        expertInsights,
      ),
    );
  };

type RealizedBattles = import("../../../events/hydration.js").Hydrated<
  NonNullable<ReturnType<ReturnType<typeof mkInterpreter>>>
>;

const battlesClassifier = (
  input: NonNullable<ReturnType<ReturnType<typeof mkInterpreter>>>,
) => {
  const totalBattles = input.finishedBattles.length;
  const raidCount = input.finishedBattles.filter(
    (b) => b.fightType === "raid",
  ).length;
  const majorBattleCount = input.finishedBattles.filter(
    (b) => b.fightType === "major battle",
  ).length;

  if (totalBattles === 1) {
    return { classification: "isolated conflict", value: 0.9 };
  } else if (raidCount > totalBattles / 2) {
    return { classification: "raid sequence", value: 0.8 };
  } else if (majorBattleCount > 0) {
    return { classification: "major engagement", value: 0.8 };
  } else {
    return { classification: "series of skirmishes", value: 0.7 };
  }
};

const realiser = (
  input: RealizedBattles,
  classification: { classification: string; value: number },
  _previousResponses: string[],
): {
  dataUsed: RealizedBattles;
  text: string;
} => {
  const { classification: overallType } = classification;
  const startTimeMinutes = Math.floor(input.startTime / 60000);
  const endTimeMinutes = Math.floor(input.endTime / 60000);
  const duration = endTimeMinutes - startTimeMinutes;

  let description = "";

  if (input.finishedBattles.length === 1) {
    const battle = input.finishedBattles[0]!;
    const battleTime = Math.floor(battle.startTimeMs / 60000);
    const battleEndTime = Math.floor(battle.endTimeMs / 60000);
    const coordStr = formatCoordinates(battle.worldX, battle.worldY);
    const timestampStr = formatTimestampInfo(battle.startTimeMs);
    description += `Between ${battleTime} and ${battleEndTime} minutes, a ${battle.fightType} occurred at ${battle.location}${coordStr}${timestampStr}. `;
  } else {
    description += `Between ${startTimeMinutes} and ${endTimeMinutes} minutes (${duration} minute${duration !== 1 ? "s" : ""}), ${overallType} unfolded with ${input.finishedBattles.length} separate engagements. `;
  }

  input.finishedBattles.forEach((battle, index) => {
    const battleTime = Math.floor(battle.startTimeMs / 60000);
    const coordStr = formatCoordinates(battle.worldX, battle.worldY);
    const timestampStr = formatTimestampInfo(battle.startTimeMs);

    if (input.finishedBattles.length > 1) {
      description += `\n\nEngagement ${index + 1} (${battleTime} min)${coordStr}${timestampStr}: `;
    }

    const p1Units = Object.entries(battle.player1.participants);
    const p2Units = Object.entries(battle.player2.participants);

    if (p1Units.length > 0) {
      description += `Player 1 brought ${p1Units.map(([unit, count]) => `${count} ${unit}${count > 1 ? "s" : ""}`).join(", ")}. `;
    }

    if (p2Units.length > 0) {
      description += `Player 2 brought ${p2Units.map(([unit, count]) => `${count} ${unit}${count > 1 ? "s" : ""}`).join(", ")}. `;
    }

    const p1Casualties = Object.entries(battle.player1.casualties);
    const p2Casualties = Object.entries(battle.player2.casualties);

    if (p1Casualties.length > 0) {
      description += `Player 1 lost ${p1Casualties.map(([unit, count]) => `${count} ${unit}${count > 1 ? "s" : ""}`).join(", ")}. `;
    }

    if (p2Casualties.length > 0) {
      description += `Player 2 lost ${p2Casualties.map(([unit, count]) => `${count} ${unit}${count > 1 ? "s" : ""}`).join(", ")}. `;
    }
  });

  return { dataUsed: input, text: description.trim() };
};

const createBattlesLLMRealiser = (
  promptFunction: (
    data: object,
    echoJsonInstead?: boolean,
    previousResponses?: string[],
  ) => Promise<string | undefined>,
) => {
  return async (
    input: RealizedBattles,
    _classification: { classification: string; value: number },
    previousResponses: string[],
  ): Promise<{ dataUsed: unknown; text: string }> => {
    const enrichedInput = {
      ...input,
      timestamp: formatTime(input.endTime),
    };
    const llmResponse = await promptFunction(
      enrichedInput,
      false,
      previousResponses,
    );
    if (!llmResponse) {
      throw new Error("LLM returned undefined response");
    }

    return {
      dataUsed: enrichedInput,
      text: llmResponse,
    };
  };
};
export const battlesTemplateLLMBase = (
  context: Context<ReturnType<typeof initDataSetWithOverrides>>,
) =>
  createTemplate({
    eventInterpreter: mkInterpreter(context, false),
    eventClassifier: battlesClassifier,
    eventRealiser: createBattlesLLMRealiser(eventBase),
  });

export const battlesTemplateLLMInsights = (
  context: Context<ReturnType<typeof initDataSetWithOverrides>>,
) =>
  createTemplate({
    eventInterpreter: mkInterpreter(context, true),
    eventClassifier: battlesClassifier,
    eventRealiser: createBattlesLLMRealiser(eventInsights),
  });

export const battlesTemplateLLMEventStructuring = (
  context: Context<ReturnType<typeof initDataSetWithOverrides>>,
) =>
  createTemplate({
    eventInterpreter: mkInterpreter(context, false),
    eventClassifier: battlesClassifier,
    eventRealiser: createBattlesLLMRealiser(eventEventStructuring),
  });

export const battlesTemplateLLMAll = (
  context: Context<ReturnType<typeof initDataSetWithOverrides>>,
) =>
  createTemplate({
    eventInterpreter: mkInterpreter(context, true),
    eventClassifier: battlesClassifier,
    eventRealiser: createBattlesLLMRealiser(eventAll),
  });

export const battlesTemplate = (
  context: Context<ReturnType<typeof initDataSetWithOverrides>>,
  expertInsights: boolean = false,
) =>
  createTemplate({
    eventInterpreter: mkInterpreter(context, expertInsights),
    eventClassifier: battlesClassifier,
    eventRealiser: realiser,
  });
