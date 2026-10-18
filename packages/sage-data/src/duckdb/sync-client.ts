import * as fs from "node:fs";
import { Worker } from "node:worker_threads";
import { fileURLToPath } from "node:url";

import type { Row } from "../types.js";

const STATUS_PENDING = 0;
const STATUS_SPILLED = 2;
const STATUS_ERROR = 3;

/** 32 MiB covers every per-match query the pipeline makes; larger results spill to a file. */
const DEFAULT_BUFFER_BYTES = 32 * 1024 * 1024;

export interface SyncDuckDbOptions {
  /** DuckDB database path; defaults to an in-memory database. */
  databasePath?: string | undefined;
  /** Statements run once at startup, e.g. the `CREATE VIEW`s for a match. */
  statements?: readonly string[] | undefined;
  bufferBytes?: number | undefined;
}

/**
 * Synchronous client for a DuckDB instance living in a worker thread.
 *
 * Each call posts a message and blocks on `Atomics.wait` until the worker
 * signals. That makes DuckDB usable from the pipeline's synchronous code paths
 * without turning the whole pipeline async — see `worker.mjs` for why.
 */
export class SyncDuckDb {
  private readonly worker: Worker;
  private readonly control: Int32Array;
  private readonly data: Uint8Array;
  private readonly decoder = new TextDecoder();
  private closed = false;

  constructor(options: SyncDuckDbOptions = {}) {
    const controlBuffer = new SharedArrayBuffer(8);
    const dataBuffer = new SharedArrayBuffer(
      options.bufferBytes ?? DEFAULT_BUFFER_BYTES,
    );
    this.control = new Int32Array(controlBuffer);
    this.data = new Uint8Array(dataBuffer);

    this.worker = new Worker(
      process.env["SAGE_DUCKDB_WORKER"] ?? fileURLToPath(new URL("./worker.mjs", import.meta.url)),
      { workerData: { controlBuffer, dataBuffer } },
    );
    // Callers block in `Atomics.wait` on a SharedArrayBuffer, never on the
    // event loop, so the worker needs no event-loop reference to do its job —
    // but holding one keeps the process alive after the work is done. A
    // caller that forgets `close()` would otherwise hang forever having
    // already produced its output, which is exactly what `gen generate
    // --backend duckdb` did.
    this.worker.unref();
    // The caller blocks in Atomics.wait until the worker signals, so a worker
    // that dies must be turned into a signalled error or the wait never ends.
    this.worker.on("error", (error) =>
      this.fail(String(error?.stack ?? error)),
    );
    this.worker.on("exit", (code) => {
      if (!this.closed) this.fail(`DuckDB worker exited with code ${code}`);
    });

    this.call({
      kind: "open",
      databasePath: options.databasePath,
      statements: options.statements ?? [],
      config: {
        memory_limit: process.env["SAGE_MEMORY_LIMIT"] ?? "2GB",
        threads: process.env["SAGE_THREADS"] ?? "2",
        ...(process.env["SAGE_TEMP_DIRECTORY"]
          ? { temp_directory: process.env["SAGE_TEMP_DIRECTORY"] }
          : {}),
        max_temp_directory_size: process.env["SAGE_MAX_TEMP_SIZE"] ?? "10GB",
      },
    });
  }

  query(sql: string): Row[] {
    return (this.call({ kind: "query", sql }) ?? []) as Row[];
  }

  exec(sql: string): void {
    this.call({ kind: "exec", sql });
  }

  close(): void {
    if (this.closed) return;
    try {
      this.call({ kind: "close" });
    } finally {
      this.closed = true;
      void this.worker.terminate();
    }
  }

  /** Signal a failure to a blocked caller from the main thread's own handlers. */
  private fail(message: string): void {
    const bytes = new TextEncoder().encode(message);
    this.data.set(
      bytes.subarray(0, Math.min(bytes.byteLength, this.data.byteLength)),
    );
    Atomics.store(
      this.control,
      1,
      Math.min(bytes.byteLength, this.data.byteLength),
    );
    Atomics.store(this.control, 0, STATUS_ERROR);
    Atomics.notify(this.control, 0);
  }

  private call(message: Record<string, unknown>): unknown {
    if (this.closed) throw new Error("SyncDuckDb is closed");
    Atomics.store(this.control, 0, STATUS_PENDING);
    Atomics.store(this.control, 1, 0);
    this.worker.postMessage(message);

    const deadline = Date.now() + 120_000;
    while (Atomics.load(this.control, 0) === STATUS_PENDING) {
      if (Date.now() >= deadline) {
        this.closed = true;
        void this.worker.terminate();
        throw new Error("DuckDB worker timed out after 120 seconds");
      }
      Atomics.wait(this.control, 0, STATUS_PENDING, 1000);
    }

    const status = Atomics.load(this.control, 0);
    const length = Atomics.load(this.control, 1);
    const payload = this.decoder.decode(this.data.subarray(0, length));

    if (status === STATUS_ERROR) {
      throw new Error(`DuckDB worker error: ${payload}`);
    }
    if (status === STATUS_SPILLED) {
      const contents = fs.readFileSync(payload, "utf-8");
      fs.rmSync(payload, { force: true });
      return JSON.parse(contents);
    }
    return JSON.parse(payload);
  }
}
