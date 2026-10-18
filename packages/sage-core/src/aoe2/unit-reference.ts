import units from "./reference/units.json" with { type: "json" };
import type { SageQuery, Row } from "../data/types.js";
type ReferenceUnit = { name: string; stringId: number; type: number };
const reference: Record<number, ReferenceUnit> = units;
const byString = new Map<number, number>();
for (const [id, unit] of Object.entries(reference)) {
  if ((unit.type === 70 || unit.type === 80) && !byString.has(unit.stringId))
    byString.set(unit.stringId, Number(id));
}
export const referenceUnit = (id: number) => reference[Math.abs(id)];
/** Resolve upgrades by numeric language identity, without reading a display label. */
export function canonicalUnitId(
  masterId: number | undefined,
  refMasterId: number | undefined,
  stringId: number | undefined,
) {
  if (stringId !== undefined) {
    for (const id of [masterId, refMasterId])
      if (id !== undefined && referenceUnit(id)?.stringId === stringId)
        return Math.abs(id);
    const canonical = byString.get(stringId);
    if (canonical !== undefined) return canonical;
  }
  return masterId ?? refMasterId;
}
const strings = new Map<number, string>();
for (const unit of Object.values(reference))
  if (!strings.has(unit.stringId)) strings.set(unit.stringId, unit.name);
/** Match dictionaries take precedence; the pinned reference only fills missing names. */
export function withReferenceNames(query: SageQuery): SageQuery {
  const wrapped = Object.create(query) as SageQuery;
  wrapped.strings = (filter) => {
    const rows = query.strings(filter);
    if (!filter?.ids) return rows;
    const result = [...rows];
    const present = new Set(rows.map((row) => Number(row["id"])));
    for (const id of filter.ids) {
      const name = strings.get(id);
      if (!present.has(id) && name) result.push({ id, string: name });
    }
    return result;
  };
  const fill = (row: Row, entity: boolean) => {
    if (typeof row["name"] === "string" && row["name"]) return row;
    const name =
      strings.get(Number(row["stringId"])) ??
      (entity ? referenceUnit(Number(row["refMasterId"]))?.name : undefined);
    return name ? { ...row, name } : row;
  };
  wrapped.namedEntities = (filter) =>
    query.namedEntities(filter).map((row) => fill(row, true));
  wrapped.namedResearchStates = (filter) =>
    query.namedResearchStates(filter).map((row) => fill(row, false));
  return new Proxy(wrapped, {
    get(target, key, receiver) {
      if (Object.prototype.hasOwnProperty.call(target, key))
        return Reflect.get(target, key, receiver);
      const value = Reflect.get(query, key);
      return typeof value === "function" ? value.bind(query) : value;
    },
  });
}
