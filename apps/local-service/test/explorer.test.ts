import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Backend } from "../src/backend.js";
import { Settings } from "../src/settings.js";
import { commentaryContext } from "../src/commentary-context.js";
import {
  runRequestSchema,
  type RunSummary,
  type Realization,
} from "@sage/contracts";
import { createLocalRouter } from "@sage/contracts/router";

const makeRun = (extra: Partial<RunSummary> = {}): RunSummary => ({
  id: "11111111-1111-4111-8111-111111111111",
  createdAt: "",
  updatedAt: "",
  status: "running",
  sourceName: "test",
  codeVersion: "test",
  request: runRequestSchema.parse({ source: { kind: "local", id: "test" } }),
  ...extra,
});
const entry = (
  id: string,
  time: number,
  extra: Partial<Realization> = {},
): Realization => ({
  id,
  gameTimeMs: time,
  text: id,
  template: "test",
  deferred: false,
  elapsedMs: 0,
  realizeMs: 0,
  ...extra,
});
test("fallback uses the latest earlier time, includes ties, excludes future and deferred text", () => {
  const rows = [
    entry("r-1", 1000),
    entry("r-2", 3000),
    entry("r-3", 2000),
    entry("r-4", 2000),
    entry("r-5", 2500, { deferred: true, text: "<DEFER>" }),
  ];
  const context = commentaryContext(makeRun(), rows, undefined, 2600, 2900);
  assert.deepEqual(
    context.entries.map((e) => e.id),
    ["r-3", "r-4"],
  );
  assert.equal(context.earlier, true);
  assert.equal(context.state, "not-generated");
  assert.deepEqual(
    commentaryContext(makeRun(), rows, undefined, 0, 999).entries,
    [],
  );
});
test("coverage distinguishes pending, partial, silent, failed, download and legacy runs", () => {
  const run = makeRun();
  assert.equal(
    commentaryContext(
      run,
      [],
      { throughMs: 3000, processingMs: 3000 },
      2000,
      3000,
    ).state,
    "processing",
  );
  assert.equal(
    commentaryContext({ ...run, status: "failed" }, [], undefined, 2000, 3000)
      .state,
    "unknown",
  );
  assert.equal(
    commentaryContext(
      run,
      [],
      { throughMs: 1000, processingMs: 2100 },
      2000,
      3000,
    ).state,
    "processing",
  );
  assert.equal(
    commentaryContext(
      run,
      [],
      { throughMs: 2200, processingMs: null },
      2000,
      3000,
    ).state,
    "partial",
  );
  assert.equal(
    commentaryContext(
      run,
      [],
      { throughMs: 3000, processingMs: null },
      2000,
      3000,
    ).state,
    "analyzed",
  );
  assert.equal(
    commentaryContext(
      { ...run, status: "failed" },
      [],
      { throughMs: 1000, processingMs: 2100 },
      2000,
      3000,
    ).state,
    "failed",
  );
  assert.equal(
    commentaryContext(
      { ...run, status: "completed" },
      [],
      undefined,
      2000,
      3000,
    ).state,
    "unknown",
  );
  assert.equal(
    commentaryContext(
      {
        ...run,
        status: "completed",
        request: { ...run.request, operation: "download" },
      },
      [],
      undefined,
      2000,
      3000,
    ).state,
    "not-generated",
  );
});
test(
  "local matches can be explored without generating commentary; SQL paging, linking and video survive restart",
  { timeout: 90000 },
  async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "sage-explorer-"));
    let backend = new Backend(new Settings(home));
    try {
      backend.updateSettings({ dataDirectory: path.join(home, "data") });
      const dataset = (
        await backend.datasets({
          corpus: "local",
          resolution: "60000",
          filter: "TheViper",
          offset: 0,
          limit: 10,
        })
      ).datasets[0]!;
      const run = backend.start(
        runRequestSchema.parse({
          source: dataset.source,
          operation: "download",
        }),
      );
      while (["queued", "running"].includes(backend.getRun(run.id).status))
        await new Promise((r) => setTimeout(r, 50));
      assert.equal(backend.getRun(run.id).status, "completed");
      const caller = createLocalRouter(backend).createCaller({});
      const info = (await caller.inspect({ id: run.id, kind: "info" })).info!;
      assert.ok(info.bins.length > 1);
      assert.equal(info.mapWidth, 120);
      const first = await caller.inspect({
        id: run.id,
        kind: "rows",
        table: "entities",
        bin: 0,
        limit: 2,
      });
      const next = await caller.inspect({
        id: run.id,
        kind: "rows",
        table: "entities",
        bin: 0,
        limit: 2,
        offset: 2,
      });
      assert.equal(first.rows!.length, 2);
      assert.ok(first.total! > 2);
      assert.notEqual(first.rows![0]._rowId, next.rows![0]._rowId);
      const events = await caller.inspect({
        id: run.id,
        kind: "rows",
        table: "events",
        bin: 0,
        limit: 3,
      });
      assert.ok(events.rows!.length);
      assert.ok(
        events.rows!.every(
          (r) =>
            Number(r.worldTime) >= info.bins[0][0] &&
            Number(r.worldTime) <= info.bins[0][1],
        ),
      );
      const subject = Number(events.rows![0].subjectEntity);
      const entity = await caller.inspect({
        id: run.id,
        kind: "rows",
        table: "entities",
        bin: 0,
        entity: subject,
      });
      assert.ok(entity.rows!.every((r) => r.id === subject));
      const spatial = await caller.inspect({
        id: run.id,
        kind: "spatial",
        bin: 0,
        player: 1,
      });
      assert.ok(spatial.entries!.length);
      assert.ok(spatial.entries!.every((e) => e.owner === 1));
      const terrain = await caller.inspect({ id: run.id, kind: "terrain" });
      assert.equal(terrain.terrain!.length, 14400);
      assert.equal(
        (
          await caller.commentaryAt({
            id: run.id,
            timeMs: 100000,
            endMs: 120000,
          })
        ).state,
        "not-generated",
      );
      await assert.rejects(
        caller.inspect({ id: run.id, kind: "rows", bin: 999999 }),
        /does not exist/,
      );
      await assert.rejects(
        caller.inspect({ id: run.id, kind: "rows", offset: -1 }),
      );
      const injected = await caller.inspect({
        id: run.id,
        kind: "rows",
        table: "events",
        eventType: "' OR 1=1 --",
      });
      assert.equal(injected.total, 0);
      const selected = await caller.inspect({
        id: run.id,
        kind: "rows",
        table: "entities",
        entityIds: [Number(first.rows![0].id)],
      });
      assert.equal(selected.total, 1);
      assert.equal(selected.rows![0].id, first.rows![0].id);
      await assert.rejects(
        caller.saveMatchVideo({ id: run.id, video: { youtubeId: "bad" } }),
      );
      await caller.saveMatchVideo({
        id: run.id,
        video: {
          youtubeId: "xcTGTlpj6sA",
          offsetSeconds: 4447.08,
          gameRate: 1.65,
          label: "Study video",
        },
      });
      await backend.shutdown();
      backend = new Backend(new Settings(home));
      assert.equal(backend.matchVideo(run.id)?.youtubeId, "xcTGTlpj6sA");
      assert.equal(
        (
          await backend.inspect({
            id: run.id,
            kind: "info",
            bin: 0,
            table: "entities",
            offset: 0,
            limit: 30,
          })
        ).info?.key,
        info.key,
      );
    } finally {
      await backend.shutdown();
      fs.rmSync(home, { recursive: true, force: true });
    }
  },
);
