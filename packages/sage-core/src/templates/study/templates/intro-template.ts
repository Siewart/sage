import { createTemplate } from "../../../events/instant-traverser.js";
import { Context } from "../study-context.js";
import { initDataSetWithOverrides } from "../study-data-sets.js";
import { playerData } from "../../../aoe2/expert-insights/player-data.js";
import { civilizationData } from "../../../aoe2/expert-insights/civilization-data.js";
import {
  introductionBase,
  introductionBaseInsights,
  introductionBaseEventStructuring,
  introductionBaseAll,
} from "../../../gemini/prompts.js";
import { enhanceDataForLLM } from "./enhanceData.js";
import { formatTime } from "./building-template.js";

interface IntroductionEvent {
  type: "introduction";
  worldTime: number;
  minute: number;
}

const isIntroductionEvent = (event: unknown): event is IntroductionEvent => {
  return (
    typeof event === "object" && event !== null &&
    "type" in event && event.type === "introduction" &&
    "worldTime" in event && typeof event.worldTime === "number" &&
    "minute" in event && typeof event.minute === "number"
  );
};

export function introTemplate(
  context: Context<ReturnType<typeof initDataSetWithOverrides>>,
  expertInsights: boolean = false,
) {
  return createTemplate({
    eventInterpreter: (input: { type: string }): IntroductionEvent | null => {
      const syntheticIntro: IntroductionEvent | null =
        input.type === "tick" && (input as { minute?: number }).minute === 0
          ? { type: "introduction" as const, worldTime: (input as unknown as { worldTime: number }).worldTime, minute: 0 }
          : null;
      if (isIntroductionEvent(input) || syntheticIntro !== null) {
        const event = syntheticIntro ?? (input as IntroductionEvent);
        const result = enhanceDataForLLM(
          event,
          context,
          context.getDataSet().descriptor.metadata.binTimes[0]![0],
          undefined,
          expertInsights,
        );
        return result;
      }
      return null;
    },

    eventClassifier: (): { classification: string; value: number } => ({
      classification: "intro",
      value: 1,
    }),

    eventRealiser: (
      input: IntroductionEvent,
      _classification: { classification: string; value: number },
      _previousResponses: string[],
    ): { dataUsed: unknown; text: string } => {
      if (!context) {
        return {
          dataUsed: input,
          text: "Game Introduction: This Age of Empires II match analysis begins...",
        };
      }

      try {
        const dataSet = context.getDataSet();
        const players = dataSet.derivedParams?.players;
        const gameInfo = dataSet.derivedParams?.gameInfo;

        if (!players || !gameInfo) {
          return {
            dataUsed: input,
            text: "Game Introduction: Match data not available.",
          };
        }

        const player1 = players[0];
        const player2 = players[1];

        if (!player1 || !player2) {
          return {
            dataUsed: input,
            text: "Game Introduction: Player information not available.",
          };
        }

        const player1Data = Object.values(playerData).find(
          (p) => p.name === player1.playerName,
        );
        const player2Data = Object.values(playerData).find(
          (p) => p.name === player2.playerName,
        );

        const player1CivData =
          civilizationData[
            player1.civilizationId as keyof typeof civilizationData
          ];
        const player2CivData =
          civilizationData[
            player2.civilizationId as keyof typeof civilizationData
          ];

        let intro = `**Game Introduction**: Welcome to this 1v1 Age of Empires II match analysis on ${gameInfo.mapName}.`;

        intro += `\n\n**Players:**`;
        intro += `\n• **${player1.playerName}** (${player1.civilizationName})`;
        if (player1Data) {
          intro += ` - Known for ${player1Data.knownFor}`;
        }
        if (player1CivData && "uniqueUnits" in player1CivData) {
          intro += `\n  The ${player1CivData.name} civilization`;
          if (
            player1CivData.uniqueUnits &&
            player1CivData.uniqueUnits.length > 0 &&
            player1CivData.uniqueUnits[0]
          ) {
            intro += ` featuring the ${player1CivData.uniqueUnits[0].name}`;
          }
        }

        intro += `\n• **${player2.playerName}** (${player2.civilizationName})`;
        if (player2Data) {
          intro += ` - Known for ${player2Data.knownFor}`;
        }
        if (player2CivData && "uniqueUnits" in player2CivData) {
          intro += `\n  The ${player2CivData.name} civilization`;
          if (
            player2CivData.uniqueUnits &&
            player2CivData.uniqueUnits.length > 0 &&
            player2CivData.uniqueUnits[0]
          ) {
            intro += ` featuring the ${player2CivData.uniqueUnits[0].name}`;
          }
        }

        intro += `\n\nLet the battle begin!`;

        return { dataUsed: input, text: intro };
      } catch (error) {
        console.error("Error generating game introduction:", error);
        return {
          dataUsed: input,
          text: "Game Introduction: Unable to load match details at this time.",
        };
      }
    },
  });
}

