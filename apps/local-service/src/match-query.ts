import { createHash } from "node:crypto";
import fs from "node:fs";
import type {
  InspectionRequest,
  InspectionResult,
} from "@sage/contracts/explorer";
import type { DuckDbQuery } from "@sage/data/duckdb/query";
import {
  VIEWS,
  quoteIdent as qi,
  quoteString as qs,
} from "@sage/data/duckdb/sql";

/** All predicates and pages execute in DuckDB. No user SQL crosses this boundary. */
export function inspectMatch(
  query: DuckDbQuery,
  descriptor: string,
  input: InspectionRequest,
): InspectionResult {
  if (input.kind === "info") {
    const settings = query.settings();
    return {
      info: {
        name: query.name,
        key: createHash("sha256")
          .update(descriptor)
          .update(fs.readFileSync(descriptor))
          .digest("hex"),
        bins: query.binTimes().map((b) => [b[0], b[1]]),
        mapWidth: Number(settings.mapWidth),
        mapHeight: Number(settings.mapHeight),
        players: query.players({ bin: 0, columns: ["id", "name", "color"] }),
        eventTypes: query
          .sql(
            'SELECT DISTINCT "sage:modelType" AS type FROM events ORDER BY type',
          )
          .map((r) => String(r.type)),
      },
    };
  }
  if (input.kind === "terrain") {
    const rows = query.sql(
      "SELECT x,y,terrainType AS type,elevationLevel AS elevation FROM map_cells ORDER BY __ord LIMIT 1000001",
    );
    return {
      terrain: rows.slice(0, 1000000) as {
        x: number;
        y: number;
        type: number;
        elevation: number;
      }[],
      truncated: rows.length > 1000000,
    };
  }
  const range = query.binToTimes(input.bin);
  if (input.kind === "spatial") {
    const conditions = [
      `"sage:binId" = ${input.bin}`,
      "worldX IS NOT NULL",
      "worldY IS NOT NULL",
    ];
    if (input.player !== undefined)
      conditions.push(`ownerId = ${input.player}`);
    const where = conditions.join(" AND ");
    const total = Number(
      query.sql(`SELECT count(*) AS n FROM entities WHERE ${where}`)[0]?.n ?? 0,
    );
    return {
      total,
      truncated: total > 200000,
      entries: query.sql(
        `SELECT id,worldX AS x,worldY AS y,ownerId AS owner,refMasterId AS master FROM entities WHERE ${where} ORDER BY __ord LIMIT 200000`,
      ) as unknown as NonNullable<InspectionResult["entries"]>,
    };
  }
  const view = VIEWS[input.table === "mapCells" ? "map" : input.table];
  const columns = query
    .sql(`DESCRIBE ${view}`)
    .map((r) => String(r.column_name))
    .filter((c) => c !== "__ord");
  const has = (c: string) => columns.includes(c);
  const predicates: string[] = [];
  if (has("sage:binId")) predicates.push(`${qi("sage:binId")} = ${input.bin}`);
  if (input.table === "events") {
    const [start, end] = input.timeRange ?? range;
    if (end < start) throw new Error("Event range end must follow start");
    predicates.push(`worldTime >= ${start} AND worldTime <= ${end}`);
    if (input.eventType)
      predicates.push(`${qi("sage:modelType")} = ${qs(input.eventType)}`);
    if (input.player !== undefined)
      predicates.push(
        `(subjectPlayerId = ${input.player} OR objectPlayerId = ${input.player})`,
      );
    if (input.entity !== undefined)
      predicates.push(
        `(subjectEntity = ${input.entity} OR objectEntity = ${input.entity})`,
      );
  } else {
    if (input.player !== undefined) {
      const column =
        input.table === "players"
          ? "id"
          : has("ownerId")
            ? "ownerId"
            : has("playerId")
              ? "playerId"
              : undefined;
      if (column) predicates.push(`${qi(column)} = ${input.player}`);
    }
    if (input.entity !== undefined && input.table === "entities")
      predicates.push(`id = ${input.entity}`);
  }
  if (input.table === "entities" && input.entityIds)
    predicates.push(
      input.entityIds.length ? `id IN (${input.entityIds.join(",")})` : "false",
    );
  const where = predicates.length ? `WHERE ${predicates.join(" AND ")}` : "";
  const total = Number(
    query.sql(`SELECT count(*) AS n FROM ${view} ${where}`)[0]?.n ?? 0,
  );
  return {
    total,
    columns: ["_rowId", ...columns],
    rows: query.sql(
      `SELECT __ord AS _rowId,* EXCLUDE (__ord) FROM ${view} ${where} ORDER BY ${input.table === "events" ? "worldTime, " : ""}__ord LIMIT ${input.limit} OFFSET ${input.offset}`,
    ),
  };
}
