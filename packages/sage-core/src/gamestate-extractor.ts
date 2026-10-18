import {
  masterToId,
  techToId,
  ageToId,
  researchStateToId,
  masterGroups,
  unitMasterIds,
  buildingMasterIds,
  buildingLikeMasterIds,
} from "./aoe2/ids.js";
import type { SageQuery } from "./data/types.js";

export interface GameState {
  identityKeys?: {
    masters: Record<number, string>;
    technologies: Record<number, string>;
  };
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
  query: SageQuery;
  timeToWindow: (timeMs: number) => number;
  derivedParams?: {
    players?: Array<{ playerId: number; startX: number; startY: number }>;
    [key: string]: any;
  };
  name?: string;
}

const UNIT_MASTER_IDS = [...unitMasterIds];
const BUILDING_MASTER_IDS = [...buildingLikeMasterIds];

// Compile existing semantic rule labels once; event/game-state rows keep numeric keys.
const ruleDictionaries = new WeakMap<
  SageQuery,
  {
    canonical: Map<number, number>;
    masters: Record<number, string>;
    technologies: Record<number, string>;
  }
>();
function ruleDictionary(query: SageQuery) {
  const cached = ruleDictionaries.get(query);
  if (cached) return cached;
  const byName = new Map<string, number>();
  const canonical = new Map<number, number>();
  for (const row of query.strings({})) {
    const name = String(row["string"]),
      id = Number(row["id"]);
    if (!byName.has(name)) byName.set(name, id);
    canonical.set(id, byName.get(name)!);
  }
  const compile = (catalog: Record<string, number>) =>
    Object.fromEntries(
      Object.entries(catalog)
        .filter(([name]) => byName.has(name))
        .map(([name, id]) => [id, `string:${byName.get(name)}`]),
    );
  const result = {
    canonical,
    masters: compile(masterToId),
    technologies: compile(techToId),
  };
  ruleDictionaries.set(query, result);
  return result;
}

export class GameStateExtractor {
  private masterKeys: Record<number, string> = {};
  private technologyKeys: Record<number, string> = {};
  constructor(
    private dataSet: DataSetLike,
    private labels: "names" | "ids" = "names",
  ) {}

  extractGameState(timeMs: number, playerId: number): GameState {
    const windowId = this.dataSet.timeToWindow(timeMs);

    this.masterKeys =
      this.labels === "ids"
        ? Object.fromEntries(
            this.dataSet.query
              .masters({ bin: windowId, playerId, columns: ["id", "stringId"] })
              .map((row) => [
                Number(row["id"]),
                `string:${ruleDictionary(this.dataSet.query).canonical.get(Number(row["stringId"])) ?? row["stringId"]}`,
              ]),
          )
        : {};
    this.technologyKeys = {};
    const unitCounts = this.extractUnitCounts(windowId, playerId);
    const buildingCounts = this.extractBuildingCounts(windowId, playerId);
    const technologies = this.extractTechnologies(windowId, playerId);
    const villagerDistribution = this.extractVillagerDistribution(
      windowId,
      playerId,
    );
    const age = this.extractAge(windowId, playerId);
    const { totalMilitaryUnits, totalEcoUnits, score } =
      this.extractPlayerTotals(windowId, playerId);

    return {
      timeMs,
      ...(this.labels === "ids"
        ? {
            identityKeys: {
              masters: ruleDictionary(this.dataSet.query).masters,
              technologies: ruleDictionary(this.dataSet.query).technologies,
            },
          }
        : {}),
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

  private extractUnitCounts(windowId: number, playerId: number) {
    const units = this.dataSet.query[
      this.labels === "ids" ? "entities" : "namedEntities"
    ]({
      bin: windowId,
      ownerId: playerId,
      masterIds: UNIT_MASTER_IDS,
      columns: ["refMasterId", "worldX", "worldY"],
    }) as Array<{
      name: string;
      refMasterId: number;
      worldX: number;
      worldY: number;
    }>;

    // Group by unit type and calculate forward/total counts
    const unitCounts: {
      [unitType: string]: { countTotal: number; countForward: number };
    } = {};

    for (const unit of units) {
      const unitName =
        this.labels === "ids"
          ? (this.masterKeys[unit.refMasterId] ?? `unknown:${unit.refMasterId}`)
          : unit.name || `Unit_${unit.refMasterId}`;

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

  private extractBuildingCounts(windowId: number, playerId: number) {
    const buildings = this.dataSet.query[
      this.labels === "ids" ? "entities" : "namedEntities"
    ]({
      bin: windowId,
      ownerId: playerId,
      masterIds: BUILDING_MASTER_IDS,
      columns: ["refMasterId", "worldX", "worldY"],
    }) as Array<{
      name: string;
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
        this.labels === "ids"
          ? (this.masterKeys[building.refMasterId] ??
            `unknown:${building.refMasterId}`)
          : building.name || `Building_${building.refMasterId}`;

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

  private extractTechnologies(windowId: number, playerId: number) {
    const techs = this.dataSet.query[
      this.labels === "ids" ? "researchStates" : "namedResearchStates"
    ]({
      bin: windowId,
      playerId,
    }) as Array<{
      name: string;
      researchId: number;
      stringId: number;
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
      if (this.labels === "ids")
        this.technologyKeys[tech.researchId] =
          `string:${ruleDictionary(this.dataSet.query).canonical.get(tech.stringId) ?? tech.stringId}`;
      const techName =
        this.labels === "ids"
          ? this.technologyKeys[tech.researchId]!
          : tech.name || `Tech_${tech.researchId}`;
      technologies[techName] = this.mapResearchState(tech.state);
    }

    return technologies;
  }

  private extractVillagerDistribution(windowId: number, playerId: number) {
    const villagers = this.dataSet.query.entities({
      bin: windowId,
      ownerId: playerId,
      masterIds: [masterToId["Villager"]],
      columns: [
        "heldAttributeType",
        "heldAttributeAmount",
        "currentAction",
        "state",
      ],
    }) as Array<{
      heldAttributeType: number;
      heldAttributeAmount: number;
      currentAction?: {
        actionType?: number;
        targetType?: number;
        targetId?: number;
      };
      state: number;
    }>;

    // Villagers gather from entities owned by anyone (or by Gaia), so the
    // target lookup spans the whole window rather than this player's entities.
    const allEntitiesInWindow = this.dataSet.query.entities({
      bin: windowId,
      columns: ["id", "refMasterId"],
    }) as Array<{
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

  private extractAge(windowId: number, playerId: number): number {
    const ageUpgrades = this.dataSet.query.researchStates({
      bin: windowId,
      playerId,
      researchIds: [
        techToId["Feudal Age"],
        techToId["Castle Age"],
        techToId["Imperial Age"],
      ].filter((id): id is number => id !== undefined),
    }) as Array<{ researchId: number; state: number }>;

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
    const playerData = this.dataSet.query.players({
      bin: windowId,
      id: playerId,
      columns: ["id", "militaryPop", "civilianPop", "victoryPoints"],
    }) as Array<{
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
