import {
  Analyzable,
  createTemplate,
} from "../../../events/instant-traverser.js";
import { BattlesEvent, BuildingEvent } from "../study-events.js";
import { initDataSetWithOverrides } from "../study-data-sets.js";
import { Context } from "../study-context.js";
import { StrategyEventOutput } from "./strategy-template.js";
import {
  eventDeferredInsights,
  eventDeferredOnly,
} from "../../../gemini/prompts.js";
import { formatTime } from "./building-template.js";

type StructuredEvents = {
  type: "multipleEvents";
  worldTime: number;
  beginTimeMs: number;
  endTimeMs: number;
  battles?: BattlesEvent[];
  technologies?: BuildingEvent[];
  buildings?: BuildingEvent[];
  strategyUpdates?: StrategyEventOutput[]; // ExpertInsights Only
  other: unknown[];
};

const interpreter = (
  context: Context<ReturnType<typeof initDataSetWithOverrides>>,
) => {
  let battlesInflationCounter = 1;

  return (anyInput: Analyzable<"worldTime", "type">) => {
    if (anyInput.type === "tick" && battlesInflationCounter > 0) {
      battlesInflationCounter--;
    }
    if (
      (battlesInflationCounter <= 0 &&
        context.peekDeferredRealisations().some((i) => i.type === "battles")) ||
      (context.peekDeferredRealisations().length > 0 &&
        anyInput.worldTime - context.getLastDeferredRealisationTime() >
          180_000) ||
      context.peekDeferredRealisations().some((i) => i.type === "endGame")
    ) {
      if (
        context.peekDeferredRealisations().some((i) => i.type === "battles")
      ) {
        battlesInflationCounter = 5; // dont report on battles only for 3 minuteTicks
      }

      const deferredRealisations = context.popDeferredRealisations();
      context.setLastDeferredRealisationTime(anyInput.worldTime);
      const worldTimes = deferredRealisations.map((i) => i.time);
      const beginTimeMs = Math.min(...worldTimes);
      const endTimeMs = Math.max(...worldTimes);

      return {
        type: "multipleEvents",
        worldTime: anyInput.worldTime,
        beginTimeMs,
        endTimeMs,
        battles: deferredRealisations
          .filter((i) => i.type === "battles")
          .map((i) => i.input as BattlesEvent) as BattlesEvent[],
        technologies: deferredRealisations
          .filter((i) => i.type === "technologies")
          .map((i) => i.input as BuildingEvent) as BuildingEvent[],
        buildings: deferredRealisations
          .filter((i) => i.type === "buildingEvent")
          .map((i) => i.input as BuildingEvent) as BuildingEvent[],
        strategyUpdates: deferredRealisations
          .filter((i) => i.type === "strategyUpdate")
          .map((i) => i.input as StrategyEventOutput) as StrategyEventOutput[],
        other: deferredRealisations
          .filter(
            (i) =>
              i.type !== "battles" &&
              i.type !== "technologies" &&
              i.type !== "buildingEvent" &&
              i.type !== "strategyUpdate",
          )
          .map((i) => i.input as StrategyEventOutput) as StrategyEventOutput[],
      } satisfies StructuredEvents;
    }
    if (context.peekDeferredRealisations().some((i) => i.type === "battles")) {
      if (battlesInflationCounter <= 0) {
        battlesInflationCounter = 3; // dont report on battles for 3 minuteTicks
      }
    }
    return null;
  };
};

// LLM-based realiser using Gemini prompts
const createDeferredLLMRealiser = (
  promptFunction: (
    data: object,
    echoJsonInstead?: boolean,
    previousResponses?: string[],
  ) => Promise<string | undefined>,
) => {
  return async (
    input: StructuredEvents,
    _classification: { classification: string; value: number },
    previousResponses: string[],
  ): Promise<{ dataUsed: unknown; text: string }> => {
    try {
      const enrichedInput = {
        ...input,
        timestamp: formatTime(input.endTimeMs),
      };
      const llmResponse = await promptFunction(
        enrichedInput,
        false,
        previousResponses,
      );
      // if (!llmResponse) {
      //   throw new Error("LLM returned undefined response");
      // }
      return {
        dataUsed: enrichedInput,
        text: llmResponse ?? "<NO_RESPONSE>",
      };
    } catch (error) {
      console.error("Error generating LLM deferred analysis:", error);
      // Fallback to template-based realiser
      return {
        dataUsed: input,
        text: `Deferred realisation of:
- Battles: ${input.battles?.length ? input.battles.map((e) => e.type).join(", ") : "No battles"}
- Technologies: ${input.technologies?.length ? input.technologies.map((e) => e.type).join(", ") : "No technologies"}
- Buildings: ${input.buildings?.length ? input.buildings.map((e) => e.type).join(", ") : "No buildings"}
- Strategy Updates: ${input.strategyUpdates?.length ? input.strategyUpdates.map((e) => e.type).join(", ") : "No strategy updates"}`,
      };
    }
  };
};

export const deferredTemplateLLMInsights = (
  context: Context<ReturnType<typeof initDataSetWithOverrides>>,
) =>
  createTemplate({
    eventInterpreter: interpreter(context),
    eventClassifier: (_input) => ({
      classification: "multipleEvents",
      value: 1,
    }),
    eventRealiser: createDeferredLLMRealiser(eventDeferredInsights),
  });

export const deferredTemplateLLMStructuring = (
  context: Context<ReturnType<typeof initDataSetWithOverrides>>,
) =>
  createTemplate({
    eventInterpreter: interpreter(context),
    eventClassifier: (_input) => ({
      classification: "multipleEvents",
      value: 1,
    }),
    eventRealiser: createDeferredLLMRealiser(eventDeferredOnly),
  });

export const deferredTemplate = (
  context: Context<ReturnType<typeof initDataSetWithOverrides>>,
) =>
  createTemplate({
    eventInterpreter: interpreter(context),
    eventClassifier: (_input) => ({
      classification: "multipleEvents",
      value: 1,
    }),
    eventRealiser: (
      input: StructuredEvents,
      _: unknown,
      _previousResponses: string[],
    ) => ({
      dataUsed: input,
      text: `Deferred realisation of:
- Battles: ${input.battles?.length ? input.battles.map((e) => e.type).join(", ") : "No battles"}
- Technologies: ${input.technologies?.length ? input.technologies.map((e) => e.type).join(", ") : "No technologies"}
- Buildings: ${input.buildings?.length ? input.buildings.map((e) => e.type).join(", ") : "No buildings"}
- Strategy Updates: ${input.strategyUpdates?.length ? input.strategyUpdates.map((e) => e.type).join(", ") : "No strategy updates"}`,
    }),
  });

