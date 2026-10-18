import type {
  EntityFilter,
  EventFilter,
  MapFilter,
  MasterFilter,
  NamedEntityFilter,
  PlayerFilter,
  ResearchFilter,
  StringFilter,
  WorldFilter,
} from "../types.js";

/** View names created by `registerMatch`, one per SAGE table. */
export const VIEWS = {
  entities: "entities",
  masters: "masters",
  strings: "strings",
  researchStates: "research_states",
  players: "players",
  events: "events",
  map: "map_cells",
  settings: "settings",
  world: "world",
} as const;

/** Ordinal column added at registration so results keep source-file order. */
export const ORD = "__ord";

export function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

export function quoteString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function numberLiteral(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error(`Refusing to inline non-finite number in SQL: ${value}`);
  }
  return String(value);
}

/** `col IN (...)`, or a constant false for an empty list. */
function inNumbers(columnExpr: string, values: readonly number[]): string {
  if (values.length === 0) return "false";
  return `${columnExpr} IN (${values.map(numberLiteral).join(", ")})`;
}

function inStrings(columnExpr: string, values: readonly string[]): string {
  if (values.length === 0) return "false";
  return `${columnExpr} IN (${values.map(quoteString).join(", ")})`;
}

function where(conditions: readonly string[]): string {
  return conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
}

/**
 * `__ord` is an implementation detail of ordering and must never reach callers:
 * the Arquero backend has no such column, and a stray one would fail parity.
 */
function projection(
  columns: readonly string[] | undefined,
  prefix = "",
): string {
  if (!columns || columns.length === 0) return `${prefix}* EXCLUDE (${ORD})`;
  return columns.map((c) => `${prefix}${quoteIdent(c)}`).join(", ");
}

const dedupe = (columns: readonly string[]) => [...new Set(columns)];

function entityConditions(filter: EntityFilter, prefix = ""): string[] {
  const col = (name: string) => `${prefix}${quoteIdent(name)}`;
  const conditions: string[] = [];
  if (filter.bin !== undefined) {
    conditions.push(`${col("sage:binId")} = ${numberLiteral(filter.bin)}`);
  }
  if (filter.ownerId !== undefined) {
    conditions.push(`${col("ownerId")} = ${numberLiteral(filter.ownerId)}`);
  }
  if (filter.ids !== undefined)
    conditions.push(inNumbers(col("id"), filter.ids));
  if (filter.masterIds !== undefined) {
    conditions.push(inNumbers(col("refMasterId"), filter.masterIds));
  }
  if (filter.near !== undefined) {
    const { x, y, radius } = filter.near;
    conditions.push(
      `sqrt(pow(${col("worldX")} - ${numberLiteral(x)}, 2) + ` +
        `pow(${col("worldY")} - ${numberLiteral(y)}, 2)) <= ${numberLiteral(radius)}`,
    );
  }
  return conditions;
}

export function entitiesSql(filter: EntityFilter): string {
  return (
    `SELECT ${projection(filter.columns)} FROM ${VIEWS.entities} ` +
    `${where(entityConditions(filter))} ORDER BY ${ORD}`
  );
}

/**
 * Entities ⨝ masters ⨝ strings.
 *
 * Arquero's `lookup` keeps one right-hand row per key, so this is only
 * equivalent to a left join because `(id, sage:binId, playerId)` on `masters`
 * and `id` on `strings` are unique — which the parity check asserts.
 */
export function namedEntitiesSql(filter: NamedEntityFilter): string {
  const entityColumns = dedupe([
    "id",
    "refMasterId",
    "ownerId",
    "sage:binId",
    ...(filter.columns ?? []),
  ]);
  const masterColumns = dedupe(["stringId", ...(filter.masterColumns ?? [])]);
  // `masters` and `entities` share some column names (`hp`, `type`). Arquero's
  // lookup writes the master value over the entity one, so drop the entity
  // side here to match rather than emit two columns of the same name.
  const projectedEntityColumns = entityColumns.filter(
    (column) => !masterColumns.includes(column),
  );
  return (
    `SELECT ${projection(projectedEntityColumns, "e.")}, ` +
    `${masterColumns.map((c) => `m.${quoteIdent(c)}`).join(", ")}, ` +
    `s.${quoteIdent("string")} AS ${quoteIdent("name")} ` +
    `FROM ${VIEWS.entities} e ` +
    `LEFT JOIN ${VIEWS.masters} m ON e.${quoteIdent("refMasterId")} = m.${quoteIdent("id")} ` +
    `AND e.${quoteIdent("sage:binId")} = m.${quoteIdent("sage:binId")} ` +
    `AND e.${quoteIdent("ownerId")} = m.${quoteIdent("playerId")} ` +
    `LEFT JOIN ${VIEWS.strings} s ON m.${quoteIdent("stringId")} = s.${quoteIdent("id")} ` +
    `${where(entityConditions(filter, "e."))} ORDER BY e.${ORD}`
  );
}

function researchConditions(filter: ResearchFilter, prefix = ""): string[] {
  const col = (name: string) => `${prefix}${quoteIdent(name)}`;
  const conditions = [`${col("sage:binId")} = ${numberLiteral(filter.bin)}`];
  if (filter.playerId !== undefined) {
    conditions.push(`${col("playerId")} = ${numberLiteral(filter.playerId)}`);
  }
  if (filter.researchIds !== undefined) {
    conditions.push(inNumbers(col("researchId"), filter.researchIds));
  }
  return conditions;
}

