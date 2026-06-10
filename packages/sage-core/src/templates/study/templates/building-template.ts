import { createTemplate } from "../../../events/instant-traverser.js";
import {
  eventBase,
  eventInsights,
  eventEventStructuring,
  eventAll,
} from "../../../gemini/prompts.js";
import { Context } from "../study-context.js";
import { initDataSetWithOverrides } from "../study-data-sets.js";
import { BuildingEvent, RawBuildingEvent } from "../study-events.js";
import {
  makeLocationList,
  getNamedLocation,
} from "../../../aoe2/map-quality.js";
import { escape } from "arquero";
import { Struct } from "arquero/dist/types/table/types.js";

export const formatTime = (timeMs: number): string => {
  const totalSeconds = Math.floor(timeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const IMPORTANT_BUILDINGS = [82, 109, 79, 234, 1251, 1665] as const;

const getBuildingName = (refMasterId: number): string => {
  if (refMasterId === 82) return "Castle";
  if (refMasterId === 109) return "Town Center";
  if (refMasterId === 79 || refMasterId === 234) return "Watch Tower";
  if (refMasterId === 1251) return "Krepost";
  if (refMasterId === 1665) return "Donjon";
  return "Unknown Building";
};

const isImportantBuilding = (refMasterId: number): boolean => {
  return IMPORTANT_BUILDINGS.includes(
    refMasterId as (typeof IMPORTANT_BUILDINGS)[number],
  );
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

const isBuildingForward = (
  context: Context<ReturnType<typeof initDataSetWithOverrides>>,
  worldX: number,
  worldY: number,
  playerId: number,
  timeMs: number,
): boolean => {
  try {
    const dataSet = context.getDataSet();
    const windowId = dataSet.timeToWindow(timeMs);
    const enemyPlayerId = playerId === 1 ? 2 : 1;

    const enemyTownCenters = dataSet.t.entities
      .filter(
        escape(
          (d: Struct) =>
            d["sage:binId"] === windowId &&
            d["ownerId"] === enemyPlayerId &&
            d["refMasterId"] === 109,
        ),
      )
      .select("worldX", "worldY")
      .objects() as Array<{ worldX: number; worldY: number }>;

    const FORWARD_DISTANCE = 25;
    for (const tc of enemyTownCenters) {
      const distance = Math.sqrt(
        Math.pow(worldX - tc.worldX, 2) + Math.pow(worldY - tc.worldY, 2),
      );
      if (distance <= FORWARD_DISTANCE) {
        return true;
      }
    }
    return false;
  } catch (error) {
    console.warn(
      `Failed to check if building at (${worldX}, ${worldY}) is forward:`,
      error,
    );
    return false;
  }
};

const buildingInterpreter = (
  context: Context<ReturnType<typeof initDataSetWithOverrides>>,
) => {
  let lastTownCenterX = -1;
  let lastTownCenterY = -1;

  return (event: RawBuildingEvent) => {
    if (!event || typeof event !== "object") {
      console.warn("Undefined or invalid event in building template:", event);
      return null;
    }

    const getPlayerName = (playerId: number) => {
      const result =
        context?.getDataSet().derivedParams.players[playerId - 1]?.playerName;
      if (!result) {
        throw new Error(`Player name not found for playerId ${playerId}`);
      }
      return result;
    };

    if (
      event.type !== "buildingPlaced" &&
      event.type !== "buildingConstructed"
    ) {
      return null;
    }

    const result = context.queryEntity(event.entityId, event.worldTime, {
      playerId: event.subjectPlayerId,
    });

    if (
      !result ||
      typeof result.refMasterId !== "number" ||
      typeof result.ownerId !== "number"
    ) {
      console.warn("Failed to query entity for building:", {
        entity: event.entityId,
        time: event.worldTime,
        playerId: event.subjectPlayerId,
        result,
      });
      return null;
    }

    if (!isImportantBuilding(result.refMasterId)) {
      return null;
    }

    const hydrated: BuildingEvent = {
      type: event.type,
      playerId: result.ownerId,
      buildingName: getBuildingName(result.refMasterId),
      location: getLocationName(context, event.worldX, event.worldY),
      worldX: event.worldX,
      worldY: event.worldY,
      worldZ: event.worldZ,
      entityId: event.entityId,
      refMasterId: result.refMasterId,
      worldTime: event.worldTime,
      isForward: isBuildingForward(
        context,
        event.worldX,
        event.worldY,
        result.ownerId,
        event.worldTime,
      ),
      isCastle: result.refMasterId === 82,
      isTownCenter: result.refMasterId === 109,
      isDefensive: IMPORTANT_BUILDINGS.includes(
        result.refMasterId as (typeof IMPORTANT_BUILDINGS)[number],
      ),
    };

    if (
      hydrated.buildingName === "Town Center" &&
      hydrated.worldX === lastTownCenterX &&
      hydrated.worldY === lastTownCenterY
    ) {
      lastTownCenterX = hydrated.worldX;
      lastTownCenterY = hydrated.worldY;
      return null;
    }

    lastTownCenterX = hydrated.worldX;
    lastTownCenterY = hydrated.worldY;

    if (hydrated.type === "buildingPlaced" && !hydrated.isForward) {
      return null;
    }

    return {
      mainEvent:
        hydrated.type === "buildingPlaced"
          ? ("foundation" as const)
          : ("completion" as const),
      buildingType: hydrated.buildingName,
      playerId: hydrated.playerId,
      playerName: getPlayerName(hydrated.playerId),
      location: hydrated.location,
      isForward: hydrated.isForward,
      isCastle: hydrated.isCastle,
      isTownCenter: hydrated.isTownCenter,
      timeMs: hydrated.worldTime,
      worldX: hydrated.worldX,
      worldY: hydrated.worldY,
      worldZ: hydrated.worldZ,
    };
  };
};

const buildingClassifier = (
  interpretation: Exclude<
    ReturnType<ReturnType<typeof buildingInterpreter>>,
    null
  >,
) => {
  const { mainEvent, isForward, isCastle, isTownCenter } = interpretation;

  if (mainEvent === "foundation") {
    if (isCastle && isForward) {
      return { classification: "forward_castle_foundation", value: 0.9 };
    }
    if (isCastle) {
      return { classification: "castle_foundation", value: 0.8 };
    }
    if (isTownCenter && isForward) {
      return { classification: "forward_tc_expansion", value: 0.9 };
    }
    if (isTownCenter) {
      return { classification: "tc_expansion", value: 0.8 };
    }
    if (isForward) {
      return { classification: "forward_building_foundation", value: 0.7 };
    }
    return { classification: "defensive_building_foundation", value: 0.5 };
  }

  if (mainEvent === "completion") {
    if (isCastle && isForward) {
      return { classification: "forward_castle_completed", value: 0.9 };
    }
    if (isCastle) {
      return { classification: "castle_completed", value: 0.8 };
    }
    if (isTownCenter && isForward) {
      return { classification: "forward_tc_completed", value: 0.9 };
    }
    if (isTownCenter) {
      return { classification: "tc_completed", value: 0.8 };
    }
    if (isForward) {
      return { classification: "forward_building_completed", value: 0.7 };
    }
    return { classification: "defensive_building_completed", value: 0.5 };
  }

  return { classification: "defensive_building_completed", value: 0.5 };
};

const buildingRealizer = (
  interpretation: ReturnType<ReturnType<typeof buildingInterpreter>>,
  classification: ReturnType<typeof buildingClassifier>,
  _previousResponses: string[],
): { dataUsed: unknown; text: string } => {
  if (!interpretation || typeof interpretation !== "object") {
    console.warn(
      "Undefined or invalid interpretation in building realizer:",
      interpretation,
    );
    return { dataUsed: interpretation, text: "" };
  }

  const {
    buildingType,
    playerId,
    location,
    timeMs,
    worldX,
    worldY,
    playerName,
  } = interpretation;

  if (typeof playerId !== "number") {
    console.warn("Invalid playerId in building realizer:", playerId);
    return { dataUsed: interpretation, text: "" };
  }

  if (!buildingType || buildingType === "undefined") {
    console.warn("Invalid buildingType in building realizer:", buildingType);
    return { dataUsed: interpretation, text: "" };
  }

  if (!location || location === "undefined") {
    console.warn("Invalid location in building realizer:", location);
    return { dataUsed: interpretation, text: "" };
  }

  const timeStr = formatTime(timeMs || 0);
  const playerStr = playerName;

  const coordStr =
    typeof worldX === "number" && typeof worldY === "number"
      ? ` (${Math.round(worldX)}, ${Math.round(worldY)})`
      : "";

  const timestampInfo = timeMs
    ? ` [${timeMs}ms | ${timeStr}]`
    : ` [${timeStr}]`;

  let text: string;
  switch (classification.classification) {
    case "forward_castle_foundation":
      text = `${timeStr}: ${playerStr} begins constructing a forward Castle at ${location}${coordStr}${timestampInfo}. This aggressive positioning could provide significant military pressure.`;
      break;

    case "castle_foundation":
      text = `${timeStr}: ${playerStr} starts building a Castle at ${location}${coordStr}${timestampInfo}. This defensive structure will strengthen their position.`;
      break;

    case "forward_tc_expansion":
      text = `${timeStr}: ${playerStr} begins a bold Town Center expansion at ${location}${coordStr}${timestampInfo}. This forward expansion is risky but could provide economic advantages.`;
      break;

    case "tc_expansion":
      text = `${timeStr}: ${playerStr} starts a new Town Center at ${location}${coordStr}${timestampInfo}. This economic expansion will boost their resource gathering capabilities.`;
      break;

    case "forward_building_foundation":
      text = `${timeStr}: ${playerStr} places a forward ${buildingType} at ${location}${coordStr}${timestampInfo}. This aggressive positioning extends their territorial control.`;
      break;

    case "defensive_building_foundation":
      text = `${timeStr}: ${playerStr} begins construction of a ${buildingType} at ${location}${coordStr}${timestampInfo}.`;
      break;

    case "forward_castle_completed":
      text = `${timeStr}: ${playerStr} completes their forward Castle at ${location}${coordStr}${timestampInfo}. This strong military position is now fully operational and poses a significant threat.`;
      break;

    case "castle_completed":
      text = `${timeStr}: ${playerStr} finishes their Castle at ${location}${coordStr}${timestampInfo}. This powerful defensive structure is now active.`;
      break;

    case "forward_tc_completed":
      text = `${timeStr}: ${playerStr} completes their forward Town Center at ${location}${coordStr}${timestampInfo}. This bold expansion is now generating resources in enemy territory.`;
      break;

    case "tc_completed":
      text = `${timeStr}: ${playerStr} finishes their Town Center expansion at ${location}${coordStr}${timestampInfo}. Their economic capacity has increased significantly.`;
      break;

    case "forward_building_completed":
      text = `${timeStr}: ${playerStr} completes their forward ${buildingType} at ${location}${coordStr}${timestampInfo}. Their territorial control has expanded into contested areas.`;
      break;

    case "defensive_building_completed":
      text = `${timeStr}: ${playerStr} finishes their ${buildingType} at ${location}${coordStr}${timestampInfo}.`;
      break;

    case "significant_map_control_shift":
      text = `${timeStr}: The completion of ${playerStr}'s ${buildingType} at ${location}${coordStr}${timestampInfo} creates a major shift in map control.`;
      break;

    case "moderate_map_control_shift":
      text = `${timeStr}: ${playerStr}'s new ${buildingType} at ${location}${coordStr}${timestampInfo} notably changes the territorial balance.`;
      break;

    case "minor_map_control_shift":
      text = `${timeStr}: ${playerStr} strengthens their position with a ${buildingType} at ${location}${coordStr}${timestampInfo}.`;
      break;

    default:
      text = `${timeStr}: ${playerStr} builds a ${buildingType} at ${location}${coordStr}${timestampInfo}.`;
      break;
  }

  return { dataUsed: interpretation, text };
};

const createBuildingLLMRealiser = (
  promptFunction: (
    data: object,
    echoJsonInstead?: boolean,
    previousResponses?: string[],
  ) => Promise<string | undefined>,
) => {
  return async (
    interpretation: ReturnType<ReturnType<typeof buildingInterpreter>>,
    classification: ReturnType<typeof buildingClassifier>,
    previousResponses: string[],
  ): Promise<{ dataUsed: unknown; text: string }> => {
    if (!interpretation) {
      return { dataUsed: interpretation, text: "" };
    }

    const enrichedInput = {
      ...interpretation,
      timestamp: formatTime(interpretation.timeMs),
    };

    try {
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
      console.error("Error generating LLM building analysis:", error);
      return buildingRealizer(enrichedInput, classification, previousResponses);
    }
  };
};

export const buildingTemplateLLMBase = (
  context: Context<ReturnType<typeof initDataSetWithOverrides>>,
) =>
  createTemplate({
    eventInterpreter: buildingInterpreter(context),
    eventClassifier: buildingClassifier,
    eventRealiser: createBuildingLLMRealiser(eventBase),
  });

export const buildingTemplateLLMInsights = (
  context: Context<ReturnType<typeof initDataSetWithOverrides>>,
) =>
  createTemplate({
    eventInterpreter: buildingInterpreter(context),
    eventClassifier: buildingClassifier,
    eventRealiser: createBuildingLLMRealiser(eventInsights),
  });

export const buildingTemplateLLMEventStructuring = (
  context: Context<ReturnType<typeof initDataSetWithOverrides>>,
) =>
  createTemplate({
    eventInterpreter: buildingInterpreter(context),
    eventClassifier: buildingClassifier,
    eventRealiser: createBuildingLLMRealiser(eventEventStructuring),
  });

export const buildingTemplateLLMAll = (
  context: Context<ReturnType<typeof initDataSetWithOverrides>>,
) =>
  createTemplate({
    eventInterpreter: buildingInterpreter(context),
    eventClassifier: buildingClassifier,
    eventRealiser: createBuildingLLMRealiser(eventAll),
  });

export const buildingTemplate = (
  context: Context<ReturnType<typeof initDataSetWithOverrides>>,
) =>
  createTemplate({
    eventInterpreter: buildingInterpreter(context),
    eventClassifier: buildingClassifier,
    eventRealiser: buildingRealizer,
  });
