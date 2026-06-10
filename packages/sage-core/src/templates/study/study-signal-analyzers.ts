import {
  DSDamageInstant,
  DSDeathInstant,
  DSLifeCycleInstant,
  DSTechStatusInstant,
  EnhancedStudySystemInput,
} from "../../aoe2/types/arrow/instants.js";
import { SequenceFilter, SequenceDBSCAN } from "../../events/instant-parser.js";
import { detectStrategies, GameState } from "../../fuzzy/strategy-detector.js";
import { strategyDetectors } from "../../fuzzy/strategies.js";
import { Analyzable } from "../../events/instant-traverser.js";
import { euclidean } from "../../functions/euclidean.js";
import { Context, PlayerStrategy } from "./study-context.js";
import { GameStateExtractor } from "../../gamestate-extractor.js";
import { DataSet } from "../../utility/data-set.js";
import { initDataSetWithOverrides } from "./study-data-sets.js";
import { BattlesEvent, RawBattleEvent } from "./study-events.js";

// Instant
// Instant Parsers
// Events output

// TODO: Move these magic hardcoded numbers to a config object with defaults
const MAX_TILE_DISTANCE = 14 as const;
const MAX_MS_DISTANCE = 60_000 as const;
const MAX_SILENCE_TIME = 60_000 as const; // 1 minute
const MIN_GAP_DURATION = 30_000 as const; // 30 seconds

// Factory function to create damage event analyzer with encapsulated state
const createDamageEventAnalyzer = () => {
  // Encapsulate the global state within the closure
  let lastProcessedTime = 0;
  let lastReturnTime = 0;
  let hadNoOpenClusters = true;
  const updateLastProcessedTime = (time: number) => {
    lastProcessedTime = Math.max(time, lastProcessedTime);
  };

  const dmgEventScan = new SequenceDBSCAN<EnhancedStudySystemInput>(
    (l, r) =>
      (l.type === "damage" || l.type === "death") &&
      (r.type === "damage" || r.type === "death") &&
      euclidean([l.worldX, l.worldY], [r.worldX, r.worldY]) < MAX_TILE_DISTANCE,
    10,
    (l, r) => Math.abs(l.worldTime - r.worldTime) < MAX_MS_DISTANCE,
    (l, r) => l.worldTime - r.worldTime,
    (
      // Can be used to return closed clusters early
      openClusters,
      closedClusters,
    ) => {
      const lastOpenActivity = openClusters.reduce<number>(
        (p, c) => Math.max(c[c.length - 1]!.worldTime, p),
        0,
      );
      const lastActivity = closedClusters.reduce<number>(
        (p, c) => Math.max(c[c.length - 1]!.worldTime, p),
        lastOpenActivity,
      );
      if (lastActivity - lastProcessedTime > MAX_SILENCE_TIME) {
        lastReturnTime = lastProcessedTime;
        return true;
      }
      return false;
    },
    (openClusters, closedClusters) => {
      const lastActivity = closedClusters.reduce<number>(
        (p, c) => Math.max(c[c.length - 1]!.worldTime, p),
        0,
      );
      if (lastActivity < 0) {
        console.log(closedClusters.map((c) => c[c.length - 1]!.worldTime));
      }
      hadNoOpenClusters = openClusters.length === 0 || hadNoOpenClusters;
      if (
        hadNoOpenClusters &&
        closedClusters.length > 0 &&
        lastActivity - lastReturnTime > MIN_GAP_DURATION
      ) {
        console.log(lastActivity - lastReturnTime, ">", MIN_GAP_DURATION);
        hadNoOpenClusters = false; // Reset after returning clusters
        lastReturnTime = lastActivity;
        return true; // Return closed clusters
      }
      return false;
    },
  );

  return {
    dmgEventScan,
    updateLastProcessedTime,
  };
};

// TODO: Move to own file
const analyzerFromSequencer = <
  Input extends Analyzable<"worldTime", "type">,
  Output,
