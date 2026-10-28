import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { LocalRouter } from "@sage/contracts/router";
import { runRequestSchema } from "@sage/contracts";
import { createService } from "../src/index.js";

const origin = "https://inspector.example";
test(
  "pairing gates the API and a persisted run survives browser reconnect",
  { timeout: 90000 },
  async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "sage-service-"));
    const service = await createService({ home, port: 0, origins: [origin] });
    const url = `http://127.0.0.1:${(service.server.address() as { port: number }).port}`;
    let closed = false;
    try {
      assert.equal(
        (await fetch(url + "/trpc/runs", { headers: { Origin: origin } }))
          .status,
        401,
      );
      assert.equal(
        (
          await fetch(url + "/health", {
            headers: { Origin: "https://untrusted.example" },
          })
        ).status,
        403,
      );
      const hostStatus = await new Promise<number>((resolve) => {
        const req = http.get(
          url + "/health",
          { headers: { Origin: origin, Host: "rebind.example" } },
          (res) => {
            res.resume();
            resolve(res.statusCode!);
          },
        );
        req.on("error", () => resolve(0));
      });
      assert.equal(hostStatus, 403);
      const code = service.auth.pairingCode();
      const paired = await fetch(url + "/pair", {
        method: "POST",
        headers: { Origin: origin, "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      assert.equal(paired.status, 200);
      const { token } = (await paired.json()) as { token: string };
      assert.equal(
        (
          await fetch(url + "/pair", {
            method: "POST",
            headers: { Origin: origin, "Content-Type": "application/json" },
            body: JSON.stringify({ code }),
          })
        ).status,
        403,
      );
      const client = createTRPCClient<LocalRouter>({
        links: [
          httpBatchLink({
            url: url + "/trpc",
            headers: { Origin: origin, Authorization: `Bearer ${token}` },
          }),
        ],
      });
      await client.updateSettings.mutate({
        dataDirectory: path.join(home, "data"),
        hfToken: "test-secret-never-in-traces",
      });
      const settings = await client.settings.query();
      assert.equal(settings.hasHfToken, true);
      assert.ok(!JSON.stringify(settings).includes("test-secret"));
      const page = await client.datasets.query({ corpus: "local" });
      const dataset = page.datasets.find((value) =>
        value.name.includes("TheViper"),
      )!;
      assert.ok(dataset);
      const run = await client.start.mutate(
        runRequestSchema.parse({
          source: dataset.source,
          module: "base",
          commentaryIntervalMs: 3600000,
        }),
      );
      const queued = await client.start.mutate(
        runRequestSchema.parse({ source: dataset.source, module: "base" }),
      );
      assert.equal(queued.status, "queued");
      assert.equal(
        (await client.cancel.mutate({ id: queued.id })).status,
        "cancelled",
      );
      const stream = await fetch(url + `/events?id=${run.id}`, {
        headers: { Origin: origin, Authorization: `Bearer ${token}` },
      });
      const reader = stream.body!.getReader();
      await reader.read();
      await reader.cancel();
      let result = await client.run.query({ id: run.id });
      const deadline = Date.now() + 60000;
      while (
        ["queued", "running"].includes(result.status) &&
        Date.now() < deadline
      ) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        result = await client.run.query({ id: run.id });
      }
      assert.equal(result.status, "completed", result.error);
      assert.equal(
        (
          await client.commentaryAt.query({
            id: run.id,
            timeMs: 100000,
            endMs: 120000,
          })
        ).state,
        "analyzed",
      );
      assert.ok(result.currentStage);
      assert.ok((result.realizationCount ?? 0) > 0);
      assert.ok(
        (await client.events.query({ id: run.id })).some(
          (event) => event.kind === "stage",
        ),
      );
      const realizations = await client.realizations.query({ id: run.id });
      assert.ok(realizations.length > 0);
      const skipped = realizations.find(
        (value) => value.decision === "skipped",
      );
      assert.ok(skipped);
      assert.ok(
        (
          await client.trace.query({ id: run.id, realizationId: skipped.id })
        ).some((step) => step.stage === "skipped"),
      );
      const trace = await client.trace.query({
        id: run.id,
        realizationId: realizations[0]!.id,
      });
      for (const stage of [
        "source",
        "analysis",
        "interpretation",
        "classification",
        "planning",
        "hydration",
        "realization",
      ])
        assert.ok(
          trace.some((value) => value.stage === stage),
          stage,
        );
      assert.ok(!JSON.stringify(trace).includes("test-secret"));
      assert.equal(result.request.debugEarlyHydration, false);
      const interpreted = trace.find((step) => step.stage === "interpretation")!
        .data as any;
      assert.equal(interpreted.interpreted.startPlayerInfo, undefined);
      const hydrated = trace.find((step) => step.stage === "hydration")!
        .data as any;
      assert.equal(hydrated.mode, "realization");
      assert.ok(hydrated.input.startPlayerInfo);
      const debug = await client.start.mutate({
        source: dataset.source,
        module: "base",
        debugEarlyHydration: true,
      });
      let debugResult = await client.run.query({ id: debug.id });
      const debugDeadline = Date.now() + 60000;
      while (
        ["queued", "running"].includes(debugResult.status) &&
        Date.now() < debugDeadline
      ) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        debugResult = await client.run.query({ id: debug.id });
      }
      assert.equal(debugResult.status, "completed", debugResult.error);
      assert.equal(debugResult.request.debugEarlyHydration, true);
      const debugTrace = await client.trace.query({
        id: debug.id,
        realizationId: "r-1",
      });
      assert.ok(
        (
          debugTrace.find((step) => step.stage === "interpretation")!
            .data as any
        ).interpreted.startPlayerInfo,
      );
      assert.equal(
        (debugTrace.find((step) => step.stage === "hydration")!.data as any)
          .mode,
        "early-debug",
      );

      const preview = await client.preview.query({
        id: run.id,
        table: "players",
        bin: 0,
        limit: 2,
      });
      assert.ok(preview.rows.length <= 2 && preview.total > 0);
      const events = await client.events.query({ id: run.id });
      const after = events[0]!.sequence;
      assert.ok(
        (await client.events.query({ id: run.id, after })).every(
          (event) => event.sequence > after,
        ),
      );
      assert.equal(
        fs.existsSync(path.join(home, "runs", run.id, "sources")),
        false,
      );
      await service.close();
      closed = true;
      const restarted = await createService({
        home,
        port: 0,
        origins: [origin],
      });
      try {
        assert.equal(restarted.backend.getRun(run.id).status, "completed");
        assert.equal(
          restarted.backend.realizations(run.id).length,
          realizations.length,
        );
        assert.ok(restarted.auth.allowed(token, origin));
      } finally {
        await restarted.close();
      }
    } finally {
      if (!closed) await service.close();
      fs.rmSync(home, { recursive: true, force: true });
    }
  },
);

