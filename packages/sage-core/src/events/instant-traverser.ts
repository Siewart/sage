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
  constructor(
    private data: Generator<InstantInput>,
    private instantParsers: ReadonlyArray<
      (input: InstantInput | null) => EventType[] | null
    >,
  ) {}

  *nextEvent(): Generator<EventType, void> {
    for (const item of this.data) {
      for (const parser of this.instantParsers) {
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
    interpretedEvent: NonNullable<InterpreterOutput>,
    classification: ClassificationOutput,
    previousResponses: string[],
  ) =>
    | { dataUsed: any; text: string }
    | Promise<{ dataUsed: any; text: string }>;
}) {
  return template;
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
>(
  inputData: InstantTypes,
  analyzers: Analyzers,
  templates: Templates,
) {
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

  async generateText() {
    const currentOutput: string[] = [];
    const usedData: unknown[] = [];
    let deferredData: unknown[] = [];
    for (const event of this.analyzer.nextEvent()) {
      // take the event and run it through all templates
      for (const template of Object.values(this.templates)) {
        const interpretedEvent = template.eventInterpreter(event);
        if (interpretedEvent !== null && interpretedEvent !== undefined) {
          const classification = template.eventClassifier(interpretedEvent);
          const realisedText = template.eventRealiser(
            deferredData.length > 0
              ? { ...interpretedEvent, deferredData }
              : interpretedEvent,
            classification,
            currentOutput,
          );

          if (realisedText instanceof Promise) {
            const res = await realisedText;
            const text = res.text;
            currentOutput.push(text);
            // if (text instanceof Object) {
            usedData.push(res.dataUsed);
            if (text.includes("<DEFER>")) {
              console.log(`Skipping empty output for deferred entry`);
              deferredData.push(res.dataUsed);
            } else {
              deferredData = [];
            }
            // }
          } else {
            currentOutput.push(realisedText.text);
            usedData.push(realisedText.dataUsed);
            if (realisedText.text.includes("<DEFER>")) {
              console.log(`Skipping empty output for deferred entry`);
              deferredData.push(realisedText.dataUsed);
            } else {
              deferredData = [];
            }
          }
        }
      }
    }
    return { currentOutput, usedData };
  }
}