>(
  scan: SequenceDBSCAN<Input> | SequenceFilter<Input>,
  makeEvents: (input: Input[][]) => Output[] | null,
  types: readonly Input["type"][],
) => {
  const previousWorldTime = 0;
  let count = 0;
  return (input: Input): Output[] | null => {
    count++;
    if (!types.includes(input.type)) {
      return null;
    }
    if (count % 100 === 0) {
      console.log("Processed", count, "events so far");
    }
    if (input.worldTime < previousWorldTime) {
      throw new Error("Out-of-order event detected");
    }
    const result = scan.nextEvent(input);
    if (result.status === "no-cluster") {
      return null;
    }
    if (result.values.length === 0) {
      console.warn(
        "No returned values found in cluster, please check if this is expected.",
      );
      return null;
    }
    return makeEvents(result.values);
  };
};

export const techInstantFilter = (context: Context<DataSet>) =>
  analyzerFromSequencer(
    new SequenceFilter<DSTechStatusInstant>((input) => {
      return (
        context.trackedTechs.includes(input.techId) && input.tag === "completed"
      );
    }),
    (input) => {
      return input.map((i) => ({
        type: "researchCompleted",
        player: i[0]!.subjectPlayerId,
        techId: i[0]!.techId,
        worldTime: i[0]!.worldTime,
      }));
    },
    ["techStatus"],
  );

export const buildingConstructionAnalyzer = (
  _context: Context<ReturnType<typeof initDataSetWithOverrides>>,
) => {
  return analyzerFromSequencer(
    new SequenceFilter<EnhancedStudySystemInput>((input) => {
      return (
        // TODO: In the interpreter: Await underConstuction and constructed/destroyed tagged instants of the same building unless it's forward construction
        input.type == "lifeCycle" &&
        ["underConstruction", "constructed"].includes(input.tag)
      );
    }),
    (input) => {
      return input
        .map((i) => {
          const event = i[0];
          if (
            !event ||
            event.type !== "lifeCycle" ||
            event.subjectEntity <= 0 ||
            event.subjectPlayerId <= 0
          ) {
            return null;
          }

          if (event.tag === "underConstruction") {
            return {
              type: "buildingPlaced",
              subjectPlayerId: event.subjectPlayerId,
              worldX: event.worldX,
              worldY: event.worldY,
              worldZ: event.worldZ,
              entityId: event.subjectEntity,
              worldTime: event.worldTime,
            };
          }

          if (event.tag === "constructed") {
            return {
              type: "buildingConstructed",
              subjectPlayerId: event.subjectPlayerId,
              worldX: event.worldX,
              worldY: event.worldY,
              worldZ: event.worldZ,
              entityId: event.subjectEntity,
              worldTime: event.worldTime,
            };
          }

          return null;
        })
        .filter(Boolean);
    },
    ["lifeCycle"],
  );
};

export const villagerLifeCycleInstant = (context: Context<DataSet>) =>
  analyzerFromSequencer(
    new SequenceFilter<DSLifeCycleInstant>((input) => {
      return ["created"].includes(input.tag);
    }),
    (input) => {
      return input.map((i) => {
        const result = context.queryEntity(
          i[0]!.subjectEntity,
          i[0]!.worldTime, // Use the event time which is the most recent for this instant
          { playerId: i[0]!.subjectPlayerId },
        );
        if (!result) {
          console.warn("No entity found for building instant", input);
          return null;
        }

        if (i[0]!.tag === "created" || i[0]!.tag === "dead") {
          // TODO: created and dead dont use the same tense, should be fixed in the instant generator
          return {
            type: i[0]!.tag === "created" ? "villagerCreated" : "villagerDied",
            playerId: result.ownerId,
            worldX: i[0]!.worldX,
            worldY: i[0]!.worldY,
            worldZ: i[0]!.worldZ,
            entityId: i[0]!.subjectEntity,
            refMasterId: result.refMasterId,
            masterId: result.masterId,
            worldTime: i[0]!.worldTime,
          };
        }
        return null;
      });
    },
    ["lifeCycle"],
  );

// TODO: Track ScoutInfo events (to be added)
// const scoutEventFilter = new SequenceFilter<DSScoutInstant>();

//TODO: Add time events (which need to be added to the instant generator)
// Specifically: Start of game, End of game, and a configurable interval (to e.g. report on economy state if nothing else is happening)

// TODO, move to context for hoisting and early returns
const { dmgEventScan, updateLastProcessedTime } = createDamageEventAnalyzer();

