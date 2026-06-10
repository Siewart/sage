import { addGameInfoParams } from "../../../aoe2/player-info.js";
import { Analyzable } from "../../../events/instant-traverser.js";
import { Context } from "../study-context.js";

export type DeferredRealisation<T> = {
  time: number;
  type: string;
  input: T;
  classification: {
    classification: string;
    value: number;
  };
};

export function deferTemplate<
  const Input extends Analyzable<"worldTime", "type">,
  const InterpreterOutput,
  const ClassificationOutput extends { classification: string; value: number },
>(
  type: string,
  template: {
    // inputTypes: [Input, ...Input[]]
    eventInterpreter: (event: Input) => InterpreterOutput;
    eventClassifier: (
      interpretedEvent: NonNullable<InterpreterOutput>,
    ) => ClassificationOutput;
    eventRealiser: (
      interpretedEvent: NonNullable<InterpreterOutput>,
      classification: ClassificationOutput,
      previousResponses: string[],
    ) =>
      | { dataUsed: unknown; text: string }
      | Promise<{ dataUsed: unknown; text: string }>;
  },
  context: Context<ReturnType<typeof addGameInfoParams>>,
) {
  return {
    eventInterpreter: (event: Input) => {
      const interpreted = template.eventInterpreter(event);
      if (interpreted === null || interpreted === undefined) {
        return null;
      }
      const classified = template.eventClassifier(interpreted);

      const deferredTemplate = {
        time: event.worldTime,
        type,
        input: interpreted,
        classification: classified,
      } satisfies DeferredRealisation<InterpreterOutput>;
      context.addDeferredRealisation(deferredTemplate);

      return null;
    },
    eventClassifier: template.eventClassifier,
    eventRealiser: (
      _: NonNullable<InterpreterOutput>,
      __: ClassificationOutput,
      ___: string[],
    ) => {
      throw new Error("Deferred realisation is not supposed to be called.");
    },
  };
}

