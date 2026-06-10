import { Struct } from "arquero/dist/types/table/types.js";
import {
  createEndToEndSystem,
  NLGSystem,
} from "../../events/instant-traverser.js";
import { BaseContext } from "./study-context.js";
import { initDataSetWithOverrides } from "./study-data-sets.js";
import {
  damageEventAnalyzer,
  strategyDetectionAnalyzer,
  buildingConstructionAnalyzer,
  tickPassthrough,
} from "./study-signal-analyzers.js";
import {
  battlesTemplate,
  battlesTemplateLLMAll,
  battlesTemplateLLMBase,
  battlesTemplateLLMEventStructuring,
  battlesTemplateLLMInsights,
} from "./templates/battles-template.js";
import {
  strategyTemplate,
  strategyTemplateLLMAll,
  strategyTemplateLLMInsights,
} from "./templates/strategy-template.js";
import {
  introTemplate,
  introTemplateLLMAll,
  introTemplateLLMBase,
  introTemplateLLMEventStructuring,
  introTemplateLLMInsights,
} from "./templates/intro-template.js";
import {
  mapQualityTemplate,
  mapQualityTemplateLLMAll,
  mapQualityTemplateLLMBase,
  mapQualityTemplateLLMEventStructuring,
  mapQualityTemplateLLMInsights,
} from "./templates/map-quality-template.js";
import {
  buildingTemplate,
  buildingTemplateLLMAll,
  buildingTemplateLLMBase,
  buildingTemplateLLMEventStructuring,
  buildingTemplateLLMInsights,
} from "./templates/building-template.js";
import {
  DSDamageInstant,
  DSDeathInstant,
  DSLifeCycleInstant,
  DSMinuteTickInstant,
  EnhancedStudySystemInput,
} from "../../aoe2/types/arrow/instants.js";
import {
  endgameTemplate,
  endgameTemplateLLMAll,
  endgameTemplateLLMBase,
  endgameTemplateLLMEventStructuring,
  endgameTemplateLLMInsights,
} from "./templates/endgame-template.js";
import {
  deferredTemplate,
  deferredTemplateLLMInsights as deferredTemplateLLMAll,
  deferredTemplateLLMStructuring,
} from "./templates/deferredTemplate.js";
import { deferTemplate } from "./templates/defer.js";

export interface EnhancedStudySystemConfig {
  useGeminiAI?: boolean;
  moduleConfig: "base" | "eventStructuring" | "expertInsights" | "all";
  timeoutMs?: number;
}


const DEFAULT_CONFIG: EnhancedStudySystemConfig = {
  useGeminiAI: process.env["DISABLE_LLM"] === "false",
  moduleConfig: "all",
  timeoutMs: 60000,
};

// Combine the instant parser, signal analyzers and templates together for one match.
export class EnhancedStudySystem {
  private nlgSystem: NLGSystem;
  private dataSet: ReturnType<typeof initDataSetWithOverrides>;
  private baseContext: BaseContext<ReturnType<typeof initDataSetWithOverrides>>;
  private allResponses: string[] = [];
  private allRequests: unknown[] = [];
  private config: EnhancedStudySystemConfig;
  private inputData: Array<
    DSDamageInstant | DSDeathInstant | DSLifeCycleInstant
  >;
  public readonly name: string;

  constructor(
    configName: string,
    inputData: Array<DSDamageInstant | DSDeathInstant | DSLifeCycleInstant>,
    dataSet: ReturnType<typeof initDataSetWithOverrides>,
    config: Partial<EnhancedStudySystemConfig> = {},
  ) {
    this.name = `${dataSet.descriptor.name} - ${configName}`;
    this.inputData = inputData;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.dataSet = dataSet; // already carries mapQuality
    this.baseContext = new BaseContext(this.dataSet);

    const system = this.createFullInstantSystem();

    this.nlgSystem = new NLGSystem(system.instantParser, system.templates);
  }

  private injectMinuteTicks(
    inputData: Array<DSDamageInstant | DSDeathInstant | DSLifeCycleInstant>,
  ): EnhancedStudySystemInput[] {
    if (inputData.length === 0) return [];

    const minTime = Math.min(...inputData.map((d) => d.worldTime));
    const maxTime = Math.max(...inputData.map((d) => d.worldTime));

    const minuteTicks: DSMinuteTickInstant[] = [];
    // Add minute 0 tick for intro/map quality
    minuteTicks.push({
      type: "minuteTick",
      worldTime: minTime,
      minute: 0,
    });

    // Add ticks every 1 minute for strategy detection
    for (let time = minTime; time <= maxTime; time += 60000) {
      // Every 1 minute
      const minute = Math.floor(time / 60000);
      if (minute === 0) continue; // Skip minute 0 tick, already added
      minuteTicks.push({
        type: "minuteTick",
        worldTime: time,
        minute: minute,
      });
    }

    // Add a tick 1ms after the last binTime in the descriptor
    const binTimes = this.dataSet.descriptor.metadata.binTimes;
    if (Array.isArray(binTimes) && binTimes.length > 0) {
      const lastBinTime = binTimes[binTimes.length - 1]![1];
      minuteTicks.push({
        type: "finalTick",
        worldTime: lastBinTime,
        minute: Math.floor(lastBinTime / 60000),
      });
    }

    return [...inputData, ...minuteTicks].sort(
      (a, b) => a.worldTime - b.worldTime,
    );
  }

