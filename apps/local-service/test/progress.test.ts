import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { LocalRouter } from "@sage/contracts/router";
import { runRequestSchema } from "@sage/contracts";

test("active progress bypasses saved-run limits and tracks queue promotion and cancellation", async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "sage-progress-"));
  const worker = path.join(home, "progress-worker.mjs");
  fs.writeFileSync(
    worker,
    `
    process.on('message', input => {
      process.send({kind:'phase',data:{phase:'downloading'}});
      process.send({kind:'download',data:{received:30,total:100}});
      setTimeout(() => {
        process.send({kind:'opened',data:{descriptorPath:input.descriptorPath,revision:'local'}});
        process.send({kind:'dataset',data:{gameStartMs:1000,gameEndMs:101000}});
        process.send({kind:'phase',data:{phase:'generating'}});
        process.send({kind:'progress',data:{gameTimeMs:51000}});
        process.send({kind:'step',data:{id:'r-7',step:{stage:'prompt',data:{},elapsedMs:20}}});
      }, 150);
    });
    setInterval(() => {}, 1000);
  `,
  );
  for (let i = 0; i < 105; i++) {
    const id = randomUUID(),
      dir = path.join(home, "runs", id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "run.json"),
      JSON.stringify({
        id,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
        status: "completed",
        pinned: true,
        sourceName: "Older pinned run",
        codeVersion: "test",
        request: runRequestSchema.parse({
          source: { kind: "local", id: "fixture" },
        }),
      }),
    );
  }
  const previous = process.env.SAGE_WORKER_PATH;
  process.env.SAGE_WORKER_PATH = worker;
  let createService;
  try {
    ({ createService } = await import(
      new URL("../src/index.ts?progress-test", import.meta.url).href
    ));
  } finally {
    if (previous === undefined) delete process.env.SAGE_WORKER_PATH;
    else process.env.SAGE_WORKER_PATH = previous;
  }
  const origin = "https://progress.example";
  const service = await createService({ home, port: 0, origins: [origin] });
  const api = createTRPCClient<LocalRouter>({
    links: [
      httpBatchLink({
        url: `http://127.0.0.1:${(service.server.address() as any).port}/trpc`,
        headers: {
          Origin: origin,
          Authorization: `Bearer ${service.auth.pair(service.auth.pairingCode(), origin)}`,
        },
      }),
    ],
  });
  const waitFor = async (check: () => Promise<boolean>) => {
    const deadline = Date.now() + 5000;
    while (!(await check())) {
      if (Date.now() >= deadline) assert.fail("Progress did not arrive");
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  };
  try {
    const fixture = (await api.datasets.query({ corpus: "local" }))
      .datasets[0]!;
    const first = await api.start.mutate({ source: fixture.source });
    await waitFor(
      async () => (await api.activeRuns.query())[0]?.phase === "downloading",
    );
    assert.deepEqual((await api.activeRuns.query())[0]?.progress, {
      downloadReceivedBytes: 30,
      downloadTotalBytes: 100,
    });
    const second = await api.start.mutate({ source: fixture.source });
    const third = await api.start.mutate({ source: fixture.source });
    await waitFor(
      async () =>
        (await api.activeRuns.query())[0]?.currentRealizationId === "r-7",
    );
    const active = await api.activeRuns.query();
    assert.deepEqual(
      active.map((run) => [run.id, run.status]),
      [
        [first.id, "running"],
        [second.id, "queued"],
        [third.id, "queued"],
      ],
    );
    assert.deepEqual(active[0]?.progress, {
      gameStartMs: 1000,
      gameEndMs: 101000,
      gameTimeMs: 51000,
    });
    assert.equal(active[0]?.currentStage, "prompt");
    assert.equal((await api.runs.query()).length, 100);
    assert.ok(!(await api.runs.query()).some((run) => run.id === first.id));
    await api.cancel.mutate({ id: second.id });
    assert.deepEqual(
      (await api.activeRuns.query()).map((run) => run.id),
      [first.id, third.id],
    );
    await api.cancel.mutate({ id: first.id });
    await waitFor(
      async () =>
        (await api.activeRuns.query())[0]?.currentRealizationId === "r-7",
    );
    assert.deepEqual(
      (await api.activeRuns.query()).map((run) => [run.id, run.status]),
      [[third.id, "running"]],
    );
    const saved = JSON.parse(
      fs.readFileSync(path.join(home, "runs", first.id, "run.json"), "utf8"),
    );
    assert.equal(saved.status, "cancelled");
    assert.equal(saved.progress.gameTimeMs, 51000);
    await api.cancel.mutate({ id: third.id });
    assert.deepEqual(await api.activeRuns.query(), []);
  } finally {
    await service.close();
    fs.rmSync(home, { recursive: true, force: true });
  }
});