test("queued cancellation is persisted and interrupted jobs are marked after restart", async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "sage-restart-"));
  const id = "11111111-1111-4111-8111-111111111111";
  fs.mkdirSync(path.join(home, "runs", id), { recursive: true });
  fs.writeFileSync(
    path.join(home, "runs", id, "run.json"),
    JSON.stringify({
      id,
      status: "running",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      request: runRequestSchema.parse({
        source: { kind: "local", id: "test" },
      }),
      sourceName: "test",
      codeVersion: "test",
    }),
  );
  const service = await createService({ home, port: 0, origins: [origin] });
  try {
    assert.equal(service.backend.getRun(id).status, "interrupted");
  } finally {
    await service.close();
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test(
  "model run records prompts and replay changes provider model without analysis",
  { timeout: 90000 },
  async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "sage-model-"));
    const bodies: any[] = [];
    const mock = http.createServer(async (req, res) => {
      let text = "";
      for await (const part of req) text += part;
      const body = JSON.parse(text);
      bodies.push(body);
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          id: "mock",
          object: "chat.completion",
          created: 1,
          model: body.model,
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: "The players are developing their economies.",
              },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      );
    });
    await new Promise<void>((resolve) => mock.listen(0, "127.0.0.1", resolve));
    const service = await createService({ home, port: 0, origins: [origin] });
    try {
      const baseUrl = `http://127.0.0.1:${(mock.address() as any).port}/v1`;
      const dataset = (
        await service.backend.datasets({
          corpus: "local",
          resolution: "60000",
          filter: "TheViper",
          offset: 0,
          limit: 10,
        })
      ).datasets[0]!;
      const run = service.backend.start(
        runRequestSchema.parse({
          source: dataset.source,
          module: "base",
          provider: { kind: "openai", model: "mock-first", baseUrl },
        }),
      );
      async function wait(id: string) {
        const deadline = Date.now() + 60000;
        while (
          ["running", "queued"].includes(service.backend.getRun(id).status) &&
          Date.now() < deadline
        )
          await new Promise((resolve) => setTimeout(resolve, 100));
        const result = service.backend.getRun(id);
        assert.equal(result.status, "completed", result.error);
      }
      await wait(run.id);
      const first = service.backend
        .realizations(run.id)
        .find((r) =>
          service.backend.trace(run.id, r.id).some((x) => x.stage === "prompt"),
        )!;
      assert.ok(first);
      const replay = service.backend.rerun(run.id, first.id, {
        kind: "openai",
        model: "mock-second",
        baseUrl,
      });
      await wait(replay.id);
      const trace = service.backend.trace(replay.id, "r-1");
      assert.ok(!trace.some((step) => step.stage === "analysis"));
      assert.deepEqual(
        (trace.find((s) => s.stage === "prompt")!.data as any).inputJson,
        (
          service.backend
            .trace(run.id, first.id)
            .find((s) => s.stage === "prompt")!.data as any
        ).inputJson,
      );
      assert.equal(bodies.at(-1).model, "mock-second");
      assert.equal(
        service.backend.realizations(replay.id)[0]!.gameTimeMs,
        first.gameTimeMs,
      );
      assert.equal(replay.comparison?.originalText, first.text);
      service.backend.deleteRun(run.id);
      assert.throws(() => service.backend.getRun(run.id), /Run not found/);
      assert.equal(
        service.backend.realizations(replay.id)[0]!.text,
        first.text,
      );
      assert.ok(
        service.backend
          .trace(replay.id, "r-1")
          .some((step) => step.stage === "prompt"),
      );
      service.backend.restoreRun(run.id);
      const active = service.backend.start(
        runRequestSchema.parse({ source: dataset.source, module: "base" }),
      );
      assert.equal(service.backend.cancel(active.id).status, "cancelled");
    } finally {
      await service.close();
      mock.closeAllConnections();
      await new Promise<void>((resolve) => mock.close(() => resolve()));
      fs.rmSync(home, { recursive: true, force: true });
    }
  },
);
