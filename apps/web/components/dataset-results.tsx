"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "@sage/ui";

/** Keep dataset batches in one scrollable list, with a keyboard-accessible fallback. */
export function DatasetResults({
  children,
  hasMore,
  fetching,
  error,
  onMore,
  onRetry,
}: {
  children: ReactNode;
  hasMore: boolean;
  fetching: boolean;
  error?: string | undefined;
  onMore: () => void;
  onRetry: () => void;
}) {
  const list = useRef<HTMLDivElement>(null);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!hasMore || fetching || error || !list.current || !end.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onMore();
      },
      { root: list.current, rootMargin: "0px 0px 180px 0px" },
    );
    observer.observe(end.current);
    return () => observer.disconnect();
  }, [hasMore, fetching, error, onMore]);
  return (
    <div
      className="list dataset-results"
      ref={list}
      tabIndex={0}
      role="region"
      aria-label="Dataset matches"
      aria-busy={fetching}
    >
      {children}
      <div className="dataset-list-end" ref={end}>
        {error ? (
          <div className="error" role="alert">
            <p>Could not load matches: {error}</p>
            <Button className="secondary" disabled={fetching} onClick={onRetry}>
              Retry loading matches
            </Button>
          </div>
        ) : fetching && hasMore ? (
          <p className="small muted" role="status">
            Loading matches…
          </p>
        ) : hasMore ? (
          <Button className="secondary" onClick={onMore}>
            Load more matches
          </Button>
        ) : null}
      </div>
    </div>
  );
}
