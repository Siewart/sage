import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { LocalRouter } from "@sage/contracts/router";
import {
  configuredModel,
  defaultGenerationSettings,
  runRequestSchema,
  type RunSummary,
} from "@sage/contracts";
import { createService } from "../src/index.js";
import { Settings } from "../src/settings.js";

test("pinning, recoverable deletion, active protection and restart persistence through authenticated API", async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "sage-library-"));
  const make = (createdAt: string) => {
    const id = randomUUID();
    const dir = path.join(home, "runs", id);
    fs.mkdirSync(dir, { recursive: true });
    const run: RunSummary = {
      id,
      createdAt,
      updatedAt: createdAt,
      status: "completed",
      sourceName: "Test match",
      codeVersion: "test",
      request: runRequestSchema.parse({
        source: { kind: "local", id: "fixture" },
      }),
    };
    fs.writeFileSync(path.join(dir, "run.json"), JSON.stringify(run));
    fs.writeFileSync(path.join(dir, "r-1.ndjson"), "original trace\n");
    return run;
  };
  const older = make("2026-01-01T00:00:00Z"),
    newer = make("2026-02-01T00:00:00Z");
  const origin = "https://library.example";
  let service = await createService({ home, port: 0, origins: [origin] });
  const connect = () => {
    const port = (service.server.address() as any).port;
    const token = service.auth.pair(service.auth.pairingCode(), origin);
    return createTRPCClient<LocalRouter>({
      links: [
        httpBatchLink({
          url: `http://127.0.0.1:${port}/trpc`,
          headers: { Origin: origin, Authorization: `Bearer ${token}` },
        }),
      ],
    });
  };
  try {
    let api = connect();
    assert.equal((await api.runs.query())[0]?.id, newer.id);
    await api.setPinned.mutate({ id: older.id, pinned: true });
    assert.equal((await api.runs.query())[0]?.id, older.id);
    await api.deleteRun.mutate({ id: older.id });
    assert.ok(!(await api.runs.query()).some((x) => x.id === older.id));
    assert.equal((await api.runs.query({ deleted: true }))[0]?.id, older.id);
    await assert.rejects(api.run.query({ id: older.id }), /Run not found/);
    await assert.rejects(api.events.query({ id: older.id }), /Run not found/);
    await assert.rejects(
      api.realizations.query({ id: older.id }),
      /Run not found/,
    );
    await assert.rejects(
      api.trace.query({ id: older.id, realizationId: "r-1" }),
      /Run not found/,
    );
    assert.equal(
      fs.readFileSync(path.join(home, "runs", older.id, "r-1.ndjson"), "utf8"),
      "original trace\n",
    );
    await service.close();
    service = await createService({ home, port: 0, origins: [origin] });
    api = connect();
    assert.equal((await api.runs.query({ deleted: true }))[0]?.id, older.id);
    const restored = await api.restoreRun.mutate({ id: older.id });
    assert.equal(restored.pinned, true);
    assert.equal((await api.runs.query())[0]?.id, older.id);
    await api.setPinned.mutate({ id: older.id, pinned: false });
    assert.equal((await api.runs.query())[0]?.id, newer.id);
    const fixture = (await api.datasets.query({ corpus: "local" }))
      .datasets[0]!;
    const running = await api.start.mutate({ source: fixture.source });
    await assert.rejects(
      api.deleteRun.mutate({ id: running.id }),
      /Stop the run/,
    );
    await api.cancel.mutate({ id: running.id });
    await api.deleteRun.mutate({ id: running.id });
    assert.ok(
      (await api.runs.query({ deleted: true })).some(
        (x) => x.id === running.id,
      ),
    );
    await assert.rejects(api.deleteRun.mutate({ id: "../data" }));
    assert.ok(
      fs.existsSync(
        fixture.source.kind === "local"
          ? path.join(home, "datasets.json")
          : home,
      ),
    );
  } finally {
    await service.close();
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("saved model and generation preferences migrate from legacy settings and do not hide missing setup", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "sage-preferences-"));
  try {
    const settings = new Settings(home);
    assert.equal(configuredModel(settings.publicSettings()).fallback, true);
    settings.update({
      provider: {
        kind: "openai",
        model: "local-model",
        baseUrl: "http://127.0.0.1:11434/v1",
        timeoutMs: 600000,
        reasoningEffort: "none",
      },
      generation: {
        ...defaultGenerationSettings,
        module: "eventStructuring",
        analysisIntervalMs: 30000,
        debugEarlyHydration: true,
      },
    });
    const saved = new Settings(home).publicSettings();
    assert.equal(saved.preferredProvider, "openai");
    assert.equal(saved.generation?.analysisIntervalMs, 30000);
    assert.equal(saved.generation?.debugEarlyHydration, true);
    assert.equal(configuredModel(saved).provider.model, "local-model");
    assert.equal(configuredModel(saved).provider.timeoutMs, 600000);
    const { preferredProvider, ...legacy } = saved;
    assert.equal(configuredModel(legacy).provider.model, "local-model");
    const unavailable = {
      ...saved,
      preferredProvider: "gemini" as const,
      providers: {
        ...saved.providers,
        gemini: { model: "hosted-model", baseUrl: "", hasApiKey: false },
      },
    };
    assert.equal(configuredModel(unavailable).fallback, true);
    assert.equal(configuredModel(unavailable).provider.kind, "templates");
    assert.equal(
      configuredModel({ ...unavailable, preferredProvider: "templates" })
        .fallback,
      false,
    );
    assert.equal(
      configuredModel({
        ...saved,
        providers: {
          openai: {
            model: "local",
            baseUrl: "javascript:bad",
            hasApiKey: false,
          },
        },
      }).fallback,
      true,
    );
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("Gemini thinking budget defaults to zero and preserves explicit token budgets and provider default", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "sage-budget-"));
  try {
    const settings = new Settings(home);
    assert.equal(settings.publicSettings().providers.gemini?.thinkingBudget, 0);
    for (const budget of [0, 4096, null]) {
      settings.update({
        provider: {
          kind: "gemini",
          model: "mock-budget",
          baseUrl: "",
          apiKey: "test-secret",
          thinkingBudget: budget,
        },
      });
      const saved = new Settings(home).publicSettings();
      assert.equal(saved.providers.gemini?.thinkingBudget, budget);
      assert.equal(configuredModel(saved).provider.thinkingBudget, budget);
      assert.ok(!JSON.stringify(saved).includes("test-secret"));
    }
    assert.throws(() =>
      runRequestSchema.parse({
        source: { kind: "local", id: "fixture" },
        provider: {
          kind: "gemini",
          model: "mock",
          baseUrl: "",
          thinkingBudget: -1,
        },
      }),
    );
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});
