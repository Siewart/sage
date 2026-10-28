import { z } from "zod";

export const moduleSchema = z.enum([
  "all",
  "base",
  "eventStructuring",
  "expertInsights",
]);
export const sourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("local"), id: z.string().min(1).max(100) }),
  z.object({
    kind: z.literal("hf"),
    match: z.string().min(1).max(240),
    corpus: z.enum(["kotd4", "may2026", "sample-unzipped"]).default("kotd4"),
    resolution: z.enum(["1000", "60000"]).default("1000"),
  }),
]);
export const providerSchema = z.object({
  kind: z.enum(["templates", "gemini", "anthropic", "openai"]),
  model: z.string().max(200).default(""),
  baseUrl: z.string().max(2000).default(""),
  reasoningEffort: z.enum(["none", "low", "medium", "high"]).optional(),
  thinkingBudget: z.number().int().min(0).max(1000000).nullable().optional(),
  timeoutMs: z.number().int().min(1000).max(3600000).optional(),
});
export const runRequestSchema = z.object({
  source: sourceSchema,
  operation: z.enum(["generate", "download"]).default("generate"),
  module: moduleSchema.default("base"),
  provider: providerSchema.default({
    kind: "templates",
    model: "",
    baseUrl: "",
  }),
  analysisIntervalMs: z.number().int().min(1000).max(3600000).default(60000),
  debugEarlyHydration: z.boolean().default(false),
  commentaryIntervalMs: z.number().int().min(0).max(3600000).default(0),
});
export type RunRequest = z.infer<typeof runRequestSchema>;
export interface DownloadedDataset {
  id: string;
  name: string;
  corpus: string;
  resolution: string;
  revision: string;
  bytes: number;
  protectedReason?: string;
}
export interface DeleteDownloadsResult {
  deleted: string[];
  failed: { id: string; message: string }[];
  removedBytes: number;
}
export type Provider = z.infer<typeof providerSchema>;
export type RunStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "interrupted";
export interface Dataset {
  id: string;
  name: string;
  resolution: string;
  source: RunRequest["source"];
  cached: boolean;
  metadata?: {
    mapName?: string | null | undefined;
    mapSize?: string | number | null | undefined;
    mapWidth?: number | null | undefined;
    mapHeight?: number | null | undefined;
    durationMs?: number | null | undefined;
    isRanked?: boolean | null | undefined;
    split?: string | null | undefined;
    indexGeneratedAt?: string | undefined;
    players: Array<{
      playerId: number;
      name: string;
      civId?: number | null | undefined;
      civName?: string | null | undefined;
      elo?: number | null | undefined;
      won?: boolean | null | undefined;
    }>;
  };
  space?: {
    downloadBytes?: number;
    diskBytes?: number;
    additionalDiskBytes?: number;
  };
  revision: string;
}
export interface RunSummary {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: RunStatus;
  request: RunRequest;
  sourceName: string;
  pinned?: boolean;
  deletedAt?: string;
  currentStage?: TraceStage;
  currentRealizationId?: string;
  realizationCount?: number;
  progress?: {
    gameStartMs?: number;
    gameEndMs?: number;
    gameTimeMs?: number;
    downloadReceivedBytes?: number;
    downloadTotalBytes?: number;
  };
  comparison?: { runId: string; realizationId: string; originalText: string };
  descriptorPath?: string;
  datasetRevision?: string;
  codeVersion: string;
  phase?:
    | "queued"
    | "downloading"
    | "preparing"
    | "generating"
    | "completed"
    | "cancelled"
    | "failed"
    | "interrupted";
  error?: string;
  metrics?: Record<string, number | string>;
}
export interface RunEvent {
  sequence: number;
  at: string;
  kind: string;
  data: unknown;
}
export type TraceStage =
  | "source"
  | "analysis"
  | "interpretation"
  | "classification"
  | "planning"
  | "prompt"
  | "response"
  | "hydration"
  | "realization"
  | "skipped"
  | "deferred"
  | "error";
