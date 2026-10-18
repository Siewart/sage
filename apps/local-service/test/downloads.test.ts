import test, { mock } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { LocalRouter } from "@sage/contracts/router";
import { runRequestSchema } from "@sage/contracts";

test("download management deletes only selected cache matches, retains runs and protects live workers", async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "sage-downloads-"));
  const cache = path.join(home, "cache");
  const layout = JSON.parse(
    fs.readFileSync(
      new URL(
        "../../../packages/sage-data/src/default-layout.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const fixture = (
    name: string,
    revision = layout.revision,
    partial = false,
  ) => {
    const dir = path.join(
      cache,
      layout.repo,
      revision,
      "may2026/export/1000",
      name,
    );
    fs.mkdirSync(dir, { recursive: true });
    if (partial)
      fs.writeFileSync(path.join(dir, "match.zip.partial"), "partial download");
    else {
      fs.mkdirSync(path.join(dir, "tables"));
      fs.writeFileSync(path.join(dir, "match.parquet.zip"), "archive bytes");
      fs.writeFileSync(
        path.join(dir, "tables/entities.parquet"),
        "compressed table bytes",
      );
      fs.writeFileSync(
        path.join(dir, "tables/descriptor.json"),
        JSON.stringify({ name, metadata: { binTimes: [[0, 60000]] } }),
      );
    }
    return dir;
  };
  const a = fixture("Match A"),
    b = fixture("Match B"),
    c = fixture("Match C"),
    partial = fixture("Partial", layout.revision, true),
    old = fixture("Older revision", "a".repeat(40));
  const outside = path.join(home, "user-data");
  const metadataOnly = path.join(path.dirname(a), "Metadata only");
  fs.mkdirSync(metadataOnly);
  fs.writeFileSync(
    path.join(metadataOnly, "match.parquet.zip.space.json"),
    '{"extractedBytes":1000}',
  );
  fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside, "keep.parquet"), "user files stay");
  if (process.platform !== "win32") {
    fs.symlinkSync(
      outside,
      path.join(path.dirname(a), "Linked user data"),
      "dir",
    );
    fs.symlinkSync(outside, path.join(a, "external-link"), "dir");
  }
  const runId = randomUUID(),
    runDir = path.join(home, "runs", runId);
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(
    path.join(runDir, "run.json"),
    JSON.stringify({
      id: runId,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
      status: "completed",
      sourceName: "Match A",
      codeVersion: "test",
      descriptorPath: path.join(a, "tables/descriptor.json"),
      request: runRequestSchema.parse({
        source: {
          kind: "hf",
          match: "Match A",
          corpus: "may2026",
          resolution: "1000",
        },
      }),
    }),
  );
  fs.writeFileSync(
    path.join(runDir, "r-1.ndjson"),
    JSON.stringify({
      stage: "realization",
      data: { text: "Saved commentary" },
    }) + "\n",
  );
  const worker = path.join(home, "worker.mjs");
  fs.writeFileSync(
    worker,
    `process.on('message', input => { if(input.kind==='preview') {setTimeout(()=>process.send({kind:'result',data:{rows:[],total:0}}),500);setTimeout(()=>process.exit(0),900);}else{process.send({kind:'phase',data:{phase:'generating'}});} });process.on('SIGTERM',()=>setTimeout(()=>process.exit(0),350));setInterval(()=>{},1000);`,
  );
  const previous = process.env.SAGE_WORKER_PATH;
  process.env.SAGE_WORKER_PATH = worker;
  let createService;
  try {
    ({ createService } = await import(
      new URL("../src/index.ts?downloads-test", import.meta.url).href
    ));
  } finally {
    if (previous === undefined) delete process.env.SAGE_WORKER_PATH;
    else process.env.SAGE_WORKER_PATH = previous;
  }
  const origin = "https://downloads.example";
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
      if (Date.now() > deadline) assert.fail("Worker state did not settle");
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  };
  try {
    let api = connect();
    await api.updateSettings.mutate({ dataDirectory: cache });
    const initial = await api.downloadedDatasets.query();
    assert.equal(initial.datasets.length, 5);
    const ids = new Map(
      initial.datasets.map((dataset) => [dataset.name, dataset.id]),
    );
    assert.equal(
      initial.datasets.find((dataset) => dataset.name === "Partial")!.bytes,
      Buffer.byteLength("partial download"),
    );
    assert.equal(
      initial.datasets.find((dataset) => dataset.name === "Match A")!.bytes,
      fs.statSync(path.join(a, "match.parquet.zip")).size +
        fs.statSync(path.join(a, "tables/entities.parquet")).size +
        fs.statSync(path.join(a, "tables/descriptor.json")).size,
    );
    assert.ok(initial.datasets.every((dataset) => !("path" in dataset)));
    await assert.rejects(
      api.deleteDownloadedDatasets.mutate({ ids: ["../user-data"] }),
    );
    const local = await api.register.mutate({
      descriptorPath: path.join(a, "tables/descriptor.json"),
    });
    const preview = api.preview.query({ id: runId, table: "entities", bin: 0 });
    await until(async () =>
      (await api.downloadedDatasets.query()).datasets.some((dataset) =>
        dataset.protectedReason?.includes("preview"),
      ),
    );
    assert.equal(
      (
        await api.deleteDownloadedDatasets.mutate({
          ids: [ids.get("Match A")!],
        })
      ).failed.length,
      1,
    );
    await preview;
    await until(async () =>
      (await api.downloadedDatasets.query()).datasets.every(
        (dataset) => !dataset.protectedReason,
      ),
    );
    const request = (match: string) => ({
      source: {
        kind: "hf" as const,
        match,
        corpus: "may2026" as const,
        resolution: "1000" as const,
      },
      operation: "download" as const,
    });
    const active = await api.start.mutate(request("Match A"));
    await until(
      async () =>
        (await api.run.query({ id: active.id })).phase === "generating",
    );
    const queued = await api.start.mutate(request("Match B"));
    const guarded = await api.deleteDownloadedDatasets.mutate({
      ids: [ids.get("Match A")!, ids.get("Match B")!],
    });
    assert.equal(guarded.deleted.length, 0);
    assert.equal(guarded.failed.length, 2);
    await api.cancel.mutate({ id: queued.id });
    await api.cancel.mutate({ id: active.id });
    assert.equal(
      (
        await api.deleteDownloadedDatasets.mutate({
          ids: [ids.get("Match A")!],
        })
      ).failed.length,
      1,
      "stopping worker still owns its files",
    );
    await until(async () =>
      (await api.downloadedDatasets.query()).datasets.every(
        (dataset) => !dataset.protectedReason,
      ),
    );
    const originalRm = fs.promises.rm;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let entered = false;
    const removal = mock.method(
      fs.promises,
      "rm",
      async (target: fs.PathLike, options?: fs.RmOptions) => {
        if (path.basename(String(target)) === "Match B")
          throw new Error("Fixture is locked");
        if (path.basename(String(target)) === "Match C") {
          entered = true;
          await gate;
        }
        return originalRm(target, options);
      },
    );
    const deleting = api.deleteDownloadedDatasets.mutate({
      ids: [
        ids.get("Match C")!,
        ids.get("Match B")!,
        ids.get("Partial")!,
        ids.get("Partial")!,
      ],
    });
    try {
      await until(async () => entered);
      await assert.rejects(
        api.start.mutate(request("Match C")),
        /deletion to finish/,
      );
      await assert.rejects(
        api.updateSettings.mutate({ dataDirectory: outside }),
        /deletion to finish/,
      );
      await assert.rejects(
        api.preview.query({ id: runId, table: "entities", bin: 0 }),
        /deletion to finish/,
      );
      release();
      const result = await deleting;
      assert.equal(result.deleted.length, 2);
      assert.equal(result.failed.length, 1);
      assert.equal(result.failed[0]!.id, ids.get("Match B"));
      assert.ok(result.removedBytes > 0);
      assert.ok(fs.existsSync(b));
      assert.ok(!fs.existsSync(c) && !fs.existsSync(partial));
    } finally {
      release();
      removal.mock.restore();
      await deleting;
    }
    await api.updateSettings.mutate({ dataDirectory: outside });
    assert.equal(
      (
        await api.deleteDownloadedDatasets.mutate({
          ids: [ids.get("Match A")!],
        })
      ).failed.length,
      1,
    );
    assert.ok(
      fs.existsSync(a),
      "changing the cache never deletes a stale selection from its previous root",
    );
    await api.updateSettings.mutate({ dataDirectory: cache });
    const removed = await api.deleteDownloadedDatasets.mutate({
      ids: [
        ids.get("Match A")!,
        ids.get("Match B")!,
        ids.get("Older revision")!,
      ],
    });
    assert.equal(removed.deleted.length, 3);
    assert.equal(removed.failed.length, 0);
    assert.ok(!fs.existsSync(a) && !fs.existsSync(b) && !fs.existsSync(old));
    assert.equal(
      fs.readFileSync(path.join(outside, "keep.parquet"), "utf8"),
      "user files stay",
    );
    assert.equal(
      (await api.trace.query({ id: runId, realizationId: "r-1" }))[0]!.data &&
        fs.existsSync(path.join(runDir, "run.json")),
      true,
    );
    assert.ok(
      !(await api.datasets.query({ corpus: "local" })).datasets.some(
        (dataset) => dataset.id === local.id,
      ),
    );
    await assert.rejects(
      api.preview.query({ id: runId, table: "entities", bin: 0 }),
      /Download this match again/,
    );
    assert.equal((await api.downloadedDatasets.query()).datasets.length, 0);
    await service.close();
    service = await createService({ home, port: 0, origins: [origin] });
    api = connect();
    assert.equal((await api.downloadedDatasets.query()).datasets.length, 0);
    assert.ok((await api.run.query({ id: runId })).id);
  } finally {
    await service.close();
    fs.rmSync(home, { recursive: true, force: true });
  }
});