export function researchStatesSql(filter: ResearchFilter): string {
  return (
    `SELECT ${projection(filter.columns)} FROM ${VIEWS.researchStates} ` +
    `${where(researchConditions(filter))} ORDER BY ${ORD}`
  );
}

export function namedResearchStatesSql(filter: ResearchFilter): string {
  const columns = dedupe([
    "stringId",
    "researchId",
    "playerId",
    "state",
    ...(filter.columns ?? []),
  ]);
  return (
    `SELECT ${projection(columns, "r.")}, s.${quoteIdent("string")} AS ${quoteIdent("name")} ` +
    `FROM ${VIEWS.researchStates} r ` +
    `LEFT JOIN ${VIEWS.strings} s ON r.${quoteIdent("stringId")} = s.${quoteIdent("id")} ` +
    `${where(researchConditions(filter, "r."))} ORDER BY r.${ORD}`
  );
}

export function playersSql(filter: PlayerFilter = {}): string {
  const conditions: string[] = [];
  if (filter.bin !== undefined) {
    conditions.push(
      `${quoteIdent("sage:binId")} = ${numberLiteral(filter.bin)}`,
    );
  }
  if (filter.id !== undefined) {
    conditions.push(`${quoteIdent("id")} = ${numberLiteral(filter.id)}`);
  }
  if (filter.minId !== undefined) {
    conditions.push(`${quoteIdent("id")} > ${numberLiteral(filter.minId)}`);
  }
  return (
    `SELECT ${projection(filter.columns)} FROM ${VIEWS.players} ` +
    `${where(conditions)} ORDER BY ${ORD}`
  );
}

export function eventsSql(filter: EventFilter = {}): string {
  const conditions: string[] = [];
  if (filter.modelTypes !== undefined) {
    conditions.push(inStrings(quoteIdent("sage:modelType"), filter.modelTypes));
  }
  if (filter.tags !== undefined) {
    conditions.push(inStrings(quoteIdent("tag"), filter.tags));
  }
  if (filter.timeRange !== undefined) {
    conditions.push(
      `${quoteIdent("worldTime")} BETWEEN ${numberLiteral(filter.timeRange[0])} ` +
        `AND ${numberLiteral(filter.timeRange[1])}`,
    );
  }
  if (filter.requireSubjectPlayer) {
    conditions.push(`${quoteIdent("subjectPlayerId")} > 0`);
  }
  if (filter.requireObjectPlayer) {
    conditions.push(`${quoteIdent("objectPlayerId")} > 0`);
  }
  return (
    `SELECT ${projection(filter.columns)} FROM ${VIEWS.events} ` +
    `${where(conditions)} ORDER BY ${ORD}`
  );
}

/**
 * Map cells carry a 1-based `id` over the *unfiltered* table, matching the
 * `op.row_number()` the map-quality code assigns before filtering.
 */
export function mapCellsSql(filter: MapFilter = {}): string {
  const conditions: string[] = [];
  if (filter.minElevationExclusive !== undefined) {
    conditions.push(
      `${quoteIdent("elevationLevel")} > ${numberLiteral(filter.minElevationExclusive)}`,
    );
  }
  if (filter.terrainTypes !== undefined) {
    conditions.push(inNumbers(quoteIdent("terrainType"), filter.terrainTypes));
  }
  const numbered = `SELECT *, row_number() OVER (ORDER BY ${ORD}) AS ${quoteIdent("id")} FROM ${VIEWS.map}`;
  return (
    `SELECT ${projection(filter.columns)} FROM (${numbered}) ` +
    `${where(conditions)} ORDER BY ${ORD}`
  );
}

export function mastersSql(filter: MasterFilter): string {
  const conditions = [
    `${quoteIdent("sage:binId")} = ${numberLiteral(filter.bin)}`,
  ];
  if (filter.playerId !== undefined) {
    conditions.push(
      `${quoteIdent("playerId")} = ${numberLiteral(filter.playerId)}`,
    );
  }
  if (filter.ids !== undefined) {
    conditions.push(inNumbers(quoteIdent("id"), filter.ids));
  }
  return (
    `SELECT ${projection(filter.columns)} FROM ${VIEWS.masters} ` +
    `${where(conditions)} ORDER BY ${ORD}`
  );
}

export function stringsSql(filter: StringFilter = {}): string {
  const conditions =
    filter.ids === undefined ? [] : [inNumbers(quoteIdent("id"), filter.ids)];
  return (
    `SELECT * EXCLUDE (${ORD}) FROM ${VIEWS.strings} ` +
    `${where(conditions)} ORDER BY ${ORD}`
  );
}

export function worldSql(filter: WorldFilter = {}): string {
  const conditions: string[] = [];
  if (filter.bin !== undefined) {
    conditions.push(
      `${quoteIdent("sage:binId")} = ${numberLiteral(filter.bin)}`,
    );
  }
  return (
    `SELECT ${projection(filter.columns)} FROM ${VIEWS.world} ` +
    `${where(conditions)} ORDER BY ${ORD}`
  );
}

export function settingsSql(): string {
  return `SELECT * EXCLUDE (${ORD}) FROM ${VIEWS.settings} LIMIT 1`;
}