const createLLMRealiser = (
  promptFunction: (
    data: object,
    echoJsonInstead?: boolean,
    previousResponses?: string[],
  ) => Promise<string | undefined>,
  context: Context<ReturnType<typeof initDataSetWithOverrides>>,
  _withInsights: boolean = false,
) => {
  return async (
    input: IntroductionEvent,
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
      console.error("Error generating LLM introduction:", error);
      const fallbackTemplate = introTemplate(context);
      return fallbackTemplate.eventRealiser(
        input,
        {
          classification: "intro",
          value: 1,
        },
        previousResponses,
      );
    }
  };
};

export function introTemplateLLMBase(
  context: Context<ReturnType<typeof initDataSetWithOverrides>>,
  expertInsights: boolean = false,
) {
  return createTemplate({
    eventInterpreter: (input: { type: string }): IntroductionEvent | null => {
      const syntheticIntro: IntroductionEvent | null =
        input.type === "tick" && (input as { minute?: number }).minute === 0
          ? { type: "introduction" as const, worldTime: (input as unknown as { worldTime: number }).worldTime, minute: 0 }
          : null;
      if (isIntroductionEvent(input) || syntheticIntro !== null) {
        const event = syntheticIntro ?? (input as IntroductionEvent);
        const result = enhanceDataForLLM(
          event,
          context,
          context.getDataSet().descriptor.metadata.binTimes[0]![0],
          undefined,
          expertInsights,
        );
        return result;
      }
      return null;
    },
    eventClassifier: (): { classification: string; value: number } => ({
      classification: "intro",
      value: 1,
    }),
    eventRealiser: createLLMRealiser(introductionBase, context, false),
  });
}

export function introTemplateLLMInsights(
  context: Context<ReturnType<typeof initDataSetWithOverrides>>,
  expertInsights: boolean = true,
) {
  return createTemplate({
    eventInterpreter: (input: { type: string }): IntroductionEvent | null => {
      const syntheticIntro: IntroductionEvent | null =
        input.type === "tick" && (input as { minute?: number }).minute === 0
          ? { type: "introduction" as const, worldTime: (input as unknown as { worldTime: number }).worldTime, minute: 0 }
          : null;
      if (isIntroductionEvent(input) || syntheticIntro !== null) {
        const event = syntheticIntro ?? (input as IntroductionEvent);
        const result = enhanceDataForLLM(
          event,
          context,
          context.getDataSet().descriptor.metadata.binTimes[0]![0],
          undefined,
          expertInsights,
        );
        return result;
      }
      return null;
    },
    eventClassifier: (): { classification: string; value: number } => ({
      classification: "intro",
      value: 1,
    }),
    eventRealiser: createLLMRealiser(
      introductionBaseInsights,
      context,
      true,
    ),
  });
}

export function introTemplateLLMEventStructuring(
  context: Context<ReturnType<typeof initDataSetWithOverrides>>,
  expertInsights: boolean = false,
) {
  return createTemplate({
    eventInterpreter: (input: { type: string }): IntroductionEvent | null => {
      const syntheticIntro: IntroductionEvent | null =
        input.type === "tick" && (input as { minute?: number }).minute === 0
          ? { type: "introduction" as const, worldTime: (input as unknown as { worldTime: number }).worldTime, minute: 0 }
          : null;
      if (isIntroductionEvent(input) || syntheticIntro !== null) {
        const event = syntheticIntro ?? (input as IntroductionEvent);
        const result = enhanceDataForLLM(
          event,
          context,
          context.getDataSet().descriptor.metadata.binTimes[0]![0],
          undefined,
          expertInsights,
        );
        return result;
      }
      return null;
    },
    eventClassifier: (): { classification: string; value: number } => ({
      classification: "intro",
      value: 1,
    }),
    eventRealiser: createLLMRealiser(
      introductionBaseEventStructuring,
      context,
      false,
    ),
  });
}

export function introTemplateLLMAll(
  context: Context<ReturnType<typeof initDataSetWithOverrides>>,
  expertInsights: boolean = true,
) {
  return createTemplate({
    eventInterpreter: (input: { type: string }): IntroductionEvent | null => {
      const syntheticIntro: IntroductionEvent | null =
        input.type === "tick" && (input as { minute?: number }).minute === 0
          ? { type: "introduction" as const, worldTime: (input as unknown as { worldTime: number }).worldTime, minute: 0 }
          : null;
      if (isIntroductionEvent(input) || syntheticIntro !== null) {
        const event = syntheticIntro ?? (input as IntroductionEvent);
        const result = enhanceDataForLLM(
          event,
          context,
          context.getDataSet().descriptor.metadata.binTimes[0]![0],
          undefined,
          expertInsights,
        );
        return result;
      }
      return null;
    },
    eventClassifier: (): { classification: string; value: number } => ({
      classification: "intro",
      value: 1,
    }),
    eventRealiser: createLLMRealiser(introductionBaseAll, context, true),
  });
}

