import { initTRPC } from "@trpc/server";
import { z } from "zod";
import { runRequestSchema, settingsUpdateSchema } from "./index.js";
import type {
  Dataset,
  DownloadedDataset,
  DeleteDownloadsResult,
  PublicSettings,
  Realization,
  RunEvent,
  RunRequest,
  RunSummary,
  TraceStep,
} from "./index.js";

export interface LocalBackend {
  datasets(input: {
    filter: string;
    minDurationMs?: number | undefined;
    maxDurationMs?: number | undefined;
    minDownloadBytes?: number | undefined;
    maxDownloadBytes?: number | undefined;
    mapSize?: string | undefined;
    corpus: string;
    resolution: string;
    offset: number;
    limit: number;
  }): Promise<{ datasets: Dataset[]; total: number }>;
  register(descriptorPath: string): Dataset;
  downloadedDatasets(): Promise<{
    directory: string;
    datasets: DownloadedDataset[];
  }>;
  deleteDownloadedDatasets(ids: string[]): Promise<DeleteDownloadsResult>;
  listRuns(deleted?: boolean): RunSummary[];
  listActiveRuns(): RunSummary[];
  setPinned(id: string, pinned: boolean): RunSummary;
  deleteRun(id: string): void;
  restoreRun(id: string): RunSummary;
  trashCount(): number;
  purgeRun(id: string): void;
  clearTrash(): { deleted: number; failed: number };
  start(request: RunRequest): RunSummary;
  getRun(id: string): RunSummary;
  cancel(id: string): RunSummary;
  events(id: string, after: number, limit: number): RunEvent[];
  realizations(id: string, offset?: number, limit?: number): Realization[];
  trace(id: string, realization: string): TraceStep[];
  preview(input: {
    id: string;
    table: string;
    bin: number;
    offset: number;
    limit: number;
  }): Promise<{ rows: unknown[]; total: number }>;
  validateHfToken(token?: string): Promise<{ valid: boolean; message: string }>;
  publicSettings(): PublicSettings;
  updateSettings(input: z.infer<typeof settingsUpdateSchema>): PublicSettings;
  rerun(
    id: string,
    realizationId: string,
    provider: RunRequest["provider"],
  ): RunSummary;
}
const t = initTRPC.create();
const id = z.object({ id: z.string().regex(/^[a-f0-9-]{36}$/) });
export function createLocalRouter(backend: LocalBackend) {
  return t.router({
    datasets: t.procedure
      .input(
        z.object({
          filter: z.string().max(300).default(""),
          corpus: z.string().default("local"),
          minDurationMs: z.number().nonnegative().optional(),
          maxDurationMs: z.number().nonnegative().optional(),
          minDownloadBytes: z.number().nonnegative().optional(),
          maxDownloadBytes: z.number().nonnegative().optional(),
          mapSize: z.string().max(100).optional(),
          resolution: z.enum(["1000", "60000"]).default("1000"),
          offset: z.number().int().min(0).default(0),
          limit: z.number().int().min(1).max(100).default(30),
        }),
      )
      .query(({ input }) => backend.datasets(input)),
    register: t.procedure
      .input(z.object({ descriptorPath: z.string().min(1).max(4000) }))
      .mutation(({ input }) => backend.register(input.descriptorPath)),
    downloadedDatasets: t.procedure.query(() => backend.downloadedDatasets()),
    deleteDownloadedDatasets: t.procedure
      .input(
        z.object({
          ids: z
            .array(z.string().regex(/^[a-f0-9]{64}$/))
            .min(1)
            .max(10000),
        }),
      )
      .mutation(({ input }) => backend.deleteDownloadedDatasets(input.ids)),
    validateHfToken: t.procedure
      .input(z.object({ token: z.string().max(2048).optional() }))
      .mutation(({ input }) => backend.validateHfToken(input.token)),
    settings: t.procedure.query(() => backend.publicSettings()),
    updateSettings: t.procedure
      .input(settingsUpdateSchema)
      .mutation(({ input }) => backend.updateSettings(input)),
    runs: t.procedure
      .input(z.object({ deleted: z.boolean().default(false) }).optional())
      .query(({ input }) => backend.listRuns(input?.deleted)),
    activeRuns: t.procedure.query(() => backend.listActiveRuns()),
    setPinned: t.procedure
      .input(id.extend({ pinned: z.boolean() }))
      .mutation(({ input }) => backend.setPinned(input.id, input.pinned)),
    deleteRun: t.procedure
      .input(id)
      .mutation(({ input }) => backend.deleteRun(input.id)),
    restoreRun: t.procedure
      .input(id)
      .mutation(({ input }) => backend.restoreRun(input.id)),
    trashCount: t.procedure.query(() => backend.trashCount()),
    purgeRun: t.procedure
      .input(id)
      .mutation(({ input }) => backend.purgeRun(input.id)),
    clearTrash: t.procedure.mutation(() => backend.clearTrash()),
    start: t.procedure
      .input(runRequestSchema)
      .mutation(({ input }) => backend.start(input)),
    run: t.procedure.input(id).query(({ input }) => backend.getRun(input.id)),
    cancel: t.procedure
      .input(id)
      .mutation(({ input }) => backend.cancel(input.id)),
    events: t.procedure
      .input(
        id.extend({
          after: z.number().int().min(0).default(0),
          limit: z.number().int().min(1).max(1000).default(200),
        }),
      )
      .query(({ input }) => {
        backend.getRun(input.id);
        return backend.events(input.id, input.after, input.limit);
      }),
    realizations: t.procedure
      .input(
        id.extend({
          offset: z.number().int().min(0).default(0),
          limit: z.number().int().min(1).max(500).default(100),
        }),
      )
      .query(({ input }) => {
        backend.getRun(input.id);
        return backend.realizations(input.id, input.offset, input.limit);
      }),
    trace: t.procedure
      .input(id.extend({ realizationId: z.string().regex(/^r-\d+$/) }))
      .query(({ input }) => {
        backend.getRun(input.id);
        return backend.trace(input.id, input.realizationId);
      }),
    preview: t.procedure
      .input(
        id.extend({
          table: z.enum([
            "players",
            "entities",
            "researchStates",
            "events",
            "world",
            "mapCells",
          ]),
          bin: z.number().int().min(0),
          offset: z.number().int().min(0).default(0),
          limit: z.number().int().min(1).max(100).default(30),
        }),
      )
      .query(({ input }) => backend.preview(input)),
    rerun: t.procedure
      .input(
        id.extend({
          realizationId: z.string().regex(/^r-\d+$/),
          provider: runRequestSchema.shape.provider,
        }),
      )
      .mutation(({ input }) =>
        backend.rerun(input.id, input.realizationId, input.provider),
      ),
  });
}
export type LocalRouter = ReturnType<typeof createLocalRouter>;
