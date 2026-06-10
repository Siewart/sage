import { createTemplate } from "../../../events/instant-traverser.js";
import { Context, PlayerStrategy } from "../study-context.js";
import { detectStrategies, GameState } from "../../../fuzzy/strategy-detector.js";
import { strategyDetectors } from "../../../fuzzy/strategies.js";
import {
  eventBase,
  eventInsights,
  eventEventStructuring,
  eventAll,
} from "../../../gemini/prompts.js";
import { initDataSetWithOverrides } from "../study-data-sets.js";
import { formatTime } from "./building-template.js";
import { GameStateExtractor } from "../../../gamestate-extractor.js";

export interface StrategyEventInput {
  type: "strategyUpdate";
  playerId: number;
  // playerName: string;
  minute: number;
  worldTime: number;
  strategy: PlayerStrategy;
}
export interface StrategyEventOutput extends StrategyEventInput {
  playerName: string;
}

interface StrategyDetectionTickInput {
  type: "strategyDetectionTick";
  playerId: number;
  minute: number;
  worldTime: number;
}

const eventInterpreter =
  (context: Context<ReturnType<typeof initDataSetWithOverrides>>) =>
  (input: { type: string }): StrategyEventOutput | null => {
    if (input.type === "strategyDetectionTick") {
      const i = input as StrategyDetectionTickInput;
      const detectedStrategy = detectPlayerStrategy(
        context,
        i.playerId,
        i.worldTime,
        i.minute,
      );

      if (!detectedStrategy) {
        return null;
      }

      // track strategy evolution state in context for future detections.
      context.updatePlayerStrategy(i.playerId, detectedStrategy);

      return {
        type: "strategyUpdate",
        playerId: i.playerId,
        minute: i.minute,
        worldTime: i.worldTime,
        strategy: detectedStrategy,
        playerName: getPlayerName(context, i.playerId),
      };
    }

    if (input.type === "strategyUpdate") {
      const i = input as StrategyEventInput;
      return { ...i, playerName: getPlayerName(context, i.playerId) };
    }
    return null;
  };

const baseRealiser = (
  input: StrategyEventOutput,
  _classification: { classification: string; value: number },
  _previousResponses: string[],
): { dataUsed: unknown; text: string } => {
  const { playerName, minute, strategy } = input;

  const confidencePercent = Math.round(strategy.confidence * 100);
  const baseMessage = `Strategy Update (${minute}min): ${playerName} is executing a ${strategy.type} strategy with ${confidencePercent}% confidence.`;

  let indicatorText = "";
  if (strategy.indicators.length > 0) {
    indicatorText = ` Evidence: ${strategy.indicators.join(", ")}.`;
  }

  return { dataUsed: input, text: baseMessage + indicatorText };
};

export function strategyTemplate(
  context: Context<ReturnType<typeof initDataSetWithOverrides>>,
) {
  return createTemplate({
    eventInterpreter: eventInterpreter(context),

    eventClassifier: (input: StrategyEventOutput) => {
      const { minute, worldTime } = input;
      const timeInMinutes = worldTime / 60000;
      const hasMatchingDetectors = strategyDetectors.some((detector) => {
        if (detector.timeRegion) {
          return (
            timeInMinutes >= detector.timeRegion.trapezoid[0] &&
            timeInMinutes <= detector.timeRegion.trapezoid[3]
          );
        }
        return false;
      });

      const baseValue = hasMatchingDetectors ? 0.9 : 0.7;

      if (minute <= 5) {
        return { classification: "earlyStrategy", value: baseValue };
      } else if (minute <= 15) {
        return { classification: "midStrategy", value: baseValue * 0.9 };
      } else {
        return { classification: "lateStrategy", value: baseValue * 0.8 };
      }
    },

    eventRealiser: baseRealiser,
  });
}

const createStrategyLLMRealiser = (
  promptFunction: (
    data: object,
    echoJsonInstead?: boolean,
    previousResponses?: string[],
  ) => Promise<string | undefined>,
) => {
  return async (
    input: StrategyEventOutput,
    _classification: { classification: string; value: number },
    previousResponses: string[],
  ): Promise<{ dataUsed: unknown; text: string }> => {
    try {
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
    } catch (error) {
      console.error("Error generating LLM strategy analysis:", error);
      return baseRealiser(
        input,
        {
          classification: "earlyStrategy",
          value: 0.7,
        },
        previousResponses,
      );
    }
  };
};

const getPlayerName = (
  context: Context<ReturnType<typeof initDataSetWithOverrides>>,
  playerId: number,
) => {
  const result =
    context?.getDataSet().derivedParams.players[playerId - 1]?.playerName;
  if (!result) {
    throw new Error(`Player name not found for playerId ${playerId}`);
  }
  return result;
};

