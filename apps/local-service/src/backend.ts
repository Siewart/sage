import { validateHfToken } from "./hf-token.js";
import { matchesDataset, type CatalogFilter } from "./catalog-filter.js";
import { fillTemplate } from "@sage/data/hf/layout";
import { preparedPromptSchema, validateProvider } from "@sage/llm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fork, execFileSync, type ChildProcess } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import {
  runRequestSchema,
  type Dataset,
  type Realization,
  type RunEvent,
  type RunRequest,
  type RunSummary,
  type TraceStep,
} from "@sage/contracts";
import type { LocalBackend } from "@sage/contracts/router";
import {
  loadLayout,
  listRepoEntries,
  matchSpace,
  type RepoFile,
  matchesFromPaths,
} from "@sage/data/hf/client";
import { loadCorpusIndex, parseCorpusIndex } from "@sage/data/hf/index";
import { Settings } from "./settings.js";
import {
  cachedMatches,
  canonicalDirectory,
  containsPath,
  type CachedMatch,
} from "./downloads.js";
import type { WorkerInput } from "./worker.js";

const REPO =
  process.env["SAGE_RESOURCE_ROOT"] ??
  fileURLToPath(new URL("../../../", import.meta.url));
const MANIFEST = path.join(REPO, "packages/sage-data/src/default-layout.json");
const WORKER =
  process.env["SAGE_WORKER_PATH"] ??
  fileURLToPath(new URL("./worker.ts", import.meta.url));
