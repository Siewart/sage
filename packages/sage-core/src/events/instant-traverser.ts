import { hydrateForRealization, type Hydrated } from "./hydration.js";
import {
  snapshot,
  type GenerationObserver,
  type TraceStage,
} from "@sage/contracts";
import { execution } from "@sage/contracts/execution";

type Traversible<TimeKey extends string> = {
  [K in TimeKey]: number;
};

export type Interpretable<TypeKey extends string> = {
  [K in TypeKey]: string;
};

export type Analyzable<
  TimeKey extends string,
  TypeKey extends string,
> = Traversible<TimeKey> & Interpretable<TypeKey>;

// type InstantParser<
//   InstantInput extends Analyzable<InstantTimeKey, InstantTypeKey>,
//   InstantTimeKey extends string,
//   InstantTypeKey extends string,
//   EventInput extends Interpretable<"type">,
// > = (input: InstantInput) => EventInput;

class InstantAnalyzer<
  const InstantInput extends Analyzable<InstantTimeKey, InstantTypeKey>,
  const InstantTimeKey extends string,
  const InstantTypeKey extends string,
  const EventType extends Interpretable<"type">,
> {
  currentTime = 0;
  currentSource: unknown;
  currentAnalyzer = "";

  constructor(
    private data: Generator<InstantInput>,
    private instantParsers: ReadonlyArray<
      (input: InstantInput | null) => EventType[] | null
    >,
  ) {}

  *nextEvent(): Generator<EventType, void> {
    for (const item of this.data) {
      this.currentTime = Number(
        (item as Record<string, unknown>)["worldTime"] ?? 0,
      );
      this.currentSource = item;
      for (const parser of this.instantParsers) {
        this.currentAnalyzer = parser.name || "anonymous analyzer";
        const result = parser(item);
        if (result !== null && result !== undefined) {
          yield* result;
        }
      }
    }
  }
}

export function createTemplate<
  const Input extends Interpretable<"type">,
  const InterpreterOutput,
  const ClassificationOutput extends { classification: string; value: number },
>(template: {
  // inputTypes: [Input, ...Input[]]
  eventInterpreter: (event: Input) => InterpreterOutput;
  eventClassifier: (
    interpretedEvent: NonNullable<InterpreterOutput>,
  ) => ClassificationOutput;
  eventRealiser: (
    interpretedEvent: Hydrated<NonNullable<InterpreterOutput>>,
    classification: ClassificationOutput,
    previousResponses: string[],
  ) =>
    | { dataUsed: any; text: string }
    | Promise<{ dataUsed: any; text: string }>;
}) {
  return {
    ...template,
    eventRealiser: (
      input: NonNullable<InterpreterOutput>,
      classification: ClassificationOutput,
      previousResponses: string[],
    ) =>
      template.eventRealiser(
        hydrateForRealization(input),
        classification,
        previousResponses,
      ),
  };
}

export function* generatorFromArray<const T extends readonly any[]>(
  items: T,
): Generator<T[number], void, unknown> {
  for (const item of items) {
    yield item;
  }
}

type RealiserResult =
  // | string
  // | Promise<string>
  { dataUsed: any; text: string } | Promise<{ dataUsed: any; text: string }>;

type Template<
  EventTypes extends Interpretable<"type">, // Input from analyzer
  EventGroup extends Interpretable<"type">, // Output from eventInterpreter
  Classification extends string,
> = {
  eventInterpreter: (event: EventTypes) => EventGroup | EventGroup[] | null;
  eventClassifier: (event: EventGroup) => {
    classification: Classification;
    value: number;
  };
  eventRealiser: (
    input: EventGroup,
    classification: { classification: Classification; value: number },
    results: string[],
  ) => RealiserResult; // Takes eventInterpreter output + classification
};

// Overload for array input, should preserve type across the system
export function createEndToEndSystem<
  const InstantTypes extends readonly Analyzable<"worldTime", "type">[],
  const Analyzers extends readonly ((
    input: InstantTypes[number],
  ) => any[] | null)[],
  const Templates extends {
    [K in NonNullable<ReturnType<Analyzers[number]>>[number] extends {
      type: infer T;
    }
      ? T extends string
        ? T
        : never
      : never]: Template<
      Extract<NonNullable<ReturnType<Analyzers[number]>>[number], { type: K }>,
      any,
      any
    >;
  },
>(
  inputData: InstantTypes,
  analyzers: Analyzers,
  templates: Templates,
): {
  instantParser: InstantAnalyzer<
    InstantTypes[number],
    "worldTime",
    "type",
    NonNullable<ReturnType<Analyzers[number]>>[number]
  >;
  templates: Templates;
  inputData: Generator<InstantTypes[number], void, unknown>;
};

