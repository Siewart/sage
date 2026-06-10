import { escape } from "arquero";
import { Struct } from "arquero/dist/types/table/types.js";
import type { ColumnTable } from "arquero";
import {
  masterToId,
  techToId,
  ageToId,
  researchStateToId,
  masterGroups,
  buildingGroups,
  unitMasterIds,
  buildingMasterIds,
} from "./aoe2/ids.js";

export interface GameState {
  timeMs: number;
  unitCounts: {
    [unitType: string]: { countTotal: number; countForward: number };
  };
  buildingCounts: {
    [buildingType: string]: { countTotal: number; countForward: number };
  };
  technologies: {
    [techName: string]:
      | "researched"
      | "researching"
      | "queued"
      | "unavailable"
      | "available";
  };
  villagerDistribution: {
    food: number;
    wood: number;
    gold: number;
    stone: number;
    building: number;
    other: number;
  };
  age: number;
  totalMilitaryUnits: number;
  totalEcoUnits: number;
  score: number;
}

export interface DataSetLike {
  t: {
    entities: ColumnTable;
    masters: ColumnTable;
    strings: ColumnTable;
    researchStates: ColumnTable;
    players: ColumnTable;
  };
  timeToWindow: (timeMs: number) => number;
  derivedParams?: {
    players?: Array<{ playerId: number; startX: number; startY: number }>;
    [key: string]: any; 
  };
  name?: string;
}

export class GameStateExtractor {
  constructor(private dataSet: DataSetLike) {}

  extractGameState(timeMs: number, playerId: number): GameState {
    const windowId = this.dataSet.timeToWindow(timeMs);

    // Pre-filter the entities table once for this windowId and playerId
    const filteredEntities = this.dataSet.t.entities.filter(
      escape(
        (d: Struct) =>
          d["sage:binId"] === windowId && d["ownerId"] === playerId,
      ),
    );

    // Pre-filter research states
    const filteredResearch = this.dataSet.t.researchStates.filter(
      escape(
        (d: Struct) =>
          d["sage:binId"] === windowId && d["playerId"] === playerId,
      ),
    );

    const unitCounts = this.extractUnitCounts(filteredEntities, playerId);
    const buildingCounts = this.extractBuildingCounts(
      filteredEntities,
      playerId,
    );
    const technologies = this.extractTechnologies(filteredResearch);
    const villagerDistribution = this.extractVillagerDistribution(
      filteredEntities,
      windowId,
    );
    const age = this.extractAge(filteredResearch);
    const { totalMilitaryUnits, totalEcoUnits, score } =
      this.extractPlayerTotals(windowId, playerId);

    return {
      timeMs,
      unitCounts,
      buildingCounts,
      technologies,
      villagerDistribution,
      age,
      totalMilitaryUnits,
      totalEcoUnits,
      score,
    } satisfies GameState;
  }

  private extractUnitCounts(filteredEntities: ColumnTable, playerId: number) {
    const units = filteredEntities
      .filter(escape((d: Struct) => this.isUnit(d["refMasterId"])))
      .lookup(
        this.dataSet.t.masters,
        [
          ["refMasterId", "sage:binId", "ownerId"],
          ["id", "sage:binId", "playerId"],
        ],
        ["stringId"],
      )
      .lookup(this.dataSet.t.strings, ["stringId", "id"], ["string"])
      .select("string", "refMasterId", "worldX", "worldY")
      .objects() as Array<{
      string: string;
      refMasterId: number;
      worldX: number;
      worldY: number;
    }>;

    // Group by unit type and calculate forward/total counts
    const unitCounts: {
      [unitType: string]: { countTotal: number; countForward: number };
    } = {};

    for (const unit of units) {
      const unitName = unit.string || `Unit_${unit.refMasterId}`;

      if (!unitCounts[unitName]) {
        unitCounts[unitName] = { countTotal: 0, countForward: 0 };
      }

      unitCounts[unitName].countTotal++;

      if (this.isForwardUnit(unit.worldX, unit.worldY, playerId)) {
        unitCounts[unitName].countForward++;
      }
    }

    return unitCounts;
  }

  private extractBuildingCounts(
    filteredEntities: ColumnTable,
    playerId: number,
  ) {
    const buildings = filteredEntities
      .filter(escape((d: Struct) => this.isBuilding(d["refMasterId"])))
      .lookup(
        this.dataSet.t.masters,
        [
          ["refMasterId", "sage:binId", "ownerId"],
          ["id", "sage:binId", "playerId"],
        ],
        ["stringId"],
      )
      .lookup(this.dataSet.t.strings, ["stringId", "id"], ["string"])
      .select("string", "refMasterId", "worldX", "worldY")
      .objects() as Array<{
      string: string;
      refMasterId: number;
      worldX: number;
      worldY: number;
    }>;

    // Group by building type and calculate forward/total counts
    const buildingCounts: {
      [buildingType: string]: { countTotal: number; countForward: number };
    } = {};

    for (const building of buildings) {
      const buildingName =
        building.string || `Building_${building.refMasterId}`;

      if (!buildingCounts[buildingName]) {
        buildingCounts[buildingName] = { countTotal: 0, countForward: 0 };
      }

      buildingCounts[buildingName].countTotal++;

      if (this.isForwardBuilding(building.worldX, building.worldY, playerId)) {
        buildingCounts[buildingName].countForward++;
      }
    }

    return buildingCounts;
  }

