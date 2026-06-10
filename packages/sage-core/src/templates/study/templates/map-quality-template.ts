import { createTemplate } from "../../../events/instant-traverser.js";
import { Context } from "../study-context.js";
import { initDataSetWithOverrides } from "../study-data-sets.js";
import {
  mapQualityBase,
  mapQualityInsights,
  mapQualityEventStructuring,
  mapQualityAll,
} from "../../../gemini/prompts.js";
import { enhanceDataForLLM } from "./enhanceData.js";
import { formatTime } from "./building-template.js";

interface MapQualityEvent {
  type: "mapQuality";
  worldTime: number;
  minute?: number;
}

const isMapQualityEvent = (event: unknown): event is MapQualityEvent => {
  return (
    typeof event === "object" && event !== null &&
    "type" in event && event.type === "mapQuality" &&
    "worldTime" in event && typeof event.worldTime === "number"
  );
};

export function mapQualityTemplate(
  context: Context<ReturnType<typeof initDataSetWithOverrides>>,
  expertInsights: boolean = false,
) {
  return createTemplate({
    eventInterpreter: (input: { type: string }): MapQualityEvent | null => {
      const syntheticMapQuality: MapQualityEvent | null =
        input.type === "tick" && (input as { minute?: number }).minute === 0
          ? { type: "mapQuality" as const, worldTime: (input as unknown as { worldTime: number }).worldTime }
          : null;
      if (isMapQualityEvent(input) || syntheticMapQuality !== null) {
        const baseEvent = syntheticMapQuality ?? (input as MapQualityEvent);
        const result = enhanceDataForLLM(
          baseEvent,
          context,
          context.getDataSet().descriptor.metadata.binTimes[0]![0],
          undefined,
          expertInsights,
          true, // resourceData
        );

        return result;
      }
      return null;
    },

    eventClassifier: (): { classification: string; value: number } => ({
      classification: "mapQuality",
      value: 1,
    }),

    eventRealiser: (
      input: MapQualityEvent,
      _classification: { classification: string; value: number },
      _previousResponses: string[],
    ): { dataUsed: unknown; text: string } => {
      if (!context) {
        return {
          dataUsed: input,
          text: "Map Analysis: Basic map assessment available.",
        };
      }

      try {
        const dataSet = context.getDataSet();
        const mapInfo = dataSet.derivedParams?.mapInfo;

        if (!mapInfo) {
          return {
            dataUsed: input,
            text: "Map Analysis: Map quality data not yet processed.",
          };
        }

        const player1Resources = mapInfo.players[0];
        const player2Resources = mapInfo.players[1];
        const neutralResources = mapInfo.neutral;

        // key resources per player
        const p1Gold = player1Resources?.goldMines?.length || 0;
        const p2Gold = player2Resources?.goldMines?.length || 0;
        const p1Stone = player1Resources?.stoneMines?.length || 0;
        const p2Stone = player2Resources?.stoneMines?.length || 0;
        const p1Wood = player1Resources?.woodLines?.length || 0;
        const p2Wood = player2Resources?.woodLines?.length || 0;
        const p1Hunt = player1Resources?.huntables?.length || 0;
        const p2Hunt = player2Resources?.huntables?.length || 0;

        // neutral resources
        const neutralGold = neutralResources?.goldMines?.length || 0;
        const neutralStone = neutralResources?.stoneMines?.length || 0;
        const neutralHills = neutralResources?.hills?.length || 0;

        // assess balance
        const goldBalance = Math.abs(p1Gold - p2Gold);
        const stoneBalance = Math.abs(p1Stone - p2Stone);
        const woodBalance = Math.abs(p1Wood - p2Wood);
        const huntBalance = Math.abs(p1Hunt - p2Hunt);

        const isBalanced =
          goldBalance <= 1 &&
          stoneBalance <= 1 &&
          woodBalance <= 2 &&
          huntBalance <= 1;

        const balanceText = isBalanced
          ? "well-balanced resource distribution"
          : "asymmetric resource layout";

        let detailText = "";
        if (neutralGold > 0 || neutralStone > 0) {
          detailText += ` The map features ${neutralGold} contested gold sites and ${neutralStone} contested stone deposits.`;
        }

        if (neutralHills > 0) {
          detailText += ` ${neutralHills} strategic hills provide tactical advantages.`;
        }

        const analysisData = {
          input,
          mapInfo,
          resourceAnalysis: {
            player1: {
              gold: p1Gold,
              stone: p1Stone,
              wood: p1Wood,
              hunt: p1Hunt,
            },
            player2: {
              gold: p2Gold,
              stone: p2Stone,
              wood: p2Wood,
              hunt: p2Hunt,
            },
            neutral: {
              gold: neutralGold,
              stone: neutralStone,
              hills: neutralHills,
            },
            balance: {
              gold: goldBalance,
              stone: stoneBalance,
              wood: woodBalance,
              hunt: huntBalance,
              isBalanced,
            },
          },
        };

        return {
          dataUsed: analysisData,
          text: `Map Analysis: The battlefield presents ${balanceText} between players (Gold: ${p1Gold}/${p2Gold}, Stone: ${p1Stone}/${p2Stone}, Wood: ${p1Wood}/${p2Wood}).${detailText}`,
        };
      } catch (error) {
        console.error("Error analyzing map quality:", error);
        return {
          dataUsed: input,
          text: "Map Analysis: Unable to assess map conditions at this time.",
        };
      }
    },
  });
}