const WORKER_ARGS = process.env["SAGE_WORKER_PATH"] ? [] : ["--import", "tsx"];
export class Backend implements LocalBackend {
  readonly emitter = new EventEmitter();
  private runs = new Map<string, RunSummary>();
  private local = new Map<
    string,
    { dataset: Dataset; descriptorPath: string }
  >();
  private active?: { id: string; child: ChildProcess; dataDirectory: string };
  private deletingDownloads = false;
  private credentials = new Map<
    string,
    { hfToken?: string; apiKey?: string; dataDirectory: string }
  >();
  private closing = false;
  private previewActive = false;
  private sequences = new Map<string, number>();
  private metadataIndexes = new Map<
    string,
    ReturnType<typeof loadCorpusIndex>
  >();
  private index?: Promise<{
    refs: ReturnType<typeof matchesFromPaths>;
    entries: RepoFile[];
  }>;
  constructor(readonly settings: Settings) {
    fs.mkdirSync(path.join(settings.home, "runs"), { recursive: true });
    for (const id of fs.readdirSync(path.join(settings.home, "runs"))) {
      try {
        const run = JSON.parse(
          fs.readFileSync(this.file(id, "run.json"), "utf8"),
        ) as RunSummary;
        if (["queued", "running"].includes(run.status)) {
          run.status = "interrupted";
          run.phase = "interrupted";
          run.error = "Service restarted before completion";
        }
        if (run.status === "cancelled") run.phase = "cancelled";
        this.runs.set(id, run);
        this.save(run);
      } catch {
        /* ignore incomplete metadata */
      }
    }
    try {
      for (const entry of JSON.parse(
        fs.readFileSync(path.join(settings.home, "datasets.json"), "utf8"),
      )) {
        this.enrichLocalMetadata(entry.dataset);
        this.local.set(entry.dataset.id, entry);
      }
    } catch {
      /* no local registrations */
    }
    const fixtures = path.join(REPO, "packages/sage-core/data");
    for (const dir of fs.readdirSync(fixtures, { withFileTypes: true }))
      if (dir.isDirectory()) {
        try {
          this.register(path.join(fixtures, dir.name, "descriptor.json"));
        } catch {
          /* skip non-datasets */
        }
      }
  }
  private file(id: string, name: string) {
    if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Invalid run id");
    return path.join(this.settings.home, "runs", id, name);
  }
  private save(run: RunSummary) {
    const file = this.file(run.id, "run.json");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file + ".partial", JSON.stringify(run), { mode: 0o600 });
    fs.renameSync(file + ".partial", file);
  }
  private append(id: string, kind: string, data: unknown) {
    const file = this.file(id, "events.ndjson");
    const previous =
      this.sequences.get(id) ??
      this.events(id, 0, Number.MAX_SAFE_INTEGER).at(-1)?.sequence ??
      0;
    const event: RunEvent = {
      sequence: previous + 1,
      at: new Date().toISOString(),
      kind,
      data,
    };
    fs.appendFileSync(file, JSON.stringify(event) + "\n", { mode: 0o600 });
    this.sequences.set(id, event.sequence);
    this.emitter.emit(id, event);
  }
  register(descriptorPath: string): Dataset {
    descriptorPath = fs.realpathSync(path.resolve(descriptorPath));
    const text = fs.readFileSync(descriptorPath, "utf8");
    const descriptor = JSON.parse(text);
    if (
      typeof descriptor.name !== "string" ||
      !Array.isArray(descriptor.metadata?.binTimes)
    )
      throw new Error("Invalid SAGE descriptor");
    const id = createHash("sha256")
      .update(descriptorPath)
      .digest("hex")
      .slice(0, 24);
    const bins = descriptor.metadata.binTimes as [number, number][];
    const widths = bins
      .map(([start, end]) => end - start)
      .sort((a, b) => a - b);
    const resolution = String(
      Math.max(
        1000,
        Math.round((widths[Math.floor(widths.length / 2)] ?? 60000) / 1000) *
          1000,
      ),
    );
    const dataset: Dataset = {
      id,
      name: descriptor.name,
      resolution,
      source: { kind: "local", id },
      cached: true,
      metadata: {
        durationMs: bins.length ? bins[bins.length - 1]![1] - bins[0]![0] : 0,
        players: [],
      },
      revision: createHash("sha256").update(text).digest("hex"),
    };
    this.enrichLocalMetadata(dataset);
    this.local.set(id, { dataset, descriptorPath });
    fs.writeFileSync(
      path.join(this.settings.home, "datasets.json"),
      JSON.stringify([...this.local.values()]),
      { mode: 0o600 },
    );
    return dataset;
  }
  private enrichLocalMetadata(dataset: Dataset) {
    const layout = loadLayout(MANIFEST);
    for (const corpus of ["kotd4", "may2026", "sample-unzipped"]) {
      const file = path.join(
        this.settings.publicSettings().dataDirectory,
        layout.repo,
        layout.revision,
        corpus,
        "index.json",
      );
      try {
        if (fs.statSync(file).size > 25 * 1024 * 1024) continue;
        const index = parseCorpusIndex(
          JSON.parse(fs.readFileSync(file, "utf8")),
        );
        const metadata =
          index.get(dataset.name) ??
          index.get(dataset.name.replace(/^cade-/, ""));
        if (metadata) dataset.metadata = { ...dataset.metadata, ...metadata };
      } catch {
        /* Optional cached index; never download data to populate local labels. */
      }
    }
  }
  private downloadProtection(match: CachedMatch) {
    if (this.previewActive) return "A dataset preview is running";
    for (const run of this.runs.values()) {
      if (
        !["queued", "running"].includes(run.status) &&
        this.active?.id !== run.id
      )
        continue;
      if (run.descriptorPath && containsPath(match.path, run.descriptorPath))
        return "Used by a queued, running or stopping run";
      const source = run.request.source;
      const directory =
        this.active?.id === run.id
          ? this.active.dataDirectory
          : this.credentials.get(run.id)?.dataDirectory;
      let root = directory;
      try {
        if (directory) root = fs.realpathSync(directory);
      } catch {
        /* Cache may not exist yet. */
      }
      if (
        source.kind === "hf" &&
        source.match === match.name &&
        source.corpus === match.corpus &&
        source.resolution === match.resolution &&
        root &&
        containsPath(root, match.path)
      )
        return "Used by a queued, running or stopping run";
    }
    return undefined;
  }
  async downloadedDatasets() {
    const directory = this.settings.publicSettings().dataDirectory;
    const datasets = (await cachedMatches(directory, loadLayout(MANIFEST))).map(
      ({ path: _path, ...match }) => {
        const protectedReason = this.downloadProtection({
          ...match,
          path: _path,
        });
        return { ...match, ...(protectedReason ? { protectedReason } : {}) };
      },
    );
    return { directory, datasets };
  }
  async deleteDownloadedDatasets(ids: string[]) {
    if (this.deletingDownloads)
      throw new Error("A dataset deletion is already in progress");
    this.deletingDownloads = true;
    const result: import("@sage/contracts").DeleteDownloadsResult = {
      deleted: [],
      failed: [],
      removedBytes: 0,
    };
    try {
      const directory = this.settings.publicSettings().dataDirectory;
      const matches = new Map(
        (await cachedMatches(directory, loadLayout(MANIFEST))).map((match) => [
          match.id,
          match,
        ]),
      );
      for (const id of new Set(ids)) {
        const match = matches.get(id);
        try {
          if (!match)
            throw new Error(
              "Dataset is no longer available in the current cache",
            );
          const protection = this.downloadProtection(match);
          if (protection) throw new Error(protection);
          const root = fs.realpathSync(directory);
          if (!(await canonicalDirectory(match.path, root)))
            throw new Error("Dataset location changed; refresh the list");
          // No await between the final worker check and starting removal.
          const latestProtection = this.downloadProtection(match);
          if (latestProtection) throw new Error(latestProtection);
          await fs.promises.rm(match.path, { recursive: true, force: true });
          result.deleted.push(id);
          result.removedBytes += match.bytes;
        } catch (error) {
          result.failed.push({
            id,
            message:
              error instanceof Error
                ? error.message
                : "Could not delete dataset",
          });
        }
      }
      return result;
    } finally {
      this.deletingDownloads = false;
    }
  }
  async datasets(
    input: CatalogFilter & {
      filter: string;
      corpus: string;
      resolution: string;
      offset: number;
      limit: number;
    },
  ) {
    let datasets: Dataset[];
    if (input.corpus === "local")
      datasets = [...this.local.values()]
        .filter((entry) => fs.existsSync(entry.descriptorPath))
        .map((entry) => entry.dataset);
    else {
      const layout = loadLayout(MANIFEST);
      this.index ??= listRepoEntries(layout.repo, {
        revision: layout.revision,
        cacheDir: this.settings.publicSettings().dataDirectory,
        accessToken: this.settings.token(),
      })
        .then((entries) => ({
          refs: matchesFromPaths(
            layout,
            entries.map((file) => file.path),
          ),
          entries,
        }))
        .catch((error) => {
          this.index = undefined;
          throw error;
        });
      datasets = (await this.index).refs
        .filter(
          (ref) =>
            ref.facets["corpus"] === input.corpus &&
            ref.facets["resolution"] === input.resolution,
        )
        .map((ref) => {
          const source: RunRequest["source"] = {
            kind: "hf",
            match: ref.match,
            corpus: input.corpus as "kotd4",
            resolution: input.resolution as "1000",
          };
          const id = createHash("sha256")
            .update(JSON.stringify(source))
            .digest("hex")
            .slice(0, 24);
          const cached = fs.existsSync(
            path.join(
              this.settings.publicSettings().dataDirectory,
              layout.repo,
              layout.revision,
              input.corpus,
              "export",
              input.resolution,
              ref.match,
              "tables/.complete.json",
            ),
          );
          return {
            id,
            name: ref.match,
            resolution: input.resolution,
            source,
            cached,
            revision: layout.revision,
          };
        });
    }
    let entries: RepoFile[] = [];
    if (input.corpus !== "local") {
      const layout = loadLayout(MANIFEST);
      entries = (await this.index!).entries;
      let metadata: Awaited<ReturnType<typeof loadCorpusIndex>> | undefined;
      if (entries.some((file) => file.path === `${input.corpus}/index.json`)) {
        if (!this.metadataIndexes.has(input.corpus))
          this.metadataIndexes.set(
            input.corpus,
            loadCorpusIndex(layout, input.corpus, {
              cacheDir: this.settings.publicSettings().dataDirectory,
              accessToken: this.settings.token(),
            }),
          );
        try {
          metadata = await this.metadataIndexes.get(input.corpus);
        } catch {
          this.metadataIndexes.delete(input.corpus);
        }
      }
      const sizes = new Map(entries.map((file) => [file.path, file.size]));
      for (const dataset of datasets) {
        dataset.metadata = metadata?.get(dataset.name);
        if (layout.archiveTemplate) {
          const file = fillTemplate(layout.archiveTemplate, {
            ...layout.defaultFacets,
            corpus: input.corpus,
            resolution: input.resolution,
            match: dataset.name,
          });
          const downloadBytes = sizes.get(file);
          if (downloadBytes !== undefined) dataset.space = { downloadBytes };
        }
      }
    }
    datasets = datasets.filter((dataset) => matchesDataset(dataset, input));
    const page = datasets.slice(input.offset, input.offset + input.limit);
    if (input.corpus !== "local") {
      const layout = loadLayout(MANIFEST);
      // Bound archive directory requests; never fetch the entire match for a size label.
      let cursor = 0;
      await Promise.all(
        Array.from({ length: Math.min(4, page.length) }, async () => {
          while (cursor < page.length) {
            const dataset = page[cursor++]!;
            if (dataset.source.kind !== "hf") continue;
            dataset.space = await matchSpace(
              layout,
              {
                match: dataset.source.match,
                facets: {
                  corpus: dataset.source.corpus,
                  resolution: dataset.source.resolution,
                },
              },
              entries,
              {
                cacheDir: this.settings.publicSettings().dataDirectory,
                accessToken: this.settings.token(),
              },
            );
          }
        }),
      );
    }
    return { datasets: page, total: datasets.length };
  }
  listRuns(deleted = false) {
    return [...this.runs.values()]
      .filter((run) => Boolean(run.deletedAt) === deleted)
      .sort(
        (a, b) =>
          Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) ||
          b.createdAt.localeCompare(a.createdAt),
      )
      .slice(0, 100);
  }
  setPinned(id: string, pinned: boolean) {
    const run = this.getRun(id);
    run.pinned = pinned;
    run.updatedAt = new Date().toISOString();
    this.save(run);
    return run;
  }
  listActiveRuns() {
    return [...this.runs.values()]
      .filter(
        (run) => !run.deletedAt && ["running", "queued"].includes(run.status),
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  deleteRun(id: string) {
    const run = this.getRun(id);
    if (["queued", "running"].includes(run.status))
      throw new Error("Stop the run before deleting it");
    run.deletedAt = new Date().toISOString();
    run.updatedAt = run.deletedAt;
    this.save(run);
  }
  restoreRun(id: string) {
    const run = this.runs.get(id);
    if (!run) throw new Error("Run not found");
    delete run.deletedAt;
    run.updatedAt = new Date().toISOString();
    this.save(run);
    return run;
  }
  trashCount() {
    return [...this.runs.values()].filter((run) => run.deletedAt).length;
  }
  purgeRun(id: string) {
    const run = this.runs.get(id);
    if (!run) throw new Error("Run not found");
    if (["queued", "running"].includes(run.status))
      throw new Error("Stop the run before permanently deleting it");
    if (this.active?.id === id)
      throw new Error("This run is still stopping. Try again in a moment.");
    if (!run.deletedAt)
      throw new Error("Move the run to Trash before permanently deleting it");
    fs.rmSync(path.dirname(this.file(id, "run.json")), {
      recursive: true,
      force: true,
    });
    this.runs.delete(id);
    this.sequences.delete(id);
    this.credentials.delete(id);
  }
  clearTrash() {
    const ids = [...this.runs.values()]
      .filter((run) => run.deletedAt)
      .map((run) => run.id);
    let deleted = 0,
      failed = 0;
    for (const id of ids) {
      try {
        this.purgeRun(id);
        deleted++;
      } catch {
        failed++;
      }
    }
    return { deleted, failed };
  }
  getRun(id: string) {
    const run = this.runs.get(id);
    if (!run || run.deletedAt) throw new Error("Run not found");
    return run;
  }
  start(
    value: RunRequest,
    comparison?: {
      runId: string;
      realizationId: string;
      prompt: unknown;
      original: Realization;
    },
  ) {
    if (this.closing) throw new Error("Service is shutting down");
    if (this.deletingDownloads)
      throw new Error(
        "Wait for dataset deletion to finish before starting a run",
      );
    const request = runRequestSchema.parse(value);
    if (request.operation === "generate")
      validateProvider(
        request.provider,
        this.settings.provider(request.provider.kind).apiKey,
      );
    const local =
      request.source.kind === "local"
        ? this.local.get(request.source.id)
        : undefined;
    if (request.source.kind === "local" && !local)
      throw new Error("Register the local dataset first");
    const id = randomUUID(),
      now = new Date().toISOString();
    let codeVersion = fs.existsSync(path.join(REPO, "version.txt"))
      ? fs.readFileSync(path.join(REPO, "version.txt"), "utf8").trim()
      : "unavailable";
    try {
      codeVersion = execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: REPO,
        encoding: "utf8",
      }).trim();
    } catch {
      /* Git metadata may be absent in a packaged distribution. */
    }
    const run: RunSummary = {
      id,
      createdAt: now,
      updatedAt: now,
      status: "queued",
      request,
      sourceName:
        local?.dataset.name ??
        (request.source.kind === "hf" ? request.source.match : "local"),
      codeVersion,
      ...(local
        ? {
            descriptorPath: local.descriptorPath,
            datasetRevision: local.dataset.revision,
          }
        : {}),
    };
    this.runs.set(id, run);
    this.save(run);
    this.credentials.set(id, {
      hfToken: this.settings.token(),
      apiKey: this.settings.provider(request.provider.kind).apiKey,
      dataDirectory: this.settings.publicSettings().dataDirectory,
    });
    if (comparison) {
      run.comparison = {
        runId: comparison.runId,
        realizationId: comparison.realizationId,
        originalText: comparison.original.text,
      };
      this.save(run);
      fs.writeFileSync(
        this.file(id, "comparison.json"),
        JSON.stringify(comparison),
        { mode: 0o600 },
      );
      this.append(id, "comparison", {
        runId: comparison.runId,
        realizationId: comparison.realizationId,
      });
    }
    this.append(id, "status", { status: "queued" });
    this.next();
    return run;
  }
  private next() {
    if (this.active || this.closing) return;
    const run = [...this.runs.values()].find(
      (value) => value.status === "queued",
    );
    if (!run) return;
    const child = fork(WORKER, [], {
      execArgv: WORKER_ARGS,
      stdio: ["ignore", "pipe", "pipe", "ipc"],
    });
    this.active = {
      id: run.id,
      child,
      dataDirectory: this.credentials.get(run.id)!.dataDirectory,
    };
    run.status = "running";
    this.save(run);
    this.append(run.id, "status", { status: run.status });
    child.stdout?.resume();
    child.stderr?.resume();
    let finished = false;
    let lastStageUpdate = 0;
    child.on("message", (message: { kind: string; data: any }) => {
      const { kind, data } = message;
      if (run.status === "cancelled") return;
      if (kind === "step") {
        fs.appendFileSync(
          this.file(run.id, data.id + ".ndjson"),
          JSON.stringify(data.step) + "\n",
          { mode: 0o600 },
        );
        run.currentStage = data.step.stage;
        run.currentRealizationId = data.id;
        if (
          Date.now() - lastStageUpdate >= 250 ||
          ["prompt", "response", "realization", "error"].includes(
            data.step.stage,
          )
        ) {
          lastStageUpdate = Date.now();
          run.updatedAt = new Date().toISOString();
          this.save(run);
          this.append(run.id, "stage", {
            stage: data.step.stage,
            realizationId: data.id,
          });
        }
        return;
      }
      if (kind === "realization")
        run.realizationCount = (run.realizationCount ?? 0) + 1;
      if (kind === "download") {
        run.progress = {
          downloadReceivedBytes: data.received,
          ...(data.total === undefined
            ? {}
            : { downloadTotalBytes: data.total }),
        };
      }
      if (kind === "dataset") {
        run.progress = {
          gameStartMs: data.gameStartMs,
          gameEndMs: data.gameEndMs,
          gameTimeMs: data.gameStartMs,
        };
      }
      if (kind === "progress" && Number.isFinite(data.gameTimeMs))
        run.progress = { ...run.progress, gameTimeMs: data.gameTimeMs };
      if (kind === "phase") run.phase = data.phase;
      if (kind === "opened") {
        run.phase = "preparing";
        delete run.progress;
        run.descriptorPath = data.descriptorPath;
        run.datasetRevision = run.datasetRevision ?? data.revision;
      }
      if (kind === "metrics") run.metrics = data;
      if (kind === "finished" || kind === "failed") {
        finished = true;
        run.status = kind === "finished" ? "completed" : "failed";
        if (kind === "finished") run.phase = "completed";
        if (kind === "failed") {
          run.phase = "failed";
          run.error = data.message;
        }
      }
      run.updatedAt = new Date().toISOString();
      this.save(run);
      this.append(run.id, kind, data);
    });
    child.on("error", () => {
      if (run.status === "cancelled") return;
      run.status = "failed";
      run.phase = "failed";
      run.error = "Unable to start local worker";
      this.save(run);
    });
    child.on("exit", () => {
      if (!finished && run.status !== "cancelled") {
        run.status = this.closing ? "interrupted" : "failed";
        run.phase = run.status;
        run.error ??= this.closing
          ? "Service stopped during generation"
          : "Worker exited before completion";
      }
      run.updatedAt = new Date().toISOString();
      this.save(run);
      this.append(run.id, "status", { status: run.status });
      this.credentials.delete(run.id);
      this.active = undefined;
      this.next();
    });
    const input: WorkerInput = {
      kind: "run",
      id: run.id,
      request: run.request,
      ...this.credentials.get(run.id)!,
      ...(run.descriptorPath ? { descriptorPath: run.descriptorPath } : {}),
    };
    const comparison = this.file(run.id, "comparison.json");
    if (fs.existsSync(comparison)) {
      input.kind = "rerun";
      const saved = JSON.parse(fs.readFileSync(comparison, "utf8"));
      input.recordedInput = saved.prompt;
      input.recordedRealization = saved.original;
    }
    child.send(input);
  }
  cancel(id: string) {
    const run = this.getRun(id);
    if (!["running", "queued"].includes(run.status)) return run;
    run.status = "cancelled";
    run.phase = "cancelled";
    run.updatedAt = new Date().toISOString();
    this.save(run);
    this.append(id, "status", { status: run.status });
    if (this.active?.id === id) {
      const child = this.active.child;
      child.kill("SIGTERM");
      const timer = setTimeout(() => {
        if (child.exitCode === null) child.kill("SIGKILL");
      }, 5000);
      timer.unref();
    }
    this.credentials.delete(id);
    return run;
  }
  events(id: string, after: number, limit: number): RunEvent[] {
    const file = this.file(id, "events.ndjson");
    if (!fs.existsSync(file)) return [];
    return fs
      .readFileSync(file, "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as RunEvent)
      .filter((event) => event.sequence > after)
      .slice(0, limit);
  }
  realizations(id: string, offset = 0, limit = 100) {
    return this.events(id, 0, Number.MAX_SAFE_INTEGER)
      .filter((event) => event.kind === "realization")
      .slice(offset, offset + limit)
      .map((event) => event.data as Realization);
  }
  trace(id: string, realization: string): TraceStep[] {
    if (!/^r-\d+$/.test(realization)) throw new Error("Invalid realization");
    const file = this.file(id, realization + ".ndjson");
    return fs.existsSync(file)
      ? fs
          .readFileSync(file, "utf8")
          .trim()
          .split("\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line))
      : [];
  }
  validateHfToken(token?: string) {
    return validateHfToken(token?.trim() || this.settings.token());
  }
  publicSettings() {
    return this.settings.publicSettings();
  }
  updateSettings(input: Parameters<Settings["update"]>[0]) {
    if (this.deletingDownloads)
      throw new Error(
        "Wait for dataset deletion to finish before changing settings",
      );
    this.index = undefined;
    this.metadataIndexes.clear();
    return this.settings.update(input);
  }
  async preview(input: {
    id: string;
    table: string;
    bin: number;
    offset: number;
    limit: number;
  }) {
    if (this.deletingDownloads)
      throw new Error(
        "Wait for dataset deletion to finish before opening a preview",
      );
    const run = this.getRun(input.id);
    if (!run.descriptorPath) throw new Error("Dataset has not opened yet");
    if (!fs.existsSync(run.descriptorPath))
      throw new Error(
        "Dataset files are missing. Download this match again to inspect its tables. Saved commentary and traces are still available.",
      );
    if (this.previewActive) throw new Error("A preview is already running");
    this.previewActive = true;
    return new Promise<{ rows: unknown[]; total: number }>(
      (resolve, reject) => {
        const child = fork(WORKER, [], {
          execArgv: WORKER_ARGS,
          stdio: ["ignore", "ignore", "ignore", "ipc"],
        });
        const timer = setTimeout(() => {
          child.kill();
          reject(new Error("Preview timeout"));
        }, 30000);
        child.on("message", (message: { kind: string; data: any }) => {
          if (message.kind === "result") {
            clearTimeout(timer);
            resolve(message.data);
          }
          if (message.kind === "failed") {
            clearTimeout(timer);
            reject(new Error(message.data.message));
          }
        });
        child.on("exit", (code) => {
          this.previewActive = false;
          clearTimeout(timer);
          if (code !== 0) reject(new Error("Preview worker exited"));
        });
        child.on("error", (error) => {
          this.previewActive = false;
          clearTimeout(timer);
          reject(error);
        });
        child.send({
          kind: "preview",
          id: run.id,
          request: run.request,
          descriptorPath: run.descriptorPath,
          dataDirectory: this.settings.publicSettings().dataDirectory,
          preview: input,
        } satisfies WorkerInput);
      },
    );
  }
  rerun(
    id: string,
    realizationId: string,
    provider: RunRequest["provider"],
  ): RunSummary {
    const original = this.getRun(id);
    const prompt = this.trace(id, realizationId).find(
      (step) => step.stage === "prompt",
    )?.data;
    if (!prompt)
      throw new Error(
        "This realization has no recorded model prompt. Choose a realization generated with a model.",
      );
    return this.start(
      { ...original.request, provider, operation: "generate" },
      {
        runId: id,
        realizationId,
        prompt: preparedPromptSchema.parse(prompt),
        original: this.realizations(id, 0, Number.MAX_SAFE_INTEGER).find(
          (value) => value.id === realizationId,
        )!,
      },
    );
  }
  async shutdown() {
    this.closing = true;
    const child = this.active?.child;
    if (!child) return;
    await new Promise<void>((resolve) => {
      child.once("exit", () => resolve());
      child.kill("SIGTERM");
      const timer = setTimeout(() => child.kill("SIGKILL"), 5000);
      timer.unref();
    });
  }
}