  private extractTechnologies(filteredResearch: ColumnTable) {
    const techs = filteredResearch
      .lookup(this.dataSet.t.strings, ["stringId", "id"], ["string"])
      .select("string", "researchId", "state")
      .objects() as Array<{
      string: string;
      researchId: number;
      state: number;
    }>;

    const technologies: {
      [techName: string]:
        | "researched"
        | "researching"
        | "queued"
        | "unavailable"
        | "available";
    } = {};

    for (const tech of techs) {
      const techName = tech.string || `Tech_${tech.researchId}`;
      technologies[techName] = this.mapResearchState(tech.state);
    }

    return technologies;
  }

  private extractVillagerDistribution(
    filteredEntities: ColumnTable,
    windowId: number,
  ) {
    const villagers = filteredEntities
      .filter(
        escape((d: Struct) => d["refMasterId"] === masterToId["Villager"]),
      )
      .select(
        "heldAttributeType",
        "heldAttributeAmount",
        "currentAction",
        "state",
      )
      .objects() as Array<{
      heldAttributeType: number;
      heldAttributeAmount: number;
      currentAction?: {
        actionType?: number;
        targetType?: number;
        targetId?: number;
      };
      state: number;
    }>;

    // Pre-load all entities for this window
    const allEntitiesInWindow = this.dataSet.t.entities
      .filter(escape((d: Struct) => d["sage:binId"] === windowId))
      .select("id", "refMasterId")
      .objects() as Array<{
      id: number;
      refMasterId: number;
    }>;

    const entityMap = new Map<number, number>();
    for (const entity of allEntitiesInWindow) {
      entityMap.set(entity.id, entity.refMasterId);
    }

    let gatheringFood = 0;
    let gatheringWood = 0;
    let gatheringGold = 0;
    let gatheringStone = 0;
    let building = 0;
    let other = 0;

    const unknownIds = new Map<string, number>(); // Track unknown masterIds we should add to ids.ts

    for (const villager of villagers) {
      const action = villager.currentAction;
      const heldResourceType = villager.heldAttributeType;
      const heldAmount = villager.heldAttributeAmount || 0;

      if (action?.targetType !== undefined && action?.targetId !== undefined) {
        const targetMasterId = entityMap.get(action.targetId);
        if (targetMasterId !== undefined) {
          const category = this.categorizeTargetMasterId(targetMasterId);
          switch (category) {
            case "food":
              gatheringFood++;
              break;
            case "wood":
              gatheringWood++;
              break;
            case "gold":
              gatheringGold++;
              break;
            case "stone":
              gatheringStone++;
              break;
            case "building":
              building++;
              break;
            default: {
              other++;
              const unknownKey = `unknown:${targetMasterId}`;
              unknownIds.set(unknownKey, (unknownIds.get(unknownKey) || 0) + 1);
              break;
            }
          }
        } else {
          other++;
        }
      } else if (heldAmount > 0) {
        // Fallback 0=food, 1=wood, 2=stone, 3=gold
        switch (heldResourceType) {
          case 0:
            gatheringFood++;
            break;
          case 1:
            gatheringWood++;
            break;
          case 2:
            gatheringStone++;
            break;
          case 3:
            gatheringGold++;
            break;
          default: {
            other++;
            break;
          }
        }
      } else {
        other++;
      }
    }

    if (unknownIds.size > 0) {
      console.log("      Unknown masterIds (consider adding to ids.ts):");
      Array.from(unknownIds.entries())
        .sort((a, b) => b[1] - a[1]) // Sort by count descending
        .forEach(([key, count]) => {
          console.log(`        ${key}: ${count}`);
        });
    }

    return {
      food: gatheringFood,
      wood: gatheringWood,
      gold: gatheringGold,
      stone: gatheringStone,
      building: building,
      other: other,
    };
  }

  private categorizeTargetMasterId(
    targetMasterId: number,
  ): "food" | "wood" | "gold" | "stone" | "building" | "other" {
    if (targetMasterId === masterToId["Gold Mine"]) {
      return "gold";
    } else if (targetMasterId === masterToId["Stone Mine"]) {
      return "stone";
    } else if (targetMasterId === masterToId["Farm"]) {
      // Farms are buildings but villagers working on them are gathering food
      return "food";
    } else if (this.isTreeTarget(targetMasterId)) {
      return "wood";
    } else if (this.isFoodSource(targetMasterId)) {
      return "food";
    } else if (buildingMasterIds.has(targetMasterId)) {
      return "building";
    } else {
      return "other";
    }
  }

  private isTreeTarget(masterId: number): boolean {
    return masterGroups.Trees?.includes(masterId) || false;
  }

  private isFoodSource(masterId: number): boolean {
    return (
      masterGroups.Herdables?.includes(masterId) ||
      masterGroups.Huntables?.includes(masterId) ||
      masterGroups["Forage Bushes"]?.includes(masterId) ||
      false
    );
  }

