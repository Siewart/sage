/**
 * DuckDB worker.
 *
 * `@duckdb/node-api` is async, but the SAGE pipeline is synchronous from the
 * document planner all the way down into the templates. Rather than turn ten
 * thousand lines async — and risk changing the generated reports — the DuckDB
 * backend runs the database in this worker and blocks the main thread on
 * `Atomics.wait` until a result lands in shared memory. The main thread keeps
 * its synchronous `SageQuery` contract; DuckDB still does the filtering and
 * joining off disk, which is the point of the exercise.
 *
 * Written as plain `.mjs` so `new Worker(...)` resolves it identically under
 * tsx, ts-jest and the compiled build.
 *
 * Protocol: control[0] is the status flag the main thread waits on
 * (0 pending, 1 inline result, 2 result spilled to a file, 3 error) and
 * control[1] is the payload's byte length. Payloads are UTF-8 JSON.
 */
import { parentPort, workerData } from "node:worker_threads";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { DuckDBInstance } from "@duckdb/node-api";

const STATUS_PENDING = 0;
const STATUS_INLINE = 1;
const STATUS_SPILLED = 2;
const STATUS_ERROR = 3;

const control = new Int32Array(workerData.controlBuffer);
const data = new Uint8Array(workerData.dataBuffer);
const encoder = new TextEncoder();

let connection = null;
let spillCounter = 0;

/** DuckDB returns BIGINT as BigInt; Arquero returns plain numbers. Align them. */
function normalize(value) {
  if (typeof value === "bigint") {
    const asNumber = Number(value);
    if (!Number.isSafeInteger(asNumber)) {
      throw new Error(`BIGINT ${value} does not fit a JS number`);
    }
    return asNumber;
  }
  if (Array.isArray(value)) return value.map(normalize);
  if (value !== null && typeof value === "object") {
    if (value instanceof Date) return value;
    const out = {};
    for (const [key, inner] of Object.entries(value))
      out[key] = normalize(inner);
    return out;
  }
  return value;
}

function reply(status, payload) {
  const bytes = encoder.encode(payload);
  if (status !== STATUS_ERROR && bytes.byteLength > data.byteLength) {
    const file = path.join(
      os.tmpdir(),
      `sage-duckdb-${process.pid}-${spillCounter++}.json`,
    );
    fs.writeFileSync(file, payload);
    return reply(STATUS_SPILLED, file);
  }
  const truncated = bytes.subarray(
    0,
    Math.min(bytes.byteLength, data.byteLength),
  );
  data.set(truncated);
  Atomics.store(control, 1, truncated.byteLength);
  Atomics.store(control, 0, status);
  Atomics.notify(control, 0);
}

async function handle(message) {
  switch (message.kind) {
    case "open": {
      const instance = await DuckDBInstance.create(
        message.databasePath ?? ":memory:",
        message.config ?? {},
      );
      connection = await instance.connect();
      for (const statement of message.statements ?? []) {
        await connection.run(statement);
      }
      return "null";
    }
    case "query": {
      if (!connection) throw new Error("DuckDB worker used before open");
      const reader = await connection.runAndReadAll(message.sql);
      return JSON.stringify(reader.getRowObjectsJS().map(normalize));
    }
    case "exec": {
      if (!connection) throw new Error("DuckDB worker used before open");
      await connection.run(message.sql);
      return "null";
    }
    case "close": {
      connection?.closeSync?.();
      connection = null;
      return "null";
    }
    default:
      throw new Error(`Unknown message kind: ${String(message.kind)}`);
  }
}

parentPort.on("message", (message) => {
  handle(message).then(
    (payload) => reply(STATUS_INLINE, payload),
    (error) => reply(STATUS_ERROR, String(error?.stack ?? error)),
  );
});

// Referenced so the constants read as used by linters that scan this file.
void STATUS_PENDING;
