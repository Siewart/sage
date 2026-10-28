import fs from "node:fs";
import { fork, type ChildProcess } from "node:child_process";
import type { WorkerInput } from "./worker.js";
import type { InspectionResult } from "@sage/contracts/explorer";

/** One bounded, reusable query worker. Requests serialize; idle connections release files. */
export class MatchReader {
  private child?: ChildProcess;
  private descriptor?: string;
  private queue: Promise<unknown> = Promise.resolve();
  private idle?: ReturnType<typeof setTimeout>;
  private pending = 0;
  private stopped = false;
  get busy() {
    return this.pending > 0;
  }
  constructor(
    private worker: string,
    private args: string[],
  ) {}
  read(input: WorkerInput): Promise<InspectionResult> {
    if (this.stopped)
      return Promise.reject(new Error("Service is shutting down"));
    this.pending++;
    clearTimeout(this.idle);
    const result = this.queue.then(() => this.request(input));
    this.queue = result
      .catch(() => {})
      .finally(() => {
        this.pending--;
        if (!this.pending)
          this.idle = setTimeout(() => this.release(), 30000).unref();
      });
    return result;
  }
  release() {
    this.child?.kill();
    this.child = undefined;
    this.descriptor = undefined;
    clearTimeout(this.idle);
  }
  close() {
    this.stopped = true;
    this.release();
  }
  private request(input: WorkerInput): Promise<InspectionResult> {
    if (this.stopped) throw new Error("Service is shutting down");
    const stat = fs.statSync(input.descriptorPath!);
    const signature = `${input.descriptorPath}:${stat.mtimeMs}:${stat.size}`;
    if (this.descriptor !== signature) this.release();
    if (!this.child) {
      this.child = fork(this.worker, [], {
        execArgv: this.args,
        stdio: ["ignore", "ignore", "ignore", "ipc"],
      });
      this.descriptor = signature;
    }
    const child = this.child;
    return new Promise((resolve, reject) => {
      const finish = (error?: Error, data?: InspectionResult) => {
        clearTimeout(timer);
        child.off("message", message);
        child.off("exit", exit);
        child.off("error", failed);
        if (error) {
          this.release();
          reject(error);
        } else resolve(data!);
      };
      const message = (raw: unknown) => {
        const value = raw as {
          kind: string;
          data: InspectionResult & { message: string };
        };
        if (value.kind === "inspection-result") finish(undefined, value.data);
        if (value.kind === "inspection-failed")
          finish(new Error(value.data.message));
      };
      const exit = () => finish(new Error("Match query worker exited"));
      const failed = (e: Error) => finish(e);
      const timer = setTimeout(
        () => finish(new Error("Match query timed out")),
        120000,
      );
      child.on("message", message);
      child.once("exit", exit);
      child.once("error", failed);
      child.send(input, (error) => {
        if (error) finish(error);
      });
    });
  }
}
