import {
  Analyzable,
  createTemplate,
} from "../../../events/instant-traverser.js";
import { initDataSetWithOverrides } from "../study-data-sets.js";
import { Context } from "../study-context.js";
import {
  eventBase,
  eventInsights,
  eventEventStructuring,
  eventAll,
} from "../../../gemini/prompts.js";
import { escape } from "arquero";
import { Params } from "arquero/dist/types/table/types.js";
import { formatTime } from "./building-template.js";

const interpreter = (
  context: Context<ReturnType<typeof initDataSetWithOverrides>>,
  _withInsights: boolean = false,
) => {
  return (input: Analyzable<"worldTime", "type">) => {
    if (input.type === "finalTick") {
      const windowId = context.getDataSet().timeToWindow(input.worldTime);
      const player1Data = context
        .getDataSet()
        .t.players.filter(
          escape((d: Params) => d["sage:binId"] === windowId && d["id"] === 1),
        )
        .select("resigned")
        .objects() as Array<{ resigned: boolean }>;
      const player2Data = context
        .getDataSet()
        .t.players.filter(
          escape((d: Params) => d["sage:binId"] === windowId && d["id"] === 2),
        )
        .select("resigned")
        .objects() as Array<{ resigned: boolean }>;
      const player1Resigned =
        player1Data.length > 0 ? player1Data[0]!.resigned : false;
      const player2Resigned =
        player2Data.length > 0 ? player2Data[0]!.resigned : false;
      let winner: number | null = null;

      if (player1Resigned && !player2Resigned) winner = 2;
      else if (player2Resigned && !player1Resigned) winner = 1;
      // return enhanceDataForLLM(
      //   {
      //     winner,
      //   },
      //   context,
      //   input.worldTime,
      //   undefined,
      //   withInsights,
      // );
      return {
        type: "gameEnded",
        winner,
        winnerName: getPlayerName(winner ?? 0, context),
        worldTime: input.worldTime,
      };
    }
    return null;
  };
};

const createEndgameLLMRealiser = (
  promptFunction: (
    data: object,
    echoJsonInstead?: boolean,
    previousResponses?: string[],
  ) => Promise<string | undefined>,
) => {
  return async (
    input: { worldTime: number; },
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
      console.error("Error generating LLM endgame analysis:", error);
      return {
        dataUsed: input,
        text: "Game ended.",
      };
    }
  };
};

export const endgameTemplateLLMBase = (
  context: Context<ReturnType<typeof initDataSetWithOverrides>>,
) =>
  createTemplate({
    eventInterpreter: interpreter(context),
    eventClassifier: (_input): { classification: string; value: number } => ({
      classification: "gameEnded",
      value: 1,
    }),
    eventRealiser: createEndgameLLMRealiser(eventBase),
  });

export const endgameTemplateLLMInsights = (
  context: Context<ReturnType<typeof initDataSetWithOverrides>>,
) =>
  createTemplate({
    eventInterpreter: interpreter(context),
    eventClassifier: (_input): { classification: string; value: number } => ({
      classification: "gameEnded",
      value: 1,
    }),
    eventRealiser: createEndgameLLMRealiser(eventInsights),
  });

export const endgameTemplateLLMEventStructuring = (
  context: Context<ReturnType<typeof initDataSetWithOverrides>>,
) =>
  createTemplate({
    eventInterpreter: interpreter(context),
    eventClassifier: (_input): { classification: string; value: number } => ({
      classification: "gameEnded",
      value: 1,
    }),
    eventRealiser: createEndgameLLMRealiser(eventEventStructuring),
  });

export const endgameTemplateLLMAll = (
  context: Context<ReturnType<typeof initDataSetWithOverrides>>,
) =>
  createTemplate({
    eventInterpreter: interpreter(context),
    eventClassifier: (_input): { classification: string; value: number } => ({
      classification: "gameEnded",
      value: 1,
    }),
    eventRealiser: createEndgameLLMRealiser(eventAll),
  });

export const endgameTemplateLLM = endgameTemplateLLMBase;

export const endgameTemplate = (
  context: Context<ReturnType<typeof initDataSetWithOverrides>>,
) =>
  createTemplate({
    eventInterpreter: interpreter(context),
    eventClassifier: (_input): { classification: string; value: number } => ({
      classification: "gameEnded",
      value: 1,
    }),
    eventRealiser: (
      interpretedEvent: { worldTime: number; winner: number | null, player1Resigned?: boolean, player2Resigned?: boolean },
      _classification: unknown,
      _previousResponses: string[],
    ) => ({
      dataUsed: interpretedEvent,
      text: `Game ended.\nWinner: ${interpretedEvent.winner ? `Player ${interpretedEvent.winner}` : "None"}\nPlayer 1 resigned: ${interpretedEvent.player1Resigned}\nPlayer 2 resigned: ${interpretedEvent.player2Resigned}`,
    }),
  });

const getPlayerName = (
  playerId: number,
  context: Context<ReturnType<typeof initDataSetWithOverrides>>,
) => {
  const result =
    context?.getDataSet().derivedParams.players[playerId - 1]?.playerName;
  if (!result) {
    throw new Error(`Player name not found for playerId ${playerId}`);
  }
  return result;
};