export interface TraceStep {
  stage: TraceStage;
  data?: unknown;
  elapsedMs: number;
}
export interface Realization {
  id: string;
  template: string;
  gameTimeMs: number;
  text: string;
  deferred: boolean;
  decision?: "skipped" | "failed";
  elapsedMs: number;
  realizeMs: number;
}
export interface GenerationObserver {
  onCoverage?: (gameTimeMs:number, completed:boolean) => void;
  onStep?: (id: string, step: TraceStep) => void;
  onRealization?: (value: Realization) => void;
  onProgress?: (gameTimeMs: number) => void;
  commentaryIntervalMs?: number;
}
export const generationSettingsSchema = runRequestSchema.pick({
  module: true,
  analysisIntervalMs: true,
  commentaryIntervalMs: true,
  debugEarlyHydration: true,
});
export type GenerationSettings = z.infer<typeof generationSettingsSchema>;
export const defaultGenerationSettings = generationSettingsSchema.parse({});

export interface PublicSettings {
  preferredProvider?: Provider["kind"];
  generation?: GenerationSettings;
  dataDirectory: string;
  hasHfToken: boolean;
  providers: Record<
    string,
    {
      model: string;
      baseUrl: string;
      hasApiKey: boolean;
      reasoningEffort?: Provider["reasoningEffort"];
      thinkingBudget?: Provider["thinkingBudget"];
      timeoutMs?: number;
    }
  >;
}
export const settingsUpdateSchema = z.object({
  dataDirectory: z.string().min(1).max(4000).optional(),
  generation: generationSettingsSchema.optional(),
  hfToken: z.string().max(1000).optional(),
  provider: providerSchema
    .extend({ apiKey: z.string().max(2000).optional() })
    .optional(),
});

/** Resolve a saved configuration without choosing an unrequested hosted provider. */
export function configuredModel(settings: PublicSettings | undefined): {
  provider: Provider;
  fallback: boolean;
} {
  const offline: Provider = { kind: "templates", model: "", baseUrl: "" };
  if (!settings) return { provider: offline, fallback: false };
  const kind =
    settings.preferredProvider ??
    (["openai", "gemini", "anthropic"] as const).find((candidate) =>
      Boolean(settings.providers[candidate]?.model.trim()),
    );
  if (kind === "templates") return { provider: offline, fallback: false };
  if (!kind) return { provider: offline, fallback: true };
  const saved = settings.providers[kind];
  if (!saved?.model.trim()) return { provider: offline, fallback: true };
  let local = false;
  try {
    if (saved.baseUrl) {
      const url = new URL(saved.baseUrl);
      if (
        !["http:", "https:"].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      )
        return { provider: offline, fallback: true };
      local =
        kind === "openai" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    }
  } catch {
    return { provider: offline, fallback: true };
  }
  if (!local && !saved.hasApiKey) return { provider: offline, fallback: true };
  const { hasApiKey, ...configuration } = saved;
  return { provider: { kind, ...configuration }, fallback: false };
}

/** Bound diagnostic snapshots; prompts are recorded separately at the provider boundary. */
export function snapshot(
  value: unknown,
  depth = 0,
  seen = new WeakSet<object>(),
  budget = { remaining: 1000000 },
): unknown {
  if (budget.remaining <= 0) return "[snapshot budget exceeded]";
  budget.remaining -= 16;
  if (value === null || value === undefined) return value ?? null;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "string") {
    const limit = Math.min(200000, budget.remaining);
    budget.remaining -= Math.min(value.length, limit);
    return value.length > limit
      ? value.slice(0, limit) + " [truncated]"
      : value;
  }
  if (typeof value !== "object")
    return typeof value === "function" ? "[function]" : value;
  if (depth > 10) return "[depth limit]";
  if (seen.has(value)) return "[circular reference]";
  seen.add(value);
  if (Array.isArray(value)) {
    const result = value
      .slice(0, 500)
      .map((x) => snapshot(x, depth + 1, seen, budget));
    seen.delete(value);
    return value.length > 500
      ? [...result, `[${value.length - 500} more rows]`]
      : result;
  }
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value).slice(0, 100)) {
    if (/token|api.?key|authorization|secret/i.test(key))
      result[key] = "[redacted]";
    else if (["dataSet", "baseTables", "query", "inputData"].includes(key))
      result[key] = "[source reference]";
    else result[key] = snapshot(entry, depth + 1, seen, budget);
  }
  seen.delete(value);
  return result;
}
