"use client";
import { useEffect, useRef, useState } from "react";
import type { RunSummary } from "@sage/contracts";
import { Button } from "@sage/ui";
import { GameTime } from "./game-time";
import { currentStageName } from "./run-stage";

function progressValue(run: RunSummary) {
  if (run.status === "queued") return 0;
  const value = run.progress;
  if (run.phase === "downloading") {
    if (!value?.downloadTotalBytes) return undefined;
    return Math.min(
      100,
      Math.max(
        0,
        ((value.downloadReceivedBytes ?? 0) / value.downloadTotalBytes) * 100,
      ),
    );
  }
  if (
    run.phase !== "generating" ||
    value?.gameStartMs === undefined ||
    value.gameEndMs === undefined ||
    value.gameTimeMs === undefined ||
    value.gameEndMs <= value.gameStartMs
  )
    return undefined;
  return Math.min(
    99,
    Math.max(
      0,
      ((value.gameTimeMs - value.gameStartMs) /
        (value.gameEndMs - value.gameStartMs)) *
        100,
    ),
  );
}

export function RunProgress({
  runs,
  loading,
  unavailable,
  busy,
  onOpen,
  onStop,
}: {
  runs: RunSummary[];
  loading: boolean;
  unavailable: boolean;
  busy: boolean;
  onOpen: (id: string) => void;
  onStop: (id: string) => void;
}) {
  const dock = useRef<HTMLElement>(null);
  const [height, setHeight] = useState(80);
  useEffect(() => {
    const element = dock.current;
    if (!element) return;
    const measure = () => setHeight(element.getBoundingClientRect().height);
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, []);
  return (
    <>
      <div aria-hidden="true" style={{ height }} />
      <aside className="run-progress" ref={dock} aria-label="Run progress">
        <div className="run-progress-heading">
          <strong>Run progress</strong>
          <span className="small muted" role="status">
            {unavailable
              ? "Connection lost · retrying…"
              : loading
                ? "Checking active runs…"
                : runs.length
                  ? `${runs.filter((run) => run.status === "running").length} running · ${runs.filter((run) => run.status === "queued").length} queued`
                  : "No active runs"}
          </span>
        </div>
        {!!runs.length && (
          <div
            className="run-progress-list"
            tabIndex={0}
            role="region"
            aria-label="Active and queued jobs"
          >
            {runs.map((run) => {
              const percent = progressValue(run);
              const label =
                run.status === "queued"
                  ? "Queued job"
                  : run.phase === "downloading"
                    ? "Current file download"
                    : "Game timeline reached";
              return (
                <div className="run-progress-row" key={run.id}>
                  <button
                    className="run-progress-open"
                    onClick={() => onOpen(run.id)}
                    title={`Open ${run.sourceName}`}
                  >
                    <strong>{run.sourceName}</strong>
                    <span className="small muted">
                      {currentStageName(run)}
                      {run.currentRealizationId
                        ? ` · ${run.currentRealizationId}`
                        : ""}
                    </span>
                  </button>
                  <div className="run-progress-meter">
                    <progress
                      max={100}
                      value={percent}
                      aria-label={`${label}: ${run.sourceName}`}
                      title={
                        run.status === "queued"
                          ? "Waiting for an available worker."
                          : run.phase === "downloading"
                            ? "Progress for the current compressed file, not the whole dataset."
                            : "Share of the game timeline reached, not an estimate of remaining processing time."
                      }
                    />
                    <span className="small muted">
                      {run.status === "queued"
                        ? "Waiting"
                        : percent === undefined
                          ? "In progress…"
                          : `${Math.floor(percent)}% · ${label.toLowerCase()}`}
                    </span>
                    {run.phase === "generating" &&
                      run.progress?.gameTimeMs !== undefined && (
                        <GameTime milliseconds={run.progress.gameTimeMs} />
                      )}
                  </div>
                  <Button
                    className="secondary"
                    disabled={busy || unavailable}
                    aria-label={`${run.status === "queued" ? "Cancel" : "Stop"} ${run.sourceName}`}
                    onClick={() => onStop(run.id)}
                  >
                    {run.status === "queued" ? "Cancel" : "Stop"}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </aside>
    </>
  );
}
