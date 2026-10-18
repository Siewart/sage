import { realizePrompt, preparedPromptSchema } from "@sage/llm";
import { performance } from "node:perf_hooks";
import { makeDataSetFromPath } from "../../../packages/sage-core/gen/study/init.js";
import { createEnhancedBattleAnalysisSystem } from "../../../packages/sage-core/src/templates/study/enhanced-study-system.js";
import { openDuckDbMatch } from "@sage/data/duckdb/open";
import { fetchMatchFiles, loadLayout } from "@sage/data/hf/client";
import { fileURLToPath } from "node:url";
import { execution } from "@sage/contracts/execution";
import type { RunRequest } from "@sage/contracts";

export interface WorkerInput {
  kind: "run" | "preview" | "rerun";
  id: string;
  request: RunRequest;
  descriptorPath?: string;
  dataDirectory: string;
  hfToken?: string;
  apiKey?: string;
  preview?: { table: string; bin: number; offset: number; limit: number };
  recordedInput?: unknown;
  recordedRealization?: { gameTimeMs: number; template: string };
}
const send = (kind: string, data: unknown) => process.send?.({ kind, data });
const MANIFEST = process.env["SAGE_RESOURCE_ROOT"] ? `${process.env["SAGE_RESOURCE_ROOT"]}/packages/sage-data/src/default-layout.json` : fileURLToPath(
  new URL(
    "../../../packages/sage-data/src/default-layout.json",
    import.meta.url,
  ),
);
console.log = () => {};

process.once("message", async (input: WorkerInput) => {
  try {
    process.env["SAGE_DATA_DIR"] = input.dataDirectory;
    const started = performance.now();
    if (input.kind === "rerun") {
      const text = await execution.run(
        {
          runId: input.id,
          realizationId: "r-1",
          provider: input.request.provider,
          apiKey: input.apiKey,
          emit: (stage, data) =>
            send("step", {
              id: "r-1",
              step: { stage, data, elapsedMs: performance.now() - started },
            }),
        },
        () => realizePrompt(preparedPromptSchema.parse(input.recordedInput)),
      );
      send("step", {
        id: "r-1",
        step: {
          stage: "realization",
          data: { text },
          elapsedMs: performance.now() - started,
        },
      });
      send("realization", {
        id: "r-1",
        template: input.recordedRealization?.template ?? "comparison",
        text,
        gameTimeMs: input.recordedRealization?.gameTimeMs ?? 0,
        deferred: false,
        elapsedMs: performance.now() - started,
        realizeMs: performance.now() - started,
      });
      send("metrics", {
        elapsedMs: performance.now() - started,
        maxRssBytes: process.resourceUsage().maxRSS * 1024,
        node: process.version,
      });
      process.send?.({ kind: "finished", data: {} }, () => process.exit(0));
      return;
    }
    let descriptorPath = input.descriptorPath;
    let revision = "local";
    if (!descriptorPath && input.request.source.kind === "hf") {
      send("phase", { phase: "downloading" });
      const layout = loadLayout(MANIFEST);
      revision = layout.revision;
      const source = input.request.source;
      let lastDownloadUpdate = 0;
      const result = await fetchMatchFiles(
        layout,
        {
          ...layout.defaultFacets,
          match: source.match,
          corpus: source.corpus,
          resolution: source.resolution,
        },
        {
          cacheDir: input.dataDirectory,
          accessToken: input.hfToken,
          onProgress: (message) => send("progress", { message }),
          onBytes: (received, total) => {
            if (Date.now() - lastDownloadUpdate > 200 || received === total) {
              lastDownloadUpdate = Date.now();
              send("download", { received, total });
            }
          },
        },
      );
      descriptorPath = result.descriptorPath;
    }
    if (!descriptorPath) throw new Error("The dataset has no local descriptor");
    send("opened", { descriptorPath, revision });
    if (input.kind === "preview") {
      const query = openDuckDbMatch(descriptorPath);
      try {
        const { table, bin, offset, limit } = input.preview!;
        const range = query.binToTimes(bin);
        let rows: unknown[];
        switch (table) {
          case "entities":
            rows = query.entities({ bin });
            break;
          case "researchStates":
            rows = query.researchStates({ bin });
            break;
          case "players":
            rows = query.players({ bin });
            break;
          case "world":
            rows = query.world({ bin });
            break;
          case "events":
            rows = query.events({ timeRange: range });
            break;
          case "mapCells":
            rows = query.mapCells({});
            break;
          default:
            throw new Error("Unknown preview table");
        }
        send("result", {
          rows: rows.slice(offset, offset + limit),
          total: rows.length,
        });
      } finally {
        query.close();
      }
    } else if (input.request.operation !== "download") {
      send("phase", { phase: "preparing" });
      const data = makeDataSetFromPath(descriptorPath, "duckdb");
      try {
        send("dataset", {
          name: data.name,
          snapshots: data.query.binTimes().length,
          gameStartMs: data.query.binTimes()[0]?.[0] ?? 0,
          gameEndMs: data.query.binTimes().at(-1)?.[1] ?? 0,
        });
        const system = createEnhancedBattleAnalysisSystem(data as never, {
          moduleConfig: input.request.module,
          useGeminiAI: input.request.provider.kind !== "templates",
          analysisIntervalMs: input.request.analysisIntervalMs,
          debugEarlyHydration: input.request.debugEarlyHydration,
        });
        send("phase", { phase: "generating" });
        let progressAt = 0;
        await execution.run(
          {
            runId: input.id,
            provider: input.request.provider,
            apiKey: input.apiKey,
          },
          () =>
            system.generateText({
              commentaryIntervalMs: input.request.commentaryIntervalMs,
              onStep: (id, step) => send("step", { id, step }),
              onRealization: (value) => send("realization", value),
              onProgress: (gameTimeMs) => {
                if (performance.now() - progressAt > 250) {
                  progressAt = performance.now();
                  send("progress", { gameTimeMs });
                }
              },
            }),
        );
        send("metrics", {
          elapsedMs: performance.now() - started,
          maxRssBytes: process.resourceUsage().maxRSS * 1024,
          snapshots: data.query.binTimes().length,
          node: process.version,
        });
      } finally {
        data.query.close();
      }
    }
    process.send?.({ kind: "finished", data: {} }, () => process.exit(0));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Local job failed";
    const safe = [input.hfToken, input.apiKey]
      .filter(Boolean)
      .reduce<string>(
        (text, secret) => text.split(secret!).join("[redacted]"),
        message,
      );
    process.send?.({ kind: "failed", data: { message: safe } }, () =>
      process.exit(1),
    );
  }
});
