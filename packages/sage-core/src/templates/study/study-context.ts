import { referenceUnit } from "../../aoe2/unit-reference.js";
import { DataSet } from "../../utility/data-set.js";
import type { Row } from "../../data/types.js";
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
      resolveName?: boolean;
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
        name?: string; // Omitted for numeric analysis
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
  // Per-window entity and master slices used to be cached here; the query
  // layer caches them now, so both backends benefit rather than just Arquero.
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

  /** The shape `queryEntity` reports for one entity. */
  private static readonly ENTITY_COLUMNS = [
    "ownerId",
    "id",
    "refMasterId",
    "masterId",
    "type",
  ];

  private toEntityResult(row: Row | undefined) {
    if (!row) return undefined;
    return {
      ownerId: row["ownerId"] as number,
      entityId: row["id"] as number,
      refMasterId: row["refMasterId"] as number,
      masterId: row["masterId"] as number,
      type: row["type"] as number,
    };
  }

  private getString(stringId: number): string | undefined {
    if (this.stringCache.has(stringId)) {
      return this.stringCache.get(stringId);
    }

    const [row] = this.dataSet.query.strings({ ids: [stringId] });
    const stringValue = row?.["string"] as string | undefined;
    if (stringValue) {
      this.stringCache.set(stringId, stringValue);
    }
    return stringValue;
  }

  private resolveMasterName(
    masterId: number,
    windowId: number,
  ): string | undefined {
    const [master] = this.dataSet.query.masters({
      bin: windowId,
      ids: [Math.abs(masterId)], // We negate master ids
      columns: ["stringId"],
    });

    const stringId = master?.["stringId"] as number | undefined;
    if (!stringId) {
      return referenceUnit(masterId)?.name;
    }

    return this.getString(stringId) ?? referenceUnit(masterId)?.name;
  }

  queryEntity(
    entityId: number,
    worldTime: number,
    options?: {
      playerId?: number;
      resolveName?: boolean;
      //   entityFields?: EntityFields[];
      //   masterFields?: MasterFields[];
    },
  ) {
    const windowId = this.dataSet.timeToWindow(worldTime);
    const cacheKey =
      this.getCacheKey(entityId, windowId, options?.playerId) +
      `:${options?.resolveName !== false}`;

    if (this.entityCache.has(cacheKey)) {
      return this.entityCache.get(cacheKey);
    }

    let entityResult = this.toEntityResult(
      this.dataSet.query.entities({
        bin: windowId,
        ids: [entityId],
        ...(options?.playerId === undefined
          ? {}
          : { ownerId: options.playerId }),
        columns: BaseContext.ENTITY_COLUMNS,
      })[0],
    );

    if (!entityResult?.entityId) {
      // arquero returns an object with allempty keys when it fails

      const alt = this.toEntityResult(
        this.dataSet.query.entities({
          bin: windowId + 1,
          ids: [entityId],
          ...(options?.playerId === undefined
            ? {}
            : { ownerId: options.playerId }),
          columns: BaseContext.ENTITY_COLUMNS,
        })[0],
      );
      if (alt?.entityId) {
        entityResult = alt;
      } else {
        // console.log("Quering all windows!");
        // Deliberately unfiltered by owner and by window: the entity may only
        // appear in a snapshot either side of the one being reported on.
        const alt2 = this.dataSet.query
          .entities({
            ids: [entityId],
            columns: [
              ...BaseContext.ENTITY_COLUMNS,
              "sage:binId",
              "sage:ductType",
            ],
          })
          .map((row) => ({
            ...this.toEntityResult(row)!,
            windowId: row["sage:binId"] as number,
            ductType: row["sage:ductType"] as number,
          }));
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

    if (options?.resolveName === false) {
      this.entityCache.set(cacheKey, entityResult);
      return entityResult;
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
