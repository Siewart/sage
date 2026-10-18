import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { once } from "node:events";
import assert from "node:assert/strict";
import { parseArgs } from "node:util";
const { values: options } = parseArgs({
  options: {
    runtime: { type: "string" },
    node: { type: "string" },
    frontend: { type: "string" },
  },
});
const desktop = fileURLToPath(new URL("../", import.meta.url));
const runtime = options.runtime
  ? path.resolve(options.runtime)
  : path.join(desktop, "stage/runtime");
const home = fs.mkdtempSync(path.join(os.tmpdir(), "sage-desktop-smoke-"));
const binary =
  options.node ??
  fs
    .readdirSync(path.join(desktop, "src-tauri/binaries"))
    .find((name) => name.startsWith("sage-runtime-"));
assert.ok(binary, "Bundled Node sidecar is missing");
const child = spawn(
  options.node
    ? path.resolve(binary)
    : path.join(desktop, "src-tauri/binaries", binary),
  [path.join(runtime, "bootstrap.mjs")],
  {
    env: {
      ...process.env,
      NODE_OPTIONS: "",
      SAGE_HOME: home,
      SAGE_DATA_DIR: path.join(home, "data"),
    },
    stdio: ["pipe", "pipe", "inherit"],
  },
);
const exited = once(child, "exit");
const lines = createInterface({ input: child.stdout })[Symbol.asyncIterator]();
const reply = async () => JSON.parse((await lines.next()).value);
const command = (value) => child.stdin.write(JSON.stringify(value) + "\n");
const timeout = setTimeout(() => {
  child.kill();
  console.error("Desktop smoke test timed out");
  process.exitCode = 1;
}, 90000);
let origin;
try {
  assert.deepEqual(await reply(), { ready: true });
  command({ command: "session", origin: "https://other.example" });
  assert.ok((await reply()).error);
  command({ command: "session", origin: "tauri://localhost" });
  const session = await reply();
  origin = session.url;
  assert.ok(session.token);
  assert.ok(
    fs.existsSync(
      path.join(
        options.frontend
          ? path.resolve(options.frontend)
          : path.join(runtime, "web"),
        "index.html",
      ),
    ),
  );
  assert.equal(
    (
      await fetch(origin + "/trpc/runs", {
        headers: { Origin: "tauri://localhost" },
      })
    ).status,
    401,
  );
  assert.equal(
    (await fetch(origin, { headers: { Origin: "https://other.example" } }))
      .status,
    403,
  );
  const request = async (name, input, post = false) => {
    const response = await fetch(
      origin +
        "/trpc/" +
        name +
        (post ? "" : "?input=" + encodeURIComponent(JSON.stringify(input))),
      {
        headers: {
          Origin: "tauri://localhost",
          Authorization: `Bearer ${session.token}`,
          "Content-Type": "application/json",
        },
        ...(post ? { method: "POST", body: JSON.stringify(input) } : {}),
      },
    );
    const value = await response.json();
    assert.equal(response.status, 200, JSON.stringify(value));
    return value.result.data;
  };
  const { datasets } = await request("datasets", { corpus: "local" });
  assert.equal(datasets.length, 4);
  const run = await request(
    "start",
    {
      source: datasets.find((value) => value.name.includes("TheViper")).source,
      module: "base",
      provider: { kind: "templates", model: "", baseUrl: "" },
    },
    true,
  );
  let result;
  const deadline = Date.now() + 60000;
  do {
    await new Promise((resolve) => setTimeout(resolve, 100));
    result = await request("run", { id: run.id });
  } while (
    ["queued", "running"].includes(result.status) &&
    Date.now() < deadline
  );
  assert.equal(result.status, "completed", result.error);
  const values = await request("realizations", { id: run.id });
  assert.ok(values.length > 3);
  assert.ok(fs.existsSync(path.join(home, "runs", run.id, "run.json")));
  command({ command: "shutdown" });
  const [code] = await exited;
  assert.equal(code, 0);
  await assert.rejects(fetch(origin + "/trpc/runs"));
  console.log(
    JSON.stringify({
      bundledNode: true,
      fixtures: datasets.length,
      realizations: values.length,
      status: result.status,
      shutdown: true,
    }),
  );
} finally {
  clearTimeout(timeout);
  if (child.exitCode === null) child.kill();
  await exited;
  fs.rmSync(home, { recursive: true, force: true });
}