export function createEndToEndSystem<
  const InstantTypes extends readonly Analyzable<"worldTime", "type">[],
  const Analyzers extends readonly ((
    input: InstantTypes[number] | null,
  ) => any[] | null)[],
  const Templates extends {
    [K in NonNullable<ReturnType<Analyzers[number]>>[number] extends {
      type: infer T;
    }
      ? T extends string
        ? T
        : never
      : never]: Template<
      Extract<NonNullable<ReturnType<Analyzers[number]>>[number], { type: K }>,
      any,
      any
    >;
  },
>(inputData: InstantTypes, analyzers: Analyzers, templates: Templates) {
  let generator: Generator<InstantTypes[number], void, unknown>;

  if (inputData instanceof Array) {
    generator = generatorFromArray(inputData);
  } else {
    generator = inputData;
  }

  type AnalyzerOutput = NonNullable<ReturnType<Analyzers[number]>>[number];

  const instantParser = new InstantAnalyzer<
    InstantTypes[number],
    "worldTime",
    "type",
    AnalyzerOutput
  >(generator, analyzers);

  return {
    instantParser,
    templates,
    inputData: generator,
  } as const;
}

export class NLGSystem {
  constructor(
    private analyzer: InstantAnalyzer<any, any, any, any>,
    private templates: Record<string, Template<any, any, any>>,
  ) {}

  async generateText(observer?: GenerationObserver) {
    const currentOutput: string[] = [];
    const usedData: unknown[] = [];
    let deferredData: unknown[] = [];
    const started = performance.now();
    let counter = 0;
    let lastCommentary = -Infinity;
    for (const event of this.analyzer.nextEvent()) {
      const gameTimeMs = this.analyzer.currentTime;
      observer?.onProgress?.(gameTimeMs);
      for (const [name, template] of Object.entries(this.templates)) {
        const interpreted = template.eventInterpreter(event);
        if (interpreted === null || interpreted === undefined) continue;
        const id = `r-${++counter}`;
        const step = (stage: TraceStage, data: unknown) =>
          observer?.onStep?.(id, {
            stage,
            data: snapshot(data),
            elapsedMs: performance.now() - started,
          });
        step("source", {
          gameTimeMs,
          input: this.analyzer.currentSource,
          sourceFile: "instant-traverser.ts",
        });
        step("analysis", { analyzer: this.analyzer.currentAnalyzer, event });
        step("interpretation", { template: name, interpreted });
        const classification = template.eventClassifier(interpreted);
        step("classification", classification);
        if (
          (observer?.commentaryIntervalMs ?? 0) > 0 &&
          gameTimeMs - lastCommentary < observer!.commentaryIntervalMs!
        ) {
          step("skipped", {
            reason: "commentary interval",
            gameTimeMs,
            template: name,
          });
          observer?.onRealization?.({
            id,
            template: name,
            gameTimeMs,
            text: "",
            deferred: false,
            decision: "skipped",
            elapsedMs: performance.now() - started,
            realizeMs: 0,
          });
          continue;
        }
        const input = deferredData.length
          ? { ...interpreted, deferredData }
          : interpreted;
        step("planning", {
          input,
          deferredCount: deferredData.length,
          previousResponses: currentOutput,
        });
        const realizeStarted = performance.now();
        try {
          const result = await execution.run(
            { ...execution.getStore(), realizationId: id, emit: step },
            async () => {
              const hydrated = hydrateForRealization(input);
              step("hydration", {
                mode: execution.getStore()?.debugEarlyHydration
                  ? "early-debug"
                  : "realization",
                input: hydrated,
              });
              return template.eventRealiser(
                hydrated,
                classification,
                currentOutput,
              );
            },
          );
          currentOutput.push(result.text);
          usedData.push(result.dataUsed);
          const deferred = result.text.includes("<DEFER>");
          if (deferred) deferredData.push(result.dataUsed);
          else {
            deferredData = [];
            lastCommentary = gameTimeMs;
          }
          step(deferred ? "deferred" : "realization", {
            dataUsed: result.dataUsed,
            text: result.text,
          });
          observer?.onRealization?.({
            id,
            template: name,
            gameTimeMs,
            text: result.text,
            deferred,
            elapsedMs: performance.now() - started,
            realizeMs: performance.now() - realizeStarted,
          });
        } catch (error) {
          step("error", {
            message:
              error instanceof Error ? error.message : "Realization failed",
          });
          observer?.onRealization?.({
            id,
            template: name,
            gameTimeMs,
            text: "",
            deferred: false,
            decision: "failed",
            elapsedMs: performance.now() - started,
            realizeMs: performance.now() - realizeStarted,
          });
          throw error;
        }
        // An observed run yields so IPC/progress and cancellation stay responsive.
        if (observer)
          await new Promise<void>((resolve) => setImmediate(resolve));
      }
    }
    return { currentOutput, usedData };
  }
}
