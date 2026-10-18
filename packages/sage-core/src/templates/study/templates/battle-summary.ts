import {
  canonicalUnitId,
  referenceUnit,
} from "../../../aoe2/unit-reference.js";
import type { Context } from "../study-context.js";
import type { initDataSetWithOverrides } from "../study-data-sets.js";
import type { RawBattleEvent } from "../study-events.js";

type BattleContext = Context<ReturnType<typeof initDataSetWithOverrides>>;
type Unit = {
  entityId: number;
  unitTypeId?: number | undefined;
  masterId?: number | undefined;
  refMasterId?: number | undefined;
  playerId: number;
  time: number;
  stringId?: number | undefined;
};
export type UnitCounts = Record<string, number>;

export function classifyBattleFacts(facts: {
  participantCount: number;
  casualtyCount: number;
  hasVillagers: boolean;
}) {
  if (facts.hasVillagers) return { classification: "raid", value: 0.9 };
  if (facts.participantCount > 15 && facts.casualtyCount > 8)
    return { classification: "major battle", value: 0.9 };
  if (facts.participantCount < 10 && facts.casualtyCount < 5)
    return { classification: "skirmish", value: 0.8 };
  return { classification: "battle", value: 0.6 };
}

// Entity IDs are instance IDs; master IDs identify unit types. Missing identities stay
// distinct instead of silently collapsing different units under one unknown name.
const unitKey = (unit: Unit) =>
  String(
    unit.unitTypeId ??
      unit.masterId ??
      unit.refMasterId ??
      `unresolved:${unit.entityId}`,
  );
export function countUnits(units: Unit[]): UnitCounts {
  const counts: UnitCounts = {};
  for (const unit of units) {
    const key = unitKey(unit);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}
function stringId(context: BattleContext, unit: Unit) {
  const query = context.getDataSet().query;
  const bin = context.getDataSet().timeToWindow(unit.time);
  for (const id of [unit.masterId, unit.refMasterId]) {
    if (id === undefined) continue;
    const value = query.masters({
      bin,
      ids: [Math.abs(id)],
      columns: ["stringId"],
    })[0]?.["stringId"];
    if (typeof value === "number") return value;
  }
  return undefined;
}
function nameCounts(counts: UnitCounts, units: Unit[], context: BattleContext) {
  const representatives = new Map(units.map((unit) => [unitKey(unit), unit]));
  const names: UnitCounts = {};
  for (const [id, count] of Object.entries(counts)) {
    const unit = representatives.get(id)!;
    const name =
      context.getDataSet().query.strings({
        ids: unit.stringId === undefined ? [] : [unit.stringId],
      })[0]?.["string"] ??
      referenceUnit(unit.unitTypeId ?? unit.masterId ?? unit.refMasterId ?? NaN)
        ?.name;
    // Flare/empty filtering is presentation-only. No counts are lost in raw facts.
    if (name === "" || name === "Flare") continue;
    const key = typeof name === "string" ? name : `Unknown unit ${id}`;
    names[key] = (names[key] ?? 0) + count;
  }
  return names;
}

export function summarizeBattle(raw: RawBattleEvent, context: BattleContext) {
  const events = raw.data.filter(
    (event) => event.type === "damage" || event.type === "death",
  );
  const player = (playerId: number) => {
    const lastSeen = new Map<number, number>();
    const dead = new Set<number>();
    for (const event of events) {
      for (const [owner, id] of [
        [event.objectPlayerId, event.objectEntity],
        [event.subjectPlayerId, event.subjectEntity],
      ] as const) {
        if (owner === playerId)
          lastSeen.set(
            id,
            Math.max(lastSeen.get(id) ?? event.worldTime, event.worldTime),
          );
      }
      if (event.type === "death" && event.objectPlayerId === playerId)
        dead.add(event.objectEntity);
    }
    const units = [...lastSeen].map(([entityId, time]) => {
      const entity = context.queryEntity(entityId, time, {
        playerId,
        resolveName: false,
      });
      const unit = {
        entityId,
        masterId: entity?.masterId,
        refMasterId: entity?.refMasterId,
        time,
        playerId,
      };
      const identity = stringId(context, unit);
      return {
        ...unit,
        stringId: identity,
        unitTypeId: canonicalUnitId(unit.masterId, unit.refMasterId, identity),
      };
    });
    const casualties = units.filter((unit) => dead.has(unit.entityId));
    const survivors = units.filter((unit) => !dead.has(unit.entityId));
    const facts = {
      participants: countUnits(units),
      casualties: countUnits(casualties),
      survivors: countUnits(survivors),
    };
    return {
      units,
      dead,
      facts,
      hydrate: () => ({
        participants: nameCounts(facts.participants, units, context),
        casualties: nameCounts(facts.casualties, casualties, context),
        survivors: nameCounts(facts.survivors, survivors, context),
      }),
    };
  };
  const player1 = player(1),
    player2 = player(2);
  const query = context.getDataSet().query;
  const bin = context.getDataSet().timeToWindow(raw.worldTime);
  const villagerString =
    query.masters({ bin, ids: [83], columns: ["stringId"] })[0]?.["stringId"] ??
    5606;
  const counts = {
    participantCount: player1.units.length + player2.units.length,
    casualtyCount: player1.dead.size + player2.dead.size,
    hasVillagers: [...player1.units, ...player2.units].some(
      (unit) => unit.stringId === villagerString,
    ),
  };
  const { data: _events, ...position } = raw;
  const facts = {
    ...position,
    ...counts,
    damageEventCount: raw.data.length,
    player1: player1.facts,
    player2: player2.facts,
    fightType: classifyBattleFacts(counts).classification,
  };
  return {
    facts,
    hydrate: () => ({
      ...facts,
      player1: player1.hydrate(),
      player2: player2.hydrate(),
    }),
  };
}

export function summarizeOngoingBattle(
  raw: RawBattleEvent,
  context: BattleContext,
  time: number,
) {
  const data = context.getDataSet();
  const player = (playerId: number) => {
    const ids = new Set<number>();
    for (const event of raw.data) {
      if (event.objectPlayerId === playerId) ids.add(event.objectEntity);
      if (event.subjectPlayerId === playerId) ids.add(event.subjectEntity);
    }
    // Match the existing ongoing report's snapshot semantics, without the string join.
    const units = data.query
      .entities({ bin: data.timeToWindow(time), ids: [...ids] })
      .map((row) => {
        const refMasterId = Number(row["refMasterId"]);
        const master = data.query.masters({
          bin: data.timeToWindow(time),
          playerId: Number(row["ownerId"]),
          ids: [refMasterId],
          columns: ["stringId"],
        })[0];
        return {
          entityId: Number(row["id"]),
          masterId: refMasterId,
          unitTypeId: canonicalUnitId(
            refMasterId,
            refMasterId,
            master?.["stringId"] as number | undefined,
          ),
          refMasterId,
          playerId,
          time,
          stringId: master?.["stringId"] as number | undefined,
        };
      });
    const facts = { participants: countUnits(units) };
    return {
      facts,
      hydrate: () => ({
        participants: nameCounts(facts.participants, units, context),
      }),
    };
  };
  const player1 = player(1),
    player2 = player(2);
  const facts = {
    worldX: raw.worldX,
    worldY: raw.worldY,
    startTimeMs: raw.startTimeMs,
    player1: player1.facts,
    player2: player2.facts,
  };
  return {
    facts,
    hydrate: () => ({
      ...facts,
      player1: player1.hydrate(),
      player2: player2.hydrate(),
    }),
  };
}
