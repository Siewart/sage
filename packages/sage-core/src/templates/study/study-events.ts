import { Analyzable } from "../../events/instant-traverser.js";
import {
  DSDamageInstant,
  DSDeathInstant,
} from "../../aoe2/types/arrow/instants.js";

const timeKey = "worldTime";
type timeKey = typeof timeKey;
const typeKey = "type";
type typeKey = typeof typeKey;

export type StudyBaseInstant<T> = T & Analyzable<timeKey, typeKey> & T;

// Re-export the actual DS types
export type DamageInstant = DSDamageInstant;
export type DeathInstant = DSDeathInstant;

export type StudyInstant = DamageInstant | DeathInstant;

export type RawBattleEvent = {
  type: "battle";
  worldTime: number;
  startTimeMs: number;
  endTimeMs: number;
  worldX: number;
  worldY: number;
  data: StudyInstant[];
};

export type BattleEvent = {
  type: "battle";
  worldTime: number;
  startTimeMs: number;
  endTimeMs: number;
  location: string;
  worldX: number;
  worldY: number;
  data: StudyInstant[];
  player1: {
    participants: { [key: string]: number };
    casualties: { [key: string]: number };
    survivors: { [key: string]: number };
    participantsExtended: Array<{
      name: string;
      entityId: number;
      refMasterId: number | undefined;
      joinTime: number;
      lastAppearance: number;
    }>;
    casualtiesExtended: Array<{
      name: string;
      entityId: number;
      refMasterId: number | undefined;
      joinTime: number;
      lastAppearance: number;
    }>;
    survivorsExtended: Array<{
      name: string;
      entityId: number;
      refMasterId: number | undefined;
      joinTime: number;
      lastAppearance: number;
    }>;
  };
  player2: {
    participants: { [key: string]: number };
    casualties: { [key: string]: number };
    survivors: { [key: string]: number };
    participantsExtended: Array<{
      name: string;
      entityId: number;
      refMasterId: number | undefined;
      joinTime: number;
      lastAppearance: number;
    }>;
    casualtiesExtended: Array<{
      name: string;
      entityId: number;
      refMasterId: number | undefined;
      joinTime: number;
      lastAppearance: number;
    }>;
    survivorsExtended: Array<{
      name: string;
      entityId: number;
      refMasterId: number | undefined;
      joinTime: number;
      lastAppearance: number;
    }>;
  };
  fightType: string;
};

export type BattlesEvent = {
  type: "battles";
  worldTime: number;
  clusters: RawBattleEvent[];
  ongoingBattleClusters?: RawBattleEvent[];
  startTime: number;
  endTime: number;
};

export type InterpretedBattlesEvent = {
  type: "battles";
  worldTime: number;
  clusters: BattleEvent[];
  ongoingBattles?: Array<{
    location: string;
    worldX: number;
    worldY: number;
    startTimeMs: number;
    player1: { participants: { [key: string]: number } };
    player2: { participants: { [key: string]: number } };
  }>;
  startTime: number;
  endTime: number;
};

export type RawBuildingEvent = {
  type: "buildingPlaced" | "buildingConstructed";
  subjectPlayerId: number;
  worldX: number;
  worldY: number;
  worldZ: number;
  entityId: number;
  worldTime: number;
};

export type BuildingEvent = {
  type: "buildingPlaced" | "buildingConstructed";
  playerId: number;
  buildingName: string;
  worldX: number;
  worldY: number;
  worldZ: number;
  entityId: number;
  refMasterId: number;
  worldTime: number;
  location: string;
  isForward: boolean;
  isCastle: boolean;
  isTownCenter: boolean;
  isDefensive: boolean;
};

export type StudyEventType =
  | RawBattleEvent
  | BattleEvent
  | BattlesEvent
  | RawBuildingEvent
  | BuildingEvent;