const createMapQualityLLMRealiser = (
  promptFunction: (
    data: object,
    echoJsonInstead?: boolean,
    previousResponses?: string[],
  ) => Promise<string | undefined>,
  _context: Context<ReturnType<typeof initDataSetWithOverrides>>,
) => {
  return async (
    input: MapQualityEvent,
    _classification: { classification: string; value: number },
    previousResponses: string[],
  ): Promise<{ dataUsed: unknown; text: string }> => {
    const enrichedInput = {
      ...input,
      timestamp: formatTime(input.worldTime),
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

export function mapQualityTemplateLLMBase(
  context: Context<ReturnType<typeof initDataSetWithOverrides>>,
  expertInsights: boolean = false,
) {
  return createTemplate({
    eventInterpreter: (input: { type: string }): MapQualityEvent | null => {
      const syntheticMapQuality: MapQualityEvent | null =
        input.type === "tick" && (input as { minute?: number }).minute === 0
          ? { type: "mapQuality" as const, worldTime: (input as unknown as { worldTime: number }).worldTime }
          : null;
      if (isMapQualityEvent(input) || syntheticMapQuality !== null) {
        const baseEvent = syntheticMapQuality ?? (input as MapQualityEvent);
        const result = enhanceDataForLLM(
          baseEvent,
          context,
          context.getDataSet().descriptor.metadata.binTimes[0]![0],
          undefined,
          expertInsights,
          true, // resourceData
        );

        return result;
      }
      return null;
    },
    eventClassifier: (): { classification: string; value: number } => ({
      classification: "mapQuality",
      value: 1,
    }),
    eventRealiser: createMapQualityLLMRealiser(mapQualityBase, context),
  });
}

export function mapQualityTemplateLLMInsights(
  context: Context<ReturnType<typeof initDataSetWithOverrides>>,
  expertInsights: boolean = false,
) {
  return createTemplate({
    eventInterpreter: (input: { type: string }): MapQualityEvent | null => {
      const syntheticMapQuality: MapQualityEvent | null =
        input.type === "tick" && (input as { minute?: number }).minute === 0
          ? { type: "mapQuality" as const, worldTime: (input as unknown as { worldTime: number }).worldTime }
          : null;
      if (isMapQualityEvent(input) || syntheticMapQuality !== null) {
        const baseEvent = syntheticMapQuality ?? (input as MapQualityEvent);
        const result = enhanceDataForLLM(
          baseEvent,
          context,
          context.getDataSet().descriptor.metadata.binTimes[0]![0],
          undefined,
          expertInsights,
          true, // resourceData
        );

        return result;
      }
      return null;
    },
    eventClassifier: (): { classification: string; value: number } => ({
      classification: "mapQuality",
      value: 1,
    }),
    eventRealiser: createMapQualityLLMRealiser(
      mapQualityInsights,
      context,
    ),
  });
}

export function mapQualityTemplateLLMEventStructuring(
  context: Context<ReturnType<typeof initDataSetWithOverrides>>,
  expertInsights: boolean = false,
) {
  return createTemplate({
    eventInterpreter: (input: { type: string }): MapQualityEvent | null => {
      const syntheticMapQuality: MapQualityEvent | null =
        input.type === "tick" && (input as { minute?: number }).minute === 0
          ? { type: "mapQuality" as const, worldTime: (input as unknown as { worldTime: number }).worldTime }
          : null;
      if (isMapQualityEvent(input) || syntheticMapQuality !== null) {
        const baseEvent = syntheticMapQuality ?? (input as MapQualityEvent);
        const result = enhanceDataForLLM(
          baseEvent,
          context,
          context.getDataSet().descriptor.metadata.binTimes[0]![0],
          undefined,
          expertInsights,
          true, // resourceData
        );

        return result;
      }
      return null;
    },
    eventClassifier: (): { classification: string; value: number } => ({
      classification: "mapQuality",
      value: 1,
    }),
    eventRealiser: createMapQualityLLMRealiser(
      mapQualityEventStructuring,
      context,
    ),
  });
}

export function mapQualityTemplateLLMAll(
  context: Context<ReturnType<typeof initDataSetWithOverrides>>,
  expertInsights: boolean = false,
) {
  return createTemplate({
    eventInterpreter: (input: { type: string }): MapQualityEvent | null => {
      const syntheticMapQuality: MapQualityEvent | null =
        input.type === "tick" && (input as { minute?: number }).minute === 0
          ? { type: "mapQuality" as const, worldTime: (input as unknown as { worldTime: number }).worldTime }
          : null;
      if (isMapQualityEvent(input) || syntheticMapQuality !== null) {
        const baseEvent = syntheticMapQuality ?? (input as MapQualityEvent);
        const result = enhanceDataForLLM(
          baseEvent,
          context,
          context.getDataSet().descriptor.metadata.binTimes[0]![0],
          undefined,
          expertInsights,
          true, // resourceData
        );

        return result;
      }
      return null;
    },
    eventClassifier: (): { classification: string; value: number } => ({
      classification: "mapQuality",
      value: 1,
    }),
    eventRealiser: createMapQualityLLMRealiser(mapQualityAll, context),
  });
}

export function mapQualityTemplateLLM(
  context: Context<ReturnType<typeof initDataSetWithOverrides>>,
  expertInsights: boolean = false,
) {
  return createTemplate({
    eventInterpreter: (input: { type: string }): MapQualityEvent | null => {
      const syntheticMapQuality: MapQualityEvent | null =
        input.type === "tick" && (input as { minute?: number }).minute === 0
          ? { type: "mapQuality" as const, worldTime: (input as unknown as { worldTime: number }).worldTime }
          : null;
      if (isMapQualityEvent(input) || syntheticMapQuality !== null) {
        const baseEvent = syntheticMapQuality ?? (input as MapQualityEvent);
        const result = enhanceDataForLLM(
          baseEvent,
          context,
          context.getDataSet().descriptor.metadata.binTimes[0]![0],
          undefined,
          expertInsights,
          true, // resourceData
        );

        return result;
      }
      return null;
    },
    eventClassifier: () => ({ classification: "mapQuality", value: 1 }),
    eventRealiser: createMapQualityLLMRealiser(mapQualityBase, context),
  });
}