  private createFullInstantSystem() {
    // Inject minute ticks for strategy detection and intro/map quality
    // TODO: this is not the right location to inject ticks if the data were truly streamed, but it works for now
    const inputWithTicks = this.injectMinuteTicks(this.inputData);

    const useLLM = this.config.useGeminiAI;
    switch (this.config.moduleConfig) {
      case "base":
        return createEndToEndSystem(
          inputWithTicks,
          [
            damageEventAnalyzer(this.baseContext),
            buildingConstructionAnalyzer(this.baseContext),
            tickPassthrough(this.baseContext),
          ] as const,
          {
            battles: useLLM
              ? battlesTemplateLLMBase(this.context)
              : battlesTemplate(this.context),
            // strategy: useLLM
            //   ? strategyTemplateLLMBase(this.context)
            //   : strategyTemplate(this.context),
            intro: useLLM
              ? introTemplateLLMBase(this.baseContext, false)
              : introTemplate(this.baseContext),
            mapQuality: useLLM
              ? mapQualityTemplateLLMBase(this.baseContext, false)
              : mapQualityTemplate(this.baseContext),
            buildings: useLLM
              ? buildingTemplateLLMBase(this.baseContext)
              : buildingTemplate(this.baseContext),
            endGame: useLLM
              ? endgameTemplateLLMBase(this.baseContext)
              : endgameTemplate(this.baseContext),
          },
        );
      case "eventStructuring":
        return createEndToEndSystem(
          inputWithTicks,
          [
            damageEventAnalyzer(this.baseContext, true),
            buildingConstructionAnalyzer(this.baseContext),
            tickPassthrough(this.baseContext),
          ] as const,
          {
            intro: useLLM
              ? introTemplateLLMEventStructuring(this.baseContext)
              : introTemplate(this.baseContext),
            mapQuality: useLLM
              ? mapQualityTemplateLLMEventStructuring(this.baseContext)
              : mapQualityTemplate(this.baseContext),
            battles: useLLM
              ? deferTemplate(
                  "battles",
                  battlesTemplateLLMEventStructuring(this.baseContext),
                  this.baseContext,
                )
              : deferTemplate(
                  "battles",
                  battlesTemplate(this.baseContext),
                  this.baseContext,
                ),
            // strategy: useLLM
            //   ? strategyTemplateLLMEventStructuring(this.context)
            //   : strategyTemplate(this.context),
            buildings: useLLM
              ? deferTemplate(
                  "buildingEvent",
                  buildingTemplateLLMEventStructuring(this.baseContext),
                  this.baseContext,
                )
              : deferTemplate(
                  "buildingEvent",
                  buildingTemplate(this.baseContext),
                  this.baseContext,
                ),
            endGame: useLLM
              ? deferTemplate(
                  "endGame",
                  endgameTemplateLLMEventStructuring(this.baseContext),
                  this.baseContext,
                )
              : deferTemplate(
                  "endGame",
                  endgameTemplate(this.baseContext),
                  this.baseContext,
                ),

            deferredRealiser: useLLM
              ? deferredTemplateLLMStructuring(this.baseContext)
              : deferredTemplate(this.baseContext),
          },
        );
      case "expertInsights":
        return createEndToEndSystem(
          inputWithTicks,
          [
            damageEventAnalyzer(this.baseContext),
            strategyDetectionAnalyzer(this.baseContext),
            buildingConstructionAnalyzer(this.baseContext),
            tickPassthrough(this.baseContext),
          ] as const,
          {
            battles: useLLM
              ? battlesTemplateLLMInsights(this.context)
              : battlesTemplate(this.context, true),
            strategy: useLLM
              ? strategyTemplateLLMInsights(this.context)
              : strategyTemplate(this.context),
            intro: useLLM
              ? introTemplateLLMInsights(this.baseContext, true)
              : introTemplate(this.baseContext, true),
            mapQuality: useLLM
              ? mapQualityTemplateLLMInsights(this.baseContext, true)
              : mapQualityTemplate(this.baseContext, true),
            buildings: useLLM
              ? buildingTemplateLLMInsights(this.baseContext)
              : buildingTemplate(this.baseContext),
            endGame: useLLM
              ? endgameTemplateLLMInsights(this.baseContext)
              : endgameTemplate(this.baseContext),
          },
        );
      case "all":
        return createEndToEndSystem(
          inputWithTicks,
          [
            damageEventAnalyzer(this.baseContext, true),
            strategyDetectionAnalyzer(this.baseContext),
            buildingConstructionAnalyzer(this.baseContext),
            tickPassthrough(this.baseContext),
          ] as const,
          {
            intro: useLLM
              ? introTemplateLLMAll(this.baseContext, true)
              : introTemplate(this.baseContext, true),
            mapQuality: useLLM
              ? mapQualityTemplateLLMAll(this.baseContext, true)
              : mapQualityTemplate(this.baseContext, true),
            battles: useLLM
              ? deferTemplate(
                  "battles",
                  battlesTemplateLLMAll(this.context),
                  this.baseContext,
                )
              : deferTemplate(
                  "battles",
                  battlesTemplate(this.context, true),
                  this.baseContext,
                ),
            strategy: useLLM
              ? deferTemplate(
                  "strategyUpdate",
                  strategyTemplateLLMAll(this.context),
                  this.baseContext,
                )
              : deferTemplate(
                  "strategyUpdate",
                  strategyTemplate(this.context),
                  this.baseContext,
                ),
            buildings: useLLM
              ? deferTemplate(
                  "buildingEvent",
                  buildingTemplateLLMAll(this.baseContext),
                  this.baseContext,
                )
              : deferTemplate(
                  "buildingEvent",
                  buildingTemplate(this.baseContext),
                  this.baseContext,
                ),
            endGame: useLLM
              ? deferTemplate(
                  "endGame",
                  endgameTemplateLLMAll(this.baseContext),
                  this.baseContext,
                )
              : deferTemplate(
                  "endGame",
                  endgameTemplate(this.baseContext),
                  this.baseContext,
                ),
            deferredRealiser: useLLM
              ? deferredTemplateLLMAll(this.baseContext)
              : deferredTemplate(this.baseContext),
          },
        );
    }
  }