function detectPlayerStrategy(
  context: Context<ReturnType<typeof initDataSetWithOverrides>>,
  playerId: number,
  currentTime: number,
  currentMinute: number,
): PlayerStrategy | null {
  const dataSet = context.getDataSet();
  const extractor = new GameStateExtractor(dataSet);

  try {
    const gameState: GameState = {
      ...extractor.extractGameState(currentTime, playerId),
      playerId,
    };

    const matches = detectStrategies(gameState, strategyDetectors, 0.3);
    if (matches.length === 0) {
      return null;
    }

    const bestMatch = matches[0]!;
    const currentStrategy = context.getPlayerStrategy(playerId);

    if (
      !currentStrategy ||
      currentStrategy.type !== bestMatch.strategyName ||
      currentStrategy.confidence < bestMatch.confidence
    ) {
      return {
        type: bestMatch.strategyName,
        confidence: bestMatch.confidence,
        firstSeenTime: currentTime,
        indicators: [
          bestMatch.breakdown.matchedIndex
            ? bestMatch.breakdown.breakdowns[bestMatch.breakdown.matchedIndex!]
            : undefined,
        ],
      };
    }
  } catch (error) {
    console.error(
      `Error extracting GameState for player ${playerId} at minute ${currentMinute}:`,
      error,
    );
  }

  return null;
}

export function strategyTemplateLLMBase(
  context: Context<ReturnType<typeof initDataSetWithOverrides>>,
) {
  return createTemplate({
    eventInterpreter: eventInterpreter(context),
    eventClassifier: (input: StrategyEventOutput) => {
      const { minute, worldTime } = input;
      const timeInMinutes = worldTime / 60000;
      const hasMatchingDetectors = strategyDetectors.some((detector) => {
        if (detector.timeRegion) {
          return (
            timeInMinutes >= detector.timeRegion.trapezoid[0] &&
            timeInMinutes <= detector.timeRegion.trapezoid[3]
          );
        }
        return false;
      });
      const baseValue = hasMatchingDetectors ? 0.9 : 0.7;
      if (minute <= 12) {
        return { classification: "earlyStrategy", value: baseValue };
      } else if (minute <= 22) {
        return { classification: "midStrategy", value: baseValue * 0.9 };
      } else {
        return { classification: "lateStrategy", value: baseValue * 0.8 };
      }
    },
    eventRealiser: createStrategyLLMRealiser(eventBase),
  });
}

export function strategyTemplateLLMInsights(
  context: Context<ReturnType<typeof initDataSetWithOverrides>>,
) {
  return createTemplate({
    eventInterpreter: eventInterpreter(context),
    eventClassifier: (input: StrategyEventOutput) => {
      const { minute, worldTime } = input;
      const timeInMinutes = worldTime / 60000;
      const hasMatchingDetectors = strategyDetectors.some((detector) => {
        if (detector.timeRegion) {
          return (
            timeInMinutes >= detector.timeRegion.trapezoid[0] &&
            timeInMinutes <= detector.timeRegion.trapezoid[3]
          );
        }
        return false;
      });
      const baseValue = hasMatchingDetectors ? 0.9 : 0.7;
      if (minute <= 12) {
        return { classification: "earlyStrategy", value: baseValue };
      } else if (minute <= 22) {
        return { classification: "midStrategy", value: baseValue * 0.9 };
      } else {
        return { classification: "lateStrategy", value: baseValue * 0.8 };
      }
    },
    eventRealiser: createStrategyLLMRealiser(eventInsights),
  });
}

export function strategyTemplateLLMEventStructuring(
  context: Context<ReturnType<typeof initDataSetWithOverrides>>,
) {
  return createTemplate({
    eventInterpreter: eventInterpreter(context),
    eventClassifier: (input: StrategyEventOutput) => {
      const { minute, worldTime } = input;
      const timeInMinutes = worldTime / 60000;
      const hasMatchingDetectors = strategyDetectors.some((detector) => {
        if (detector.timeRegion) {
          return (
            timeInMinutes >= detector.timeRegion.trapezoid[0] &&
            timeInMinutes <= detector.timeRegion.trapezoid[3]
          );
        }
        return false;
      });
      const baseValue = hasMatchingDetectors ? 0.9 : 0.7;
      if (minute <= 12) {
        return { classification: "earlyStrategy", value: baseValue };
      } else if (minute <= 22) {
        return { classification: "midStrategy", value: baseValue * 0.9 };
      } else {
        return { classification: "lateStrategy", value: baseValue * 0.8 };
      }
    },
    eventRealiser: createStrategyLLMRealiser(eventEventStructuring),
  });
}

export function strategyTemplateLLMAll(
  context: Context<ReturnType<typeof initDataSetWithOverrides>>,
) {
  return createTemplate({
    eventInterpreter: eventInterpreter(context),
    eventClassifier: (input: StrategyEventOutput) => {
      const { minute, worldTime } = input;
      const timeInMinutes = worldTime / 60000;
      const hasMatchingDetectors = strategyDetectors.some((detector) => {
        if (detector.timeRegion) {
          return (
            timeInMinutes >= detector.timeRegion.trapezoid[0] &&
            timeInMinutes <= detector.timeRegion.trapezoid[3]
          );
        }
        return false;
      });
      const baseValue = hasMatchingDetectors ? 0.9 : 0.7;
      if (minute <= 12) {
        return { classification: "earlyStrategy", value: baseValue };
      } else if (minute <= 22) {
        return { classification: "midStrategy", value: baseValue * 0.9 };
      } else {
        return { classification: "lateStrategy", value: baseValue * 0.8 };
      }
    },
    eventRealiser: createStrategyLLMRealiser(eventAll),
  });
}

