import { Struct } from "arquero/dist/types/table/types.js";
import { DataSet } from "../../utility/data-set.js";
import { escape } from "arquero";
import type { ColumnTable } from "arquero";
import { BaseBreakdown } from "../../fuzzy/strategy-detector.js";
import type { DeferredRealisation } from "./templates/defer.js";

export interface PlayerStrategy {
  type: string;
  confidence: number;
  firstSeenTime: number; // worldTime when detected
  indicators: (BaseBreakdown | undefined)[]; // Evidence that led to this strategy detection
}

export interface Context<DataSetType extends DataSet> {
  addDeferredRealisation: <T>(type: DeferredRealisation<T>) => void;
  popDeferredRealisations: <T>() => DeferredRealisation<T>[];
  peekDeferredRealisations: <T>() => DeferredRealisation<T>[];
  getLastDeferredRealisationTime: () => number;
  setLastDeferredRealisationTime: (time: number) => void;

  queryEntity: (
    entityId: number,
    worldTime: number,
    options?: {
      playerId?: number;
      //   entityFields?: EntityFields[];
      //   masterFields?: MasterFields[];
    },
  ) =>
    | {
        ownerId: number;
        entityId: number;
        refMasterId: number;
        masterId: number;
        type: number;
        name: string; // Resolved entity name
      }
    | undefined;

  trackedTechs: number[];

  getPlayerStrategy: (playerId: number) => PlayerStrategy | undefined;
  updatePlayerStrategy: (playerId: number, strategy: PlayerStrategy) => void;
  getStrategyHistory: (playerId: number) => PlayerStrategy[];

  getDataSet: () => DataSetType;

  getLastBattleReportTime: () => number | undefined;
  setLastBattleReportTime: (worldTime: number) => void;
}