  private extractAge(filteredResearch: ColumnTable): number {
    const ageUpgrades = filteredResearch
      .filter(
        escape((d: Struct) =>
          [
            techToId["Feudal Age"],
            techToId["Castle Age"],
            techToId["Imperial Age"],
          ].includes(d["researchId"]),
        ),
      )
      .objects() as Array<{ researchId: number; state: number }>;

    let age: number = ageToId["Dark Age"] ?? 0; 

    for (const upgrade of ageUpgrades) {
      if (
        upgrade.researchId === techToId["Feudal Age"] &&
        upgrade.state === researchStateToId["Researched"]
      )
        age = Math.max(age, ageToId["Feudal Age"] ?? 1);
      if (
        upgrade.researchId === techToId["Castle Age"] &&
        upgrade.state === researchStateToId["Researched"]
      )
        age = Math.max(age, ageToId["Castle Age"] ?? 2);
      if (
        upgrade.researchId === techToId["Imperial Age"] &&
        upgrade.state === researchStateToId["Researched"]
      )
        age = Math.max(age, ageToId["Imperial Age"] ?? 3);

      // Handle transitional states (currently researching)
      if (upgrade.state === researchStateToId["Researching"]) {
        if (upgrade.researchId === techToId["Feudal Age"])
          age = Math.max(age, ageToId["Researching Feudal Age"] ?? 0.5);
        if (upgrade.researchId === techToId["Castle Age"])
          age = Math.max(age, ageToId["Researching Castle Age"] ?? 1.5);
        if (upgrade.researchId === techToId["Imperial Age"])
          age = Math.max(age, ageToId["Researching Imperial Age"] ?? 2.5);
      }
    }

    return age;
  }

  private extractPlayerTotals(windowId: number, playerId: number) {
    const playerData = this.dataSet.t.players
      .filter(
        escape(
          (d: Struct) => d["sage:binId"] === windowId && d["id"] === playerId,
        ),
      )
      .select("id", "militaryPop", "civilianPop", "victoryPoints")
      .objects() as Array<{
      id: number;
      militaryPop: number;
      civilianPop: number;
      victoryPoints: number;
    }>;

    if (playerData.length === 0) {
      return { totalMilitaryUnits: 0, totalEcoUnits: 0, score: 0 };
    }

    const player = playerData[0];
    if (!player) {
      return { totalMilitaryUnits: 0, totalEcoUnits: 0, score: 0 };
    }

    return {
      totalMilitaryUnits: player.militaryPop || 0,
      totalEcoUnits: player.civilianPop || 0,
      score: player.victoryPoints || 0,
    };
  }

  private isUnit(masterId: number): boolean {
    return unitMasterIds.has(masterId);
  }

  private isBuilding(masterId: number): boolean {
    for (const buildingType in buildingGroups) {
      const buildingIds =
        buildingGroups[buildingType as keyof typeof buildingGroups];
      if ((buildingIds as readonly number[]).includes(masterId)) {
        return true;
      }
    }

    return buildingMasterIds.has(masterId);
  }

  private isForwardUnit(x: number, y: number, playerId: number): boolean {
    const playerData = this.dataSet.derivedParams?.players?.find(
      (p: { playerId: number; startX: number; startY: number }) =>
        p.playerId === playerId,
    );
    if (!playerData) return false;

    const distance = Math.sqrt(
      Math.pow(x - playerData.startX, 2) + Math.pow(y - playerData.startY, 2),
    );

    // Consider units forward if > 40 tiles from starting position
    const FORWARD_UNIT_DISTANCE_THRESHOLD = 40;
    return distance > FORWARD_UNIT_DISTANCE_THRESHOLD;
  }

  private isForwardBuilding(x: number, y: number, playerId: number): boolean {
    // Get player starting position from derived params
    const playerData = this.dataSet.derivedParams?.players?.find(
      (p: { playerId: number; startX: number; startY: number }) =>
        p.playerId === playerId,
    );
    if (!playerData) return false;

    const distance = Math.sqrt(
      Math.pow(x - playerData.startX, 2) + Math.pow(y - playerData.startY, 2),
    );

    // 60 tiles for buildings since their positining is more intentional
    const FORWARD_BUILDING_DISTANCE_THRESHOLD = 60;
    return distance > FORWARD_BUILDING_DISTANCE_THRESHOLD;
  }

  private mapResearchState(
    state: number,
  ): "researched" | "researching" | "queued" | "unavailable" | "available" {
    switch (state) {
      case researchStateToId["Researched"]:
        return "researched";
      case researchStateToId["Researching"]:
        return "researching";
      case researchStateToId["Queued"]:
        return "queued";
      case researchStateToId["CanResearch"]:
        return "available";
      default:
        return "unavailable";
    }
  }
}

export function createGameStateFromData(
  dataSet: DataSetLike,
  timeMs: number,
  playerId: number = 1,
): GameState {
  const extractor = new GameStateExtractor(dataSet);
  return extractor.extractGameState(timeMs, playerId);
}

