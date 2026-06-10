import { createTemplate } from "../../../events/instant-traverser.js";
import {
  BattlesEvent,
  BattleEvent,
  InterpretedBattlesEvent,
  RawBattleEvent,
} from "../study-events.js";
import {
  eventBase,
  eventInsights,
  eventEventStructuring,
  eventAll,
} from "../../../gemini/prompts.js";
import { cleanBattlesEvent, enhanceDataForLLM } from "./enhanceData.js";
import { initDataSetWithOverrides } from "../study-data-sets.js";
import { Context } from "../study-context.js";
import {
  makeLocationList,
  getNamedLocation,
} from "../../../aoe2/map-quality.js";
import {
  DSDamageInstant,
  DSDeathInstant,
} from "../../../aoe2/types/arrow/instants.js";
import { getEntityInfos } from "../../../aoe2/entity-info.js";
import { countBy, unique } from "remeda";

const formatTime = (timeMs: number): string => {
  const totalSeconds = Math.floor(timeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const formatCoordinates = (worldX: number, worldY: number): string => {
  return ` (${Math.round(worldX)}, ${Math.round(worldY)})`;
};

const formatTimestampInfo = (timeMs: number): string => {
  return ` [${timeMs}ms | ${formatTime(timeMs)}]`;
};

const getLocationName = (
  context: Context<ReturnType<typeof initDataSetWithOverrides>>,
  worldX: number,
  worldY: number,
): string => {
  try {
    const dataSet = context.getDataSet();
    const locationList = makeLocationList(dataSet);
    return getNamedLocation(locationList, worldX, worldY);
  } catch (error) {
    console.warn(
      "Failed to get named location, falling back to coordinates:",
      error,
    );
    return `(${worldX}, ${worldY})`;
  }
};

const hydrateBattleCluster = (
  rawBattle: RawBattleEvent,
  context: Context<ReturnType<typeof initDataSetWithOverrides>>,
): BattleEvent => {
  const battleEvents = rawBattle.data.filter(
    (event): event is DSDamageInstant | DSDeathInstant =>
      event.type === "damage" || event.type === "death",
  );

  const participants1Map = new Map<
    number,
    { joinTime: number; lastAppearance: number }
  >();
  const participants2Map = new Map<
    number,
    { joinTime: number; lastAppearance: number }
  >();

  battleEvents.forEach((event) => {
    if (event.objectPlayerId === 1) {
      const existing = participants1Map.get(event.objectEntity);
      participants1Map.set(event.objectEntity, {
        joinTime: existing
          ? Math.min(existing.joinTime, event.worldTime)
          : event.worldTime,
        lastAppearance: existing
          ? Math.max(existing.lastAppearance, event.worldTime)
          : event.worldTime,
      });
    }
    if (event.subjectPlayerId === 1) {
      const existing = participants1Map.get(event.subjectEntity);
      participants1Map.set(event.subjectEntity, {
        joinTime: existing
          ? Math.min(existing.joinTime, event.worldTime)
          : event.worldTime,
        lastAppearance: existing
          ? Math.max(existing.lastAppearance, event.worldTime)
          : event.worldTime,
      });
    }
    if (event.objectPlayerId === 2) {
      const existing = participants2Map.get(event.objectEntity);
      participants2Map.set(event.objectEntity, {
        joinTime: existing
          ? Math.min(existing.joinTime, event.worldTime)
          : event.worldTime,
        lastAppearance: existing
          ? Math.max(existing.lastAppearance, event.worldTime)
          : event.worldTime,
      });
    }
    if (event.subjectPlayerId === 2) {
      const existing = participants2Map.get(event.subjectEntity);
      participants2Map.set(event.subjectEntity, {
        joinTime: existing
          ? Math.min(existing.joinTime, event.worldTime)
          : event.worldTime,
        lastAppearance: existing
          ? Math.max(existing.lastAppearance, event.worldTime)
          : event.worldTime,
      });
    }
  });

  const casualties1 = new Set(
    battleEvents
      .filter((d) => d.type === "death" && d.objectPlayerId === 1)
      .map((d) => d.objectEntity),
  );

  const casualties2 = new Set(
    battleEvents
      .filter((d) => d.type === "death" && d.objectPlayerId === 2)
      .map((d) => d.objectEntity),
  );

  const location = getLocationName(context, rawBattle.worldX, rawBattle.worldY);

  return {
    ...rawBattle,
    location,
    player1: {
      participants: Array.from(participants1Map.entries()).reduce(
        (acc, [id, timing]) => {
          const entityInfo = context.queryEntity(id, timing.lastAppearance, {
            playerId: 1,
          });
          const name = entityInfo?.name || "";
          acc[name] = (acc[name] || 0) + 1;
          return acc;
        },
        {} as { [key: string]: number },
      ),
      casualties: Array.from(participants1Map.entries())
        .filter(([id]) => casualties1.has(id))
        .reduce(
          (acc, [id, timing]) => {
            const entityInfo = context.queryEntity(id, timing.lastAppearance, {
              playerId: 1,
            });
            const name = entityInfo?.name || "";
            acc[name] = (acc[name] || 0) + 1;
            return acc;
          },
          {} as { [key: string]: number },
        ),
      survivors: Array.from(participants1Map.entries())
        .filter(([id]) => !casualties1.has(id))
        .reduce(
          (acc, [id, timing]) => {
            const entityInfo = context.queryEntity(id, timing.lastAppearance, {
              playerId: 1,
            });
            const name = entityInfo?.name || "";
            acc[name] = (acc[name] || 0) + 1;
            return acc;
          },
          {} as { [key: string]: number },
        ),
      participantsExtended: Array.from(participants1Map.entries()).map(
        ([id, timing]) => {
          const q = context.queryEntity(id, timing.lastAppearance, {
            playerId: 1,
          });
          return {
            name: q?.name || "",
            entityId: id,
            refMasterId: q?.refMasterId,
            joinTime: timing.joinTime,
            lastAppearance: timing.lastAppearance,
          };
        },
      ),
      casualtiesExtended: Array.from(participants1Map.entries())
        .filter(([id]) => casualties1.has(id))
        .map(([id, timing]) => {
          const deathEvent = battleEvents.find(
            (d) =>
              d.type === "death" &&
              d.objectEntity === id &&
              d.objectPlayerId === 1,
          );
          const lastAppearance = deathEvent?.worldTime || timing.lastAppearance;
          const q = context.queryEntity(id, lastAppearance, {
            playerId: 1,
          });
          return {
            name: q?.name || "",
            entityId: id,
            refMasterId: q?.refMasterId,
            joinTime: timing.joinTime,
            lastAppearance,
          };
        }),
      survivorsExtended: Array.from(participants1Map.entries())
        .filter(([id]) => !casualties1.has(id))
        .map(([id, timing]) => {
          const q = context.queryEntity(id, timing.lastAppearance, {
            playerId: 1,
          });
          return {
            name: q?.name || "",
            entityId: id,
            refMasterId: q?.refMasterId,
            joinTime: timing.joinTime,
            lastAppearance: timing.lastAppearance,
          };
        }),
    },
    player2: {
      participants: Array.from(participants2Map.entries()).reduce(
        (acc, [id, timing]) => {
          const entityInfo = context.queryEntity(id, timing.lastAppearance, {
            playerId: 2,
          });
          const name = entityInfo?.name || "";
          acc[name] = (acc[name] || 0) + 1;
          return acc;
        },
        {} as { [key: string]: number },
      ),
      casualties: Array.from(participants2Map.entries())
        .filter(([id]) => casualties2.has(id))
        .reduce(
          (acc, [id, timing]) => {
            const entityInfo = context.queryEntity(id, timing.lastAppearance, {
              playerId: 2,
            });
            const name = entityInfo?.name || "";
            acc[name] = (acc[name] || 0) + 1;
            return acc;
          },
          {} as { [key: string]: number },
        ),
      survivors: Array.from(participants2Map.entries())
        .filter(([id]) => !casualties2.has(id))
        .reduce(
          (acc, [id, timing]) => {
            const entityInfo = context.queryEntity(id, timing.lastAppearance, {
              playerId: 2,
            });
            const name = entityInfo?.name || "";
            acc[name] = (acc[name] || 0) + 1;
            return acc;
          },
          {} as { [key: string]: number },
        ),
      participantsExtended: Array.from(participants2Map.entries()).map(
        ([id, timing]) => {
          const q = context.queryEntity(id, timing.lastAppearance, {
            playerId: 2,
          });
          return {
            name: q?.name || "",
            entityId: id,
            refMasterId: q?.refMasterId,
            joinTime: timing.joinTime,
            lastAppearance: timing.lastAppearance,
          };
        },
      ),
      casualtiesExtended: Array.from(participants2Map.entries())
        .filter(([id]) => casualties2.has(id))
        .map(([id, timing]) => {
          const deathEvent = battleEvents.find(
            (d) =>
              d.type === "death" &&
              d.objectEntity === id &&
              d.objectPlayerId === 2,
          );
          const lastAppearance = deathEvent?.worldTime || timing.lastAppearance;
          const q = context.queryEntity(id, lastAppearance, {
            playerId: 2,
          });
          return {
            name: q?.name || "",
            entityId: id,
            refMasterId: q?.refMasterId,
            joinTime: timing.joinTime,
            lastAppearance,
          };
        }),
      survivorsExtended: Array.from(participants2Map.entries())
        .filter(([id]) => !casualties2.has(id))
        .map(([id, timing]) => {
          const q = context.queryEntity(id, timing.lastAppearance, {
            playerId: 2,
          });
          return {
            name: q?.name || "",
            entityId: id,
            refMasterId: q?.refMasterId,
            joinTime: timing.joinTime,
            lastAppearance: timing.lastAppearance,
          };
        }),
    },
    fightType: "skirmish",
  };
};

const hydrateOngoingBattleCluster = (
  rawBattle: RawBattleEvent,
  context: Context<ReturnType<typeof initDataSetWithOverrides>>,
  startTime: number,
) => {
  const battleEvents = rawBattle.data.filter(
    (event): event is DSDamageInstant | DSDeathInstant =>
      event.type === "damage" || event.type === "death",
  );

  const entityInfos1 = getEntityInfos(
    context.getDataSet(),
    unique([
      ...battleEvents
        .filter((d) => d.objectPlayerId === 1)
        .map((d) => d.objectEntity),
      ...battleEvents
        .filter((d) => d.subjectPlayerId === 1)
        .map((d) => d.subjectEntity),
    ]),
    startTime,
  );

  const entityInfos2 = getEntityInfos(
    context.getDataSet(),
    unique([
      ...battleEvents
        .filter((d) => d.objectPlayerId === 2)
        .map((d) => d.objectEntity),
      ...battleEvents
        .filter((d) => d.subjectPlayerId === 2)
        .map((d) => d.subjectEntity),
    ]),
    startTime,
  );

  return {
    location: getLocationName(context, rawBattle.worldX, rawBattle.worldY),
    worldX: rawBattle.worldX,
    worldY: rawBattle.worldY,
    startTimeMs: rawBattle.startTimeMs,
    player1: { participants: countBy(entityInfos1, (d) => d.name) },
    player2: { participants: countBy(entityInfos2, (d) => d.name) },
  };
};

const classifyBattle = (battle: BattleEvent) => {
  const totalParticipants =
    battle.player1.participantsExtended.length +
    battle.player2.participantsExtended.length;
  const totalCasualties =
    battle.player1.casualtiesExtended.length +
    battle.player2.casualtiesExtended.length;

  const hasVillagers =
    Object.keys(battle.player1.participants).includes("Villager") ||
    Object.keys(battle.player2.participants).includes("Villager");

  if (hasVillagers) {
    return { classification: "raid", value: 0.9 };
  } else if (totalParticipants > 15 && totalCasualties > 8) {
    return { classification: "major battle", value: 0.9 };
  } else if (totalParticipants < 10 && totalCasualties < 5) {
    return { classification: "skirmish", value: 0.8 };
  } else {
    return { classification: "battle", value: 0.6 };
  }
};

const mkInterpreter =
  (
    context: Context<ReturnType<typeof initDataSetWithOverrides>>,
    expertInsights: boolean = false,
  ) =>
  (input: BattlesEvent) => {
    if (!input || input.type !== "battles") {
      return null; 
    }

    if (!input.clusters) {
      return null;
    }

    const hydratedClusters = input.clusters.map((battle) =>
      hydrateBattleCluster(battle, context),
    );

    const classifiedClusters = hydratedClusters.map((battle) => {
      const classification = classifyBattle(battle);

      const survivors1 = battle.player1.participantsExtended.filter(
        (p) =>
          !battle.player1.casualtiesExtended.some(
            (c) => c.entityId === p.entityId,
          ),
      );
      const survivors2 = battle.player2.participantsExtended.filter(
        (p) =>
          !battle.player2.casualtiesExtended.some(
            (c) => c.entityId === p.entityId,
          ),
      );

      const survivorsList1 = survivors1.reduce(
        (acc, s) => {
          acc[s.name] = (acc[s.name] || 0) + 1;
          return acc;
        },
        {} as { [key: string]: number },
      );

      const survivorsList2 = survivors2.reduce(
        (acc, s) => {
          acc[s.name] = (acc[s.name] || 0) + 1;
          return acc;
        },
        {} as { [key: string]: number },
      );

      return {
        ...battle,
        fightType: classification.classification,
        player1: {
          ...battle.player1,
          survivors: survivorsList1,
          survivorsExtended: survivors1,
        },
        player2: {
          ...battle.player2,
          survivors: survivorsList2,
          survivorsExtended: survivors2,
        },
      };
    });

    const interpretedInput: InterpretedBattlesEvent = {
      type: "battles",
      worldTime: input.worldTime,
      clusters: classifiedClusters,
      ongoingBattles:
        input.ongoingBattleClusters?.map((cluster) =>
          hydrateOngoingBattleCluster(cluster, context, input.startTime),
        ) ?? [],
      startTime: input.startTime,
      endTime: input.endTime,
    };

    const cleaned = cleanBattlesEvent(interpretedInput);
    const result = enhanceDataForLLM(
      cleaned,
      context,
      input.startTime,
      input.endTime,
      expertInsights,
    );
    return result;
  };

const battlesClassifier = (
  input: NonNullable<ReturnType<ReturnType<typeof mkInterpreter>>>,
) => {
  const totalBattles = input.finishedBattles.length;
  const raidCount = input.finishedBattles.filter(
    (b) => b.fightType === "raid",
  ).length;
  const majorBattleCount = input.finishedBattles.filter(
    (b) => b.fightType === "major battle",
  ).length;

  if (totalBattles === 1) {
    return { classification: "isolated conflict", value: 0.9 };
  } else if (raidCount > totalBattles / 2) {
    return { classification: "raid sequence", value: 0.8 };
  } else if (majorBattleCount > 0) {
    return { classification: "major engagement", value: 0.8 };
  } else {
    return { classification: "series of skirmishes", value: 0.7 };
  }
};

const realiser = (
  input: NonNullable<ReturnType<ReturnType<typeof mkInterpreter>>>,
  classification: { classification: string; value: number },
  _previousResponses: string[],
): {
  dataUsed: NonNullable<ReturnType<ReturnType<typeof mkInterpreter>>>;
  text: string;
} => {
  const { classification: overallType } = classification;
  const startTimeMinutes = Math.floor(input.startTime / 60000);
  const endTimeMinutes = Math.floor(input.endTime / 60000);
  const duration = endTimeMinutes - startTimeMinutes;

  let description = "";

  if (input.finishedBattles.length === 1) {
    const battle = input.finishedBattles[0]!;
    const battleTime = Math.floor(battle.startTimeMs / 60000);
    const battleEndTime = Math.floor(battle.endTimeMs / 60000);
    const coordStr = formatCoordinates(battle.worldX, battle.worldY);
    const timestampStr = formatTimestampInfo(battle.startTimeMs);
    description += `Between ${battleTime} and ${battleEndTime} minutes, a ${battle.fightType} occurred at ${battle.location}${coordStr}${timestampStr}. `;
  } else {
    description += `Between ${startTimeMinutes} and ${endTimeMinutes} minutes (${duration} minute${duration !== 1 ? "s" : ""}), ${overallType} unfolded with ${input.finishedBattles.length} separate engagements. `;
  }

  input.finishedBattles.forEach((battle, index) => {
    const battleTime = Math.floor(battle.startTimeMs / 60000);
    const coordStr = formatCoordinates(battle.worldX, battle.worldY);
    const timestampStr = formatTimestampInfo(battle.startTimeMs);

    if (input.finishedBattles.length > 1) {
      description += `\n\nEngagement ${index + 1} (${battleTime} min)${coordStr}${timestampStr}: `;
    }

    const p1Units = Object.entries(battle.player1.participants);
    const p2Units = Object.entries(battle.player2.participants);

    if (p1Units.length > 0) {
      description += `Player 1 brought ${p1Units.map(([unit, count]) => `${count} ${unit}${count > 1 ? "s" : ""}`).join(", ")}. `;
    }

    if (p2Units.length > 0) {
      description += `Player 2 brought ${p2Units.map(([unit, count]) => `${count} ${unit}${count > 1 ? "s" : ""}`).join(", ")}. `;
    }

    const p1Casualties = Object.entries(battle.player1.casualties);
    const p2Casualties = Object.entries(battle.player2.casualties);

    if (p1Casualties.length > 0) {
      description += `Player 1 lost ${p1Casualties.map(([unit, count]) => `${count} ${unit}${count > 1 ? "s" : ""}`).join(", ")}. `;
    }

    if (p2Casualties.length > 0) {
      description += `Player 2 lost ${p2Casualties.map(([unit, count]) => `${count} ${unit}${count > 1 ? "s" : ""}`).join(", ")}. `;
    }
  });

  return { dataUsed: input, text: description.trim() };
};

const createBattlesLLMRealiser = (
  promptFunction: (
    data: object,
    echoJsonInstead?: boolean,
    previousResponses?: string[],
  ) => Promise<string | undefined>,
) => {
  return async (
    input: NonNullable<ReturnType<ReturnType<typeof mkInterpreter>>>,
    _classification: { classification: string; value: number },
    previousResponses: string[],
  ): Promise<{ dataUsed: unknown; text: string }> => {
    const enrichedInput = {
      ...input,
      timestamp: formatTime(input.endTime),
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
export const battlesTemplateLLMBase = (
  context: Context<ReturnType<typeof initDataSetWithOverrides>>,
) =>
  createTemplate({
    eventInterpreter: mkInterpreter(context, false),
    eventClassifier: battlesClassifier,
    eventRealiser: createBattlesLLMRealiser(eventBase),
  });

export const battlesTemplateLLMInsights = (
  context: Context<ReturnType<typeof initDataSetWithOverrides>>,
) =>
  createTemplate({
    eventInterpreter: mkInterpreter(context, true),
    eventClassifier: battlesClassifier,
    eventRealiser: createBattlesLLMRealiser(eventInsights),
  });

export const battlesTemplateLLMEventStructuring = (
  context: Context<ReturnType<typeof initDataSetWithOverrides>>,
) =>
  createTemplate({
    eventInterpreter: mkInterpreter(context, false),
    eventClassifier: battlesClassifier,
    eventRealiser: createBattlesLLMRealiser(eventEventStructuring),
  });

export const battlesTemplateLLMAll = (
  context: Context<ReturnType<typeof initDataSetWithOverrides>>,
) =>
  createTemplate({
    eventInterpreter: mkInterpreter(context, true),
    eventClassifier: battlesClassifier,
    eventRealiser: createBattlesLLMRealiser(eventAll),
  });

export const battlesTemplate = (
  context: Context<ReturnType<typeof initDataSetWithOverrides>>,
  expertInsights: boolean = false,
) =>
  createTemplate({
    eventInterpreter: mkInterpreter(context, expertInsights),
    eventClassifier: battlesClassifier,
    eventRealiser: realiser,
  });

