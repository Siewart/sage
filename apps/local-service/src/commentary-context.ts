import type { Realization, RunSummary } from "@sage/contracts";
import type {
  CommentaryContext,
  CoverageProgress,
} from "@sage/contracts/explorer";

/** Never select future text, deferred control messages, or another run's text. */
export function commentaryContext(
  run: RunSummary,
  entries: Realization[],
  coverage: CoverageProgress | undefined,
  timeMs: number,
  endMs: number,
): CommentaryContext {
  const eligible = entries.filter(
    (r) =>
      r.gameTimeMs <= timeMs && r.text.trim() && !r.deferred && !r.decision,
  );
  const latest = eligible.reduce(
    (t, r) => Math.max(t, r.gameTimeMs),
    -Infinity,
  );
  const current = entries.filter(
    (r) => r.gameTimeMs >= timeMs && r.gameTimeMs <= endMs,
  );
  let state: CommentaryContext["state"] = "not-generated";
  if (run.request.operation === "generate") {
    if (!coverage)
      state = run.comparison
        ? "not-generated"
        : run.status === "completed"
          ? "unknown"
          : run.status === "failed"
            ? "unknown"
            : "not-generated";
    else if (coverage.complete) state = "analyzed";
    else if (
      coverage.processingMs !== null &&
      coverage.processingMs >= timeMs &&
      coverage.processingMs <= endMs
    )
      state =
        run.status === "failed"
          ? "failed"
          : ["running", "queued"].includes(run.status)
            ? "processing"
            : "partial";
    else if (coverage.throughMs !== null && coverage.throughMs >= endMs)
      state = "analyzed";
    else if (coverage.throughMs !== null && coverage.throughMs >= timeMs)
      state = "partial";
  }
  return {
    state,
    entries: eligible.filter((r) => r.gameTimeMs === latest),
    earlier: latest < timeMs,
    decisions: {
      skipped: current.filter((r) => r.decision === "skipped").length,
      deferred: current.filter((r) => r.deferred).length,
      failed: current.filter((r) => r.decision === "failed").length,
    },
  };
}
