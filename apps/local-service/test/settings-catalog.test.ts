import { test } from "node:test";
import assert from "node:assert/strict";
import { validateHfToken } from "../src/hf-token.js";
import { matchesDataset } from "../src/catalog-filter.js";

test("HF validation uses only Hugging Face, distinguishes rejection/transient errors and never echoes secrets", async () => {
  const token = "hf_testSecret123";
  const accepted = await validateHfToken(token, async (input, init) => {
    assert.equal(input, "https://huggingface.co/api/whoami-v2");
    assert.equal((init?.headers as any).Authorization, `Bearer ${token}`);
    assert.equal(init?.redirect, "error");
    return Response.json({ name: "example" });
  });
  assert.equal(accepted.valid, true);
  assert.match(accepted.message, /example/);
  assert.ok(!JSON.stringify(accepted).includes(token));
  const rejected = await validateHfToken(
    token,
    async () => new Response("", { status: 401 }),
  );
  assert.equal(rejected.valid, false);
  assert.match(rejected.message, /rejected/);
  const limited = await validateHfToken(
    token,
    async () => new Response("", { status: 429 }),
  );
  assert.equal(limited.valid, false);
  assert.match(limited.message, /rate limiting/);
  const network = await validateHfToken(token, async () => {
    throw new Error(token);
  });
  assert.equal(network.valid, false);
  assert.ok(!JSON.stringify(network).includes(token));
  assert.equal(
    (
      await validateHfToken("not-a-hf-token", async () => {
        throw new Error("Must not send invalid-format input");
      })
    ).valid,
    false,
  );
});
test("catalog filtering combines names, maps, dimensions, length and file sizes before pagination", () => {
  const dataset: any = {
    name: "Match 002",
    metadata: {
      mapName: "Arabia",
      mapWidth: 120,
      mapHeight: 120,
      durationMs: 35 * 60000,
      players: [{ name: "Alice", civName: "Franks" }],
    },
    space: { downloadBytes: 200 * 1024 * 1024 },
  };
  assert.equal(
    matchesDataset(dataset, {
      filter: "Arabia Alice",
      minDurationMs: 30 * 60000,
      maxDurationMs: 40 * 60000,
      maxDownloadBytes: 500 * 1024 * 1024,
      mapSize: "120x120",
    }),
    true,
  );
  assert.equal(matchesDataset(dataset, { filter: "Arena" }), false);
  assert.equal(
    matchesDataset(dataset, { filter: "", maxDurationMs: 20 * 60000 }),
    false,
  );
  assert.equal(
    matchesDataset(dataset, {
      filter: "",
      maxDownloadBytes: 100 * 1024 * 1024,
    }),
    false,
  );
  assert.equal(
    matchesDataset({ name: "Missing metadata" } as any, {
      filter: "",
      maxDurationMs: 30 * 60000,
    }),
    false,
  );
});

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Settings } from "../src/settings.js";
import { settingsUpdateSchema } from "@sage/contracts";

test("model timeout and thinking survive saving and remain in public configuration without keys", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "sage-model-settings-"));
  try {
    const value = settingsUpdateSchema.parse({
      provider: {
        kind: "openai",
        model: "gemma4:12b",
        baseUrl: "http://127.0.0.1:11434/v1",
        timeoutMs: 600000,
        reasoningEffort: "none",
        apiKey: "test-secret",
      },
    });
    new Settings(home).update(value);
    const restored = new Settings(home);
    assert.equal(restored.provider("openai").timeoutMs, 600000);
    assert.equal(restored.provider("openai").reasoningEffort, "none");
    assert.equal(restored.publicSettings().providers.openai?.timeoutMs, 600000);
    assert.equal(
      restored.publicSettings().providers.openai?.reasoningEffort,
      "none",
    );
    assert.ok(
      !JSON.stringify(restored.publicSettings()).includes("test-secret"),
    );
    assert.equal(
      settingsUpdateSchema.safeParse({
        provider: { ...value.provider, timeoutMs: 0 },
      }).success,
      false,
    );
    assert.equal(
      settingsUpdateSchema.safeParse({
        provider: { ...value.provider, timeoutMs: 3600001 },
      }).success,
      false,
    );
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});
