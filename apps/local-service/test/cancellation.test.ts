import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Settings } from "../src/settings.js";
import { runRequestSchema } from "@sage/contracts";

test("cancellation remains terminal when a worker sends completion during shutdown", async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "sage-late-finish-"));
  const worker = path.join(home, "late-worker.mjs");
  fs.writeFileSync(
    worker,
    `
    process.on('message', () => {
      process.send({kind:'phase',data:{phase:'generating'}});
      process.send({kind:'realization',data:{id:'r-1',template:'intro',gameTimeMs:0,text:'Already realized',deferred:false,elapsedMs:1,realizeMs:1}});
    });
    process.on('SIGTERM', () => {
      process.send({kind:'phase',data:{phase:'completed'}});
      process.send({kind:'finished',data:{}});
      process.send({kind:'failed',data:{message:'late shutdown error'}});
      setTimeout(() => process.exit(0), 30);
    });
  `,
  );
  const previous = process.env.SAGE_WORKER_PATH;
  process.env.SAGE_WORKER_PATH = worker;
  let Backend;
  try {
    ({ Backend } = await import(
      new URL("../src/backend.ts?cancellation-test", import.meta.url).href
    ));
  } finally {
    if (previous === undefined) delete process.env.SAGE_WORKER_PATH;
    else process.env.SAGE_WORKER_PATH = previous;
  }
  const backend = new Backend(new Settings(home));
  try {
    const dataset = (
      await backend.datasets({
        corpus: "local",
        resolution: "60000",
        filter: "",
        offset: 0,
        limit: 1,
      })
    ).datasets[0]!;
    const run = backend.start(
      runRequestSchema.parse({ source: dataset.source }),
    );
    const deadline = Date.now() + 5000;
    while (!backend.realizations(run.id).length && Date.now() < deadline)
      await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(backend.realizations(run.id)[0]?.text, "Already realized");
    assert.equal(backend.cancel(run.id).status, "cancelled");
    await backend.shutdown();
    const saved = backend.getRun(run.id);
    assert.equal(saved.status, "cancelled");
    assert.equal(saved.phase, "cancelled");
    assert.equal(saved.error, undefined);
    assert.equal(backend.realizations(run.id).length, 1);
    assert.ok(
      !backend
        .events(run.id, 0, 100)
        .some((event) => event.kind === "finished" || event.kind === "failed"),
    );
    assert.equal(
      JSON.parse(
        fs.readFileSync(path.join(home, "runs", run.id, "run.json"), "utf8"),
      ).status,
      "cancelled",
    );
  } finally {
    await backend.shutdown();
    fs.rmSync(home, { recursive: true, force: true });
  }
});