// Signal Analysis emits raw battle clusters. Hydration happens in interpretation.
const processBattleClusters = (
  clusters: EnhancedStudySystemInput[][],
): RawBattleEvent[] => {
  return clusters
    .map((cluster) => {
      // Filter to only damage and death events
      const battleEvents = cluster.filter(
        (event): event is DSDamageInstant | DSDeathInstant =>
          event.type === "damage" || event.type === "death",
      );

      if (battleEvents.length === 0) {
        return null;
      }

      const startTime = battleEvents[0]!.worldTime;
      const endTime = battleEvents[battleEvents.length - 1]!.worldTime;

      return {
        type: "battle" as const,
        worldTime: startTime,
        startTimeMs: startTime,
        endTimeMs: endTime,
        worldX: (battleEvents[0] as DSDeathInstant | DSDamageInstant).worldX,
        worldY: (battleEvents[0] as DSDeathInstant | DSDamageInstant).worldY,
        data: battleEvents,
      };
    })
    .filter((cluster): cluster is RawBattleEvent => cluster !== null);
};

// Merged damage event analyzer that handles both regular processing and final tick hoisting
export const damageEventAnalyzer = (
  _context: Context<ReturnType<typeof initDataSetWithOverrides>>,
  parallelStructuring: boolean = false,
) =>
  analyzerFromSequencer(
    dmgEventScan,
    (clusters) => {
      const battleClusters = processBattleClusters(clusters);

      if (battleClusters.length === 0) {
        return null;
      }

      const startTime = battleClusters.reduce(
        (min, c) => Math.min(min, c.startTimeMs),
        Infinity,
      );
      const endTime = battleClusters.reduce(
        (max, c) => Math.max(max, c.endTimeMs),
        -Infinity,
      );

      // Check for ongoing battles using hoistClusters with "peek"
      const ongoingBattles = parallelStructuring
        ? dmgEventScan.hoistClusters((cluster) => {
            const clusterStartTime = cluster[0]!.worldTime;
            const eventEndTime = endTime;
            // Check if this cluster started before the current battle event ended
            if (eventEndTime && clusterStartTime < eventEndTime) {
              return "peek"; // Include as ongoing battle but keep in the scan
            }
            return false;
          })
        : null;

      const ongoingBattleClusters = ongoingBattles
        ? processBattleClusters(ongoingBattles)
        : [];

      const battlesEvent: BattlesEvent = {
        type: "battles" as const,
        worldTime: endTime,
        clusters: battleClusters,
        ongoingBattleClusters,
        startTime,
        endTime,
      };

      updateLastProcessedTime(battlesEvent.endTime);

      if (parallelStructuring) {
        return [battlesEvent];
      } else {
        return battlesEvent.clusters
          .toSorted((a, b) => a.endTimeMs - b.endTimeMs)
          .map(
            (c) =>
              ({
                type: "battles" as const,
                worldTime: c.endTimeMs,
                startTime: c.startTimeMs,
                endTime: c.endTimeMs,
                clusters: [c],
              }) satisfies BattlesEvent,
          );
      }
    },
    ["damage", "death"],
  );

/////////////////////////////////////
// TODO: Remove the classify step? //
/////////////////////////////////////

export const strategyDetectionAnalyzer =
  (context: Context<ReturnType<typeof initDataSetWithOverrides>>) =>
  (input: EnhancedStudySystemInput) => {
    if (input.type !== "minuteTick") {
      return null; // Only process minute ticks
    }
    console.log(`Strategy analyzer triggered for minute ${input.minute}`);

    const currentTime = input.worldTime;
    const currentMinute = input.minute;

    const strategies: Array<{
      type: "strategyUpdate";
      playerId: number;
      minute: number;
      worldTime: number;
      strategy: PlayerStrategy;
    }> = [];

    for (const playerId of [1, 2]) {
      const detectedStrategy = detectPlayerStrategy(
        context,
        playerId,
        currentTime,
        currentMinute,
      );

      if (detectedStrategy) {
        // Track strategy here rather than in the interpreter so we can compare
        // against the previous detection to tell whether it changed.
        context.updatePlayerStrategy(playerId, detectedStrategy);

        strategies.push({
          type: "strategyUpdate",
          playerId,
          minute: currentMinute,
          worldTime: currentTime,
          strategy: detectedStrategy,
        });
      }
    }

    return strategies.length > 0 ? strategies : null;
  };

