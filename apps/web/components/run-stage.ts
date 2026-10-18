import type { RunSummary } from "@sage/contracts";

export function currentStageName(run: RunSummary) {
  if (run.status !== "running")
    return {
      queued: "Queued",
      completed: "Completed",
      failed: "Failed",
      cancelled: "Cancelled",
      interrupted: "Interrupted",
    }[run.status];
  if (run.phase === "downloading") return "Downloading dataset";
  if (run.phase === "preparing") return "Preparing match";
  const names = {
    source: "Reading game events",
    analysis: "Analysis",
    interpretation: "Interpretation",
    classification: "Classification",
    planning: "Planning",
    hydration: "Resolving names",
    prompt: "Realization · generating commentary",
    response: "Realization · commentary ready",
    realization: "Realization",
    skipped: "Planning",
    deferred: "Planning",
    error: "Handling model error",
  };
  return run.currentStage ? names[run.currentStage] : "Starting commentary";
}
