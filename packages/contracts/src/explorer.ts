import { z } from "zod";
import type { Realization } from "./index.js";

export const matchTable = z.enum([
  "events",
  "entities",
  "players",
  "researchStates",
  "world",
  "masters",
  "strings",
  "mapCells",
  "settings",
]);
export const inspectionSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(["info", "rows", "spatial", "terrain"]),
  bin: z.number().int().min(0).default(0),
  table: matchTable.default("entities"),
  offset: z.number().int().min(0).max(100000000).default(0),
  limit: z.number().int().min(1).max(100).default(30),
  player: z.number().int().min(0).optional(),
  entity: z.number().int().min(0).optional(),
  entityIds: z.array(z.number().int().nonnegative()).max(500).optional(),
  eventType: z.string().max(100).optional(),
  timeRange: z
    .tuple([
      z.number().nonnegative().finite(),
      z.number().nonnegative().finite(),
    ])
    .optional(),
});
export type InspectionRequest = z.infer<typeof inspectionSchema>;
export type DataRow = Record<string, unknown>;
export interface MatchInfo {
  name: string;
  key: string;
  bins: [number, number][];
  mapWidth: number;
  mapHeight: number;
  eventTypes: string[];
  players: DataRow[];
}
export interface SpatialEntry {
  id: number;
  x: number;
  y: number;
  owner: number;
  master: number;
}
export interface InspectionResult {
  info?: MatchInfo;
  rows?: DataRow[];
  total?: number;
  columns?: string[];
  entries?: SpatialEntry[];
  truncated?: boolean;
  terrain?: { x: number; y: number; type: number; elevation: number }[];
}
export interface CoverageProgress {
  throughMs: number | null;
  processingMs: number | null;
  complete?: boolean;
}
export interface CommentaryContext {
  state:
    | "not-generated"
    | "processing"
    | "partial"
    | "analyzed"
    | "failed"
    | "unknown";
  entries: Realization[];
  earlier: boolean;
  decisions: { skipped: number; deferred: number; failed: number };
}
export const videoSchema = z.object({
  youtubeId: z
    .string()
    .regex(/^[\w-]{11}$/)
    .optional(),
  label: z.string().max(300).default(""),
  offsetSeconds: z.number().finite().min(-86400).max(86400).default(0),
  gameRate: z.number().finite().min(0.05).max(100).default(1.65),
});
export type MatchVideo = z.infer<typeof videoSchema>;
