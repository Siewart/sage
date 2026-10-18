import test, { mock } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { LocalRouter } from "@sage/contracts/router";
import { runRequestSchema } from "@sage/contracts";

test("permanent Trash deletion is guarded, clears beyond the library limit, retains datasets and survives restart", async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "sage-trash-"));
  const worker = path.join(home, "stopping-worker.mjs");
  fs.writeFileSync(
    worker,
    `
    process.on('message', () => process.send({kind:'phase',data:{phase:'generating'}}));
    process.on('SIGTERM', () => {
      setTimeout(() => process.send({kind:'finished',data:{}}), 30);
      setTimeout(() => process.exit(0), 350);
    });
    setInterval(() => {}, 1000);
  `,
  );
  const make = (deleted: boolean) => {
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
        sourceName: "Disposable Trash fixture",
        codeVersion: "test",
        ...(deleted ? { deletedAt: "2026-01-02T00:00:00Z" } : {}),
        request: runRequestSchema.parse({
          source: { kind: "local", id: "fixture" },
        }),
      }),
    );
    fs.writeFileSync(path.join(dir, "r-1.ndjson"), "saved trace\n");
    return id;
  };
  const deleted = Array.from({ length: 105 }, () => make(true)),
    retained = make(false);
  const dataset = path.join(home, "downloaded-dataset.parquet");
  fs.writeFileSync(dataset, "dataset stays");
  const previous = process.env.SAGE_WORKER_PATH;
  process.env.SAGE_WORKER_PATH = worker;
  let createService;
  try {
    ({ createService } = await import(
      new URL("../src/index.ts?trash-test", import.meta.url).href
    ));
  } finally {
    if (previous === undefined) delete process.env.SAGE_WORKER_PATH;
    else process.env.SAGE_WORKER_PATH = previous;
  }
  const origin = "https://trash.example";
  let service = await createService({ home, port: 0, origins: [origin] });
  const connect = () =>
    createTRPCClient<LocalRouter>({
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
  const until = async (check: () => Promise<boolean>) => {
    const deadline = Date.now() + 5000;
    while (!(await check())) {
      if (Date.now() >= deadline) assert.fail("Worker did not finish stopping");
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  };
  try {
    let api = connect();
    assert.equal(await api.trashCount.query(), 105);
    assert.equal((await api.runs.query({ deleted: true })).length, 100);
    await assert.rejects(
      api.purgeRun.mutate({ id: retained }),
      /Move the run to Trash/,
    );
    await assert.rejects(
      api.purgeRun.mutate({ id: "../downloaded-dataset.parquet" }),
    );
    const fixture = (await api.datasets.query({ corpus: "local" }))
      .datasets[0]!;
    const active = await api.start.mutate({ source: fixture.source });
    await assert.rejects(
      api.purgeRun.mutate({ id: active.id }),
      /Stop the run/,
    );
    await until(
      async () =>
        (await api.run.query({ id: active.id })).phase === "generating",
    );
    await api.cancel.mutate({ id: active.id });
    await api.deleteRun.mutate({ id: active.id });
    await assert.rejects(
      api.purgeRun.mutate({ id: active.id }),
      /still stopping/,
    );
    await until(async () => {
      try {
        await api.purgeRun.mutate({ id: active.id });
        return true;
      } catch (error) {
        if (/still stopping/.test(String(error))) return false;
        throw error;
      }
    });
    assert.ok(
      !fs.existsSync(path.join(home, "runs", active.id)),
      "worker exit cannot recreate purged metadata",
    );
    await api.purgeRun.mutate({ id: deleted[0]! });
    assert.ok(!fs.existsSync(path.join(home, "runs", deleted[0]!)));
    await assert.rejects(
      api.restoreRun.mutate({ id: deleted[0]! }),
      /Run not found/,
    );
    assert.equal(await api.trashCount.query(), 104);
    const blocked = deleted[1]!,
      originalRm = fs.rmSync;
    const failure = mock.method(
      fs,
      "rmSync",
      (target: fs.PathLike, options?: fs.RmOptions) => {
        if (path.basename(String(target)) === blocked)
          throw new Error("Fixture file is locked");
        return originalRm(target, options);
      },
    );
    try {
      assert.deepEqual(await api.clearTrash.mutate(), {
        deleted: 103,
        failed: 1,
      });
    } finally {
      failure.mock.restore();
    }
    assert.equal(await api.trashCount.query(), 1);
    assert.ok(fs.existsSync(path.join(home, "runs", blocked, "r-1.ndjson")));
    assert.deepEqual(await api.clearTrash.mutate(), { deleted: 1, failed: 0 });
    assert.equal(fs.readFileSync(dataset, "utf8"), "dataset stays");
    assert.equal(
      fs.readFileSync(path.join(home, "runs", retained, "r-1.ndjson"), "utf8"),
      "saved trace\n",
    );
    await service.close();
    service = await createService({ home, port: 0, origins: [origin] });
    api = connect();
    assert.equal(await api.trashCount.query(), 0);
    assert.deepEqual(
      (await api.runs.query()).map((run) => run.id),
      [retained],
    );
    await assert.rejects(
      api.restoreRun.mutate({ id: blocked }),
      /Run not found/,
    );
  } finally {
    await service.close();
    fs.rmSync(home, { recursive: true, force: true });
  }
});