export const strategyDetectionTickAnalyzer =
  (_context: Context<ReturnType<typeof initDataSetWithOverrides>>) =>
  (input: EnhancedStudySystemInput) => {
    if (input.type !== "minuteTick") {
      return null;
    }

    return [1, 2].map((playerId) => ({
      type: "strategyDetectionTick" as const,
      playerId,
      minute: input.minute,
      worldTime: input.worldTime,
    }));
  };

export const introAnalyzer =
  (_context: Context<DataSet>) => (input: EnhancedStudySystemInput) => {
    if (input.type !== "minuteTick" || input.minute !== 0) {
      return null;
    }
    console.log(
      `Introduction analyzer triggered for minute ${input.minute}, ${input.worldTime}`,
    );
    return [
      {
        type: "introduction",
        worldTime: input.worldTime,
        minute: input.minute,
      },
      {
        type: "mapQuality",
        worldTime: input.worldTime,
        minute: input.minute,
      },
    ];
  };

export const mapQualityAnalyzer =
  (_context: Context<DataSet>) => (_input: EnhancedStudySystemInput) => {
    // Disabled to prevent duplication, geneated by introAnalyzer for now
    return null;
  };

function detectPlayerStrategy(
  context: Context<DataSet>,
  playerId: number,
  currentTime: number,
  currentMinute: number,
): PlayerStrategy | null {
  // Use the actual GameStateExtractor to get real game data
  const dataSet = context.getDataSet();
  const extractor = new GameStateExtractor(dataSet);

  try {
    const gameState: GameState = {
      ...extractor.extractGameState(currentTime, playerId),
      playerId, // Add the missing playerId field required by fuzzy detector
    };

    const matches = detectStrategies(gameState, strategyDetectors, 0.3);

    if (matches.length > 0) {
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
          firstSeenTime: currentTime, // Add the required detectionTime property
          indicators: [
            bestMatch.breakdown.matchedIndex
              ? bestMatch.breakdown.breakdowns[
                  bestMatch.breakdown.matchedIndex!
                ]
              : undefined,
          ],
        };
      }
    } else {
      // console
      // .log
      // `No strategy detected for player ${playerId} at minute ${currentMinute}`,
      // ();
    }
  } catch (error) {
    console.error(
      `Error extracting GameState for player ${playerId} at minute ${currentMinute}:`,
      error,
    );
  }

  return null;
}

export const tickPassthrough =
  (_context: Context<ReturnType<typeof initDataSetWithOverrides>>) =>
  (input: EnhancedStudySystemInput) => {
    if (input.type !== "minuteTick" && input.type !== "finalTick") {
      return null;
    }
    if (input.type === "finalTick") {
      console.log(
        `Final tick event at minute ${input.minute}, worldTime ${input.worldTime}`,
      );

      // Hoist all remaining events from the damage analyzer
      const hoistedClusters = dmgEventScan.hoistClusters(() => "hoist");

      if (hoistedClusters && hoistedClusters.length > 0) {
        console.log(
          `Hoisted ${hoistedClusters.length} remaining battle clusters for final tick`,
        );

        // Process hoisted clusters into battle events using the shared helper
        const hydratedClusters = processBattleClusters(hoistedClusters);

        const startTime = hydratedClusters.reduce(
          (min, c) => Math.min(min, c.startTimeMs),
          Infinity,
        );
        const endTime = hydratedClusters.reduce(
          (max, c) => Math.max(max, c.endTimeMs),
          -Infinity,
        );

        // Create the final BattlesEvent
        const finalBattlesEvent: BattlesEvent = {
          type: "battles" as const,
          worldTime: input.worldTime,
          clusters: hydratedClusters,
          ongoingBattleClusters: [], // No ongoing battles at final tick
          startTime: startTime,
          endTime: endTime,
        };

        return [
          finalBattlesEvent,
          {
            type: "finalTick",
            worldTime: input.worldTime,
            minute: input.minute,
          },
        ];
      } else {
        // No remaining battles to hoist
        return [
          {
            type: "finalTick",
            worldTime: input.worldTime,
            minute: input.minute,
          },
        ];
      }
    }
    return [
      {
        type: "tick",
        worldTime: input.worldTime,
        minute: input.minute,
      },
    ];
  };

