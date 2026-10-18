import { AsyncLocalStorage } from "node:async_hooks";
import type { Provider, TraceStage } from "./index.js";

export interface ExecutionContext {
  runId?: string;
  realizationId?: string;
  provider?: Provider;
  apiKey?: string;
  emit?: (stage: TraceStage, value: unknown) => void;
  signal?: AbortSignal;
  debugEarlyHydration?: boolean;
}
export const execution = new AsyncLocalStorage<ExecutionContext>();