  async generateAnalysis(): Promise<{
    currentOutput: string[];
    usedData: unknown[];
  }> {
    const tStart = process.hrtime.bigint();
    const allNarratives = await this.nlgSystem.generateText();
    const durationMs = Number(process.hrtime.bigint() - tStart) / 1_000_000;
    console.log(
      `generated ${allNarratives.currentOutput.length} sections in ${durationMs.toFixed(1)}ms`,
    );

    return allNarratives;
  }

  async generateText(): Promise<{
    currentOutput: string[];
    usedData: unknown[];
  }> {
    return await this.generateAnalysis();
  }

  get context() {
    return this.baseContext;
  }

  getDebugInfo() {
    return {
      requests: this.allRequests,
      responses: this.allResponses,
    };
  }
}

export function createEnhancedBattleAnalysisSystem(
  dataSet: ReturnType<typeof initDataSetWithOverrides>,
  config: Partial<EnhancedStudySystemConfig> = {},
) {
  const damageDeathEvents = dataSet.t.events
    .filter(
      (d: Struct) =>
        (d["sage:modelType"] === "damage" || d["sage:modelType"] === "death") &&
        d["objectPlayerId"] > 0 &&
        d["subjectPlayerId"] > 0,
    )
    .select(
      "sage:modelType",
      "worldTime",
      "worldX",
      "worldY",
      "worldZ",
      "objectPlayerId",
      "subjectPlayerId",
      "objectEntity",
      "subjectEntity",
    )
    .objects() as Array<{
    "sage:modelType": "damage" | "death";
    worldTime: number;
    worldX: number;
    worldY: number;
    worldZ: number;
    objectPlayerId: number;
    subjectPlayerId: number;
    objectEntity: number;
    subjectEntity: number;
  }>;

  const buildingEvents = dataSet.t.events
    .filter(
      (d: Struct) =>
        d["sage:modelType"] === "lifeCycle" &&
        (d["tag"] === "underConstruction" || d["tag"] === "constructed") &&
        d["subjectPlayerId"] > 0,
    )
    .select(
      "sage:modelType",
      "tag",
      "worldTime",
      "worldX",
      "worldY",
      "worldZ",
      "subjectPlayerId",
      "subjectEntity",
    )
    .objects() as Array<{
    "sage:modelType": "lifeCycle";
    tag: "underConstruction" | "constructed";
    worldTime: number;
    worldX: number;
    worldY: number;
    worldZ: number;
    subjectPlayerId: number;
    subjectEntity: number;
  }>;

  const damageDeathInstants = damageDeathEvents.map((event) => ({
    type: event["sage:modelType"] as "damage" | "death",
    worldTime: event.worldTime,
    worldX: event.worldX,
    worldY: event.worldY,
    worldZ: event.worldZ,
    objectPlayerId: event.objectPlayerId,
    subjectPlayerId: event.subjectPlayerId,
    objectEntity: event.objectEntity,
    subjectEntity: event.subjectEntity,
  }));

  const buildingInstants = buildingEvents.map((event) => ({
    type: "lifeCycle" as const,
    tag: event.tag,
    worldTime: event.worldTime,
    worldX: event.worldX,
    worldY: event.worldY,
    worldZ: event.worldZ,
    subjectPlayerId: event.subjectPlayerId,
    subjectEntity: event.subjectEntity,
  })) as DSLifeCycleInstant[];

  const allEvents = [...damageDeathInstants, ...buildingInstants].sort(
    (a, b) => a.worldTime - b.worldTime,
  );

  return new EnhancedStudySystem(
    config.moduleConfig ?? "all",
    allEvents,
    dataSet,
    config,
  );
}