export class BaseContext<DataSetType extends DataSet>
  implements Context<DataSetType>
{
  private deferredRealisations: DeferredRealisation<unknown>[] = [];
  private lastDeferredRealisationTime: number = 0;

  public addDeferredRealisation<T>(defer: DeferredRealisation<T>) {
    this.deferredRealisations.push(defer);
    this.lastDeferredRealisationTime = Math.max(
      this.lastDeferredRealisationTime,
      defer.time,
    );
  }

  public popDeferredRealisations<T>(): DeferredRealisation<T>[] {
    this.lastDeferredRealisationTime = this.deferredRealisations.reduce(
      (max, d) => Math.max(max, d.time),
      this.lastDeferredRealisationTime,
    );
    const result = this.deferredRealisations;
    this.deferredRealisations = [];
    return result as DeferredRealisation<T>[];
  }

  public peekDeferredRealisations<T>(): DeferredRealisation<T>[] {
    return this.deferredRealisations as DeferredRealisation<T>[];
  }

  public getLastDeferredRealisationTime: () => number = () => {
    return this.lastDeferredRealisationTime;
  };

  public setLastDeferredRealisationTime(time: number): void {
    this.lastDeferredRealisationTime = time;
  }

  private entityCache = new Map<
    string,
    ReturnType<Context<DataSetType>["queryEntity"]>
  >();
  private windowCache = new Map<number, ColumnTable>(); // Cache filtered tables by windowId
  private masterWindowCache = new Map<number, ColumnTable>(); // Cache filtered masters by windowId
  private stringCache = new Map<number, string>(); // Cache strings by stringId

  private playerStrategies = new Map<number, PlayerStrategy>();
  private strategyHistory = new Map<number, PlayerStrategy[]>();

  private lastBattleReportTime: number | undefined = undefined;

  constructor(private dataSet: DataSet) {}
  public readonly trackedTechs: number[] = [];

  private getCacheKey(
    entityId: number,
    windowId: number,
    playerId?: number,
  ): string {
    return `${entityId}:${windowId}:${playerId ?? "any"}`;
  }

  private getWindowEntities(windowId: number): ColumnTable {
    if (this.windowCache.has(windowId)) {
      return this.windowCache.get(windowId)!;
    }

    const windowEntities = this.dataSet.baseTables.entities.filter(
      escape((e: Struct) => e["sage:binId"] === windowId),
    );

    this.windowCache.set(windowId, windowEntities);
    return windowEntities;
  }

  private getWindowMasters(windowId: number): ColumnTable {
    if (this.masterWindowCache.has(windowId)) {
      return this.masterWindowCache.get(windowId)!;
    }

    const windowMasters = this.dataSet.baseTables.masters.filter(
      escape((m: Struct) => m["sage:binId"] === windowId),
    );

    this.masterWindowCache.set(windowId, windowMasters);
    return windowMasters;
  }

  private getString(stringId: number): string | undefined {
    if (this.stringCache.has(stringId)) {
      return this.stringCache.get(stringId);
    }

    const stringResult = this.dataSet.baseTables.strings
      .filter(escape((s: Struct) => s["id"] === stringId))
      .select("string")
      .object() as { string?: string } | undefined;

    const stringValue = stringResult?.string;
    if (stringValue) {
      this.stringCache.set(stringId, stringValue);
    }
    return stringValue;
  }

  private resolveMasterName(
    masterId: number,
    windowId: number,
  ): string | undefined {
    const windowMasters = this.getWindowMasters(windowId);

    const masterResult = windowMasters
      .filter(escape((m: Struct) => m["id"] === Math.abs(masterId))) // We negate master ids
      .select("stringId")
      .object() as { stringId?: number } | undefined;

    if (!masterResult?.stringId) {
      return undefined;
    }

    return this.getString(masterResult.stringId);
  }

  queryEntity(
    entityId: number,
    worldTime: number,
    options?: {
      playerId?: number;
      //   entityFields?: EntityFields[];
      //   masterFields?: MasterFields[];
    },
  ) {
    const windowId = this.dataSet.timeToWindow(worldTime);
    const cacheKey = this.getCacheKey(entityId, windowId, options?.playerId);

    if (this.entityCache.has(cacheKey)) {
      return this.entityCache.get(cacheKey);
    }

    const windowEntities = this.getWindowEntities(windowId);

    // Filter on the window-sized table rather than all entities
    let entityResult = windowEntities
      .filter(
        escape(
          (e: Struct) =>
            e["id"] === entityId &&
            (options?.playerId === undefined ||
              options?.playerId === e["ownerId"]),
        ),
      )
      .select({
        ownerId: "ownerId",
        id: "entityId",
        refMasterId: "refMasterId",
        masterId: "masterId",
        type: "type",
      })
      .object() as
      | {
          ownerId: number;
          entityId: number;
          refMasterId: number;
          masterId: number;
          type: number;
        }
      | undefined;

    if (!entityResult?.entityId) {
      // arquero returns an object with allempty keys when it fails

      const alt = this.getWindowEntities(windowId + 1)
        .filter(
          escape(
            (e: Struct) =>
              e["id"] === entityId &&
              (options?.playerId === undefined ||
                options?.playerId === e["ownerId"]),
          ),
        )
        .select({
          ownerId: "ownerId",
          id: "entityId",
          refMasterId: "refMasterId",
          masterId: "masterId",
          type: "type",
        })
        .object() as
        | {
            ownerId: number;
            entityId: number;
            refMasterId: number;
            masterId: number;
            type: number;
          }
        | undefined;
      if (alt?.entityId) {
        entityResult = alt;
      } else {
        // console.log("Quering all windows!");
        const alt2 = this.dataSet.baseTables.entities
          .filter(
            escape(
              (e: Struct) => e["id"] === entityId, //&&
              // (options?.playerId === undefined ||
              //   options?.playerId === e["ownerId"]),
            ),
          )
          .select({
            ownerId: "ownerId",
            id: "entityId",
            refMasterId: "refMasterId",
            masterId: "masterId",
            type: "type",
            "sage:binId": "windowId",
            "sage:ductType": "ductType",
          })
          .objects() as
          | {
              ownerId: number;
              entityId: number;
              refMasterId: number;
              masterId: number;
              type: number;
              windowId: number;
              ductType: number;
            }[]
          | undefined;
        if (alt2?.[0]?.entityId) {
          // Find the entity with windowId closest to the outer scope windowId
          const closest = alt2.reduce((prev, curr) => {
            return Math.abs(curr.windowId - windowId) <
              Math.abs(prev.windowId - windowId)
              ? curr
              : prev;
          });
          console.log(
            "Fell back to closest window for entity",
            entityId,
            `(${closest.windowId - windowId} windows away)`,
          );
          entityResult = closest;
        } else {
          console.log("Entity not found:", { entityId, windowId, options });
          this.entityCache.set(cacheKey, undefined);
          return undefined;
        }
      }
    }

    // Resolve the entity name through master -> string lookup
    let name = this.resolveMasterName(entityResult.masterId, windowId);
    if (!name) {
      name = this.resolveMasterName(entityResult.refMasterId, windowId);
    }

    if (!name) {
      console.log(
        "Could not find name for refMasterId",
        entityResult.refMasterId,
        "masterId:",
        entityResult.masterId,
        entityResult,
      );
      name = "<<Unknown>>";
    }

    const result = {
      ...entityResult,
      name,
    };

    this.entityCache.set(cacheKey, result);
    return result;
  }

  getPlayerStrategy(playerId: number): PlayerStrategy | undefined {
    return this.playerStrategies.get(playerId);
  }

  updatePlayerStrategy(playerId: number, strategy: PlayerStrategy): void {
    this.playerStrategies.set(playerId, strategy);

    const history = this.strategyHistory.get(playerId) ?? [];
    history.push(strategy);
    this.strategyHistory.set(playerId, history);
  }

  getStrategyHistory(playerId: number): PlayerStrategy[] {
    return this.strategyHistory.get(playerId) ?? [];
  }

  getDataSet(): DataSetType {
    return this.dataSet as DataSetType;
  }

  getLastBattleReportTime(): number | undefined {
    return this.lastBattleReportTime;
  }

  setLastBattleReportTime(worldTime: number): void {
    this.lastBattleReportTime = worldTime;
  }
}

