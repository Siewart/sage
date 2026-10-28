"use client";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Realization, RunSummary } from "@sage/contracts";
import { Button } from "@sage/ui";
import { currentStageName } from "./run-stage";
import { GameTime } from "./game-time";

export function CommentaryFeed({
  run,
  loadPage,
  busy,
  onStop,
  onInspect,
}: {
  run: RunSummary;
  loadPage: (offset: number, signal: AbortSignal) => Promise<Realization[]>;
  busy: boolean;
  onStop: () => void;
  onInspect: (timeMs: number) => void;
}) {
  const feed = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const [realizations, setRealizations] = useState<Realization[]>([]);
  const [cursor, setCursor] = useState(0);
  const consumedOffset = useRef(0);
  const [nearEnd, setNearEnd] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const running = ["queued", "running"].includes(run.status);
  const next = useQuery({
    queryKey: ["commentary", run.id, cursor, run.status],
    queryFn: ({ signal }) => loadPage(cursor, signal),
    enabled: nearEnd && hasMore,
    refetchInterval: running ? 1500 : false,
    refetchOnWindowFocus: false,
  });
  useEffect(() => {
    if (!next.data) return;
    if (next.data.length) {
      if (cursor !== consumedOffset.current) return;
      consumedOffset.current = cursor + next.data.length;
      setRealizations((previous) => [...previous, ...next.data!]);
      setCursor(consumedOffset.current);
      setHasMore(next.data.length === 50 || running);
    } else if (!running) setHasMore(false);
  }, [next.data, next.dataUpdatedAt, running, cursor]);
  const messages = realizations.filter(
    (item) => item.text.trim() && !item.deferred && !item.decision,
  );
  const lastMessage = messages.at(-1)?.id;
  useEffect(() => {
    const el = feed.current;
    if (!el) return;
    if (running && follow.current) el.scrollTop = el.scrollHeight;
    setNearEnd(el.scrollHeight - el.scrollTop - el.clientHeight < 240);
  }, [lastMessage, running]);
  return (
    <>
      <div className="feed-status">
        <div className="stack">
          <strong role="status" aria-live="polite" aria-atomic="true">
            {currentStageName(run)}
          </strong>
          <span className="small muted">{run.sourceName}</span>
          <span className="small muted">
            {run.request.provider.model || "Offline templates"}
          </span>
        </div>
        {running && (
          <Button className="danger" disabled={busy} onClick={onStop}>
            Stop
          </Button>
        )}
      </div>
      {run.error && (
        <p className="error panel-body" role="alert">
          {run.error}
        </p>
      )}
      <div
        className="commentary-feed"
        ref={feed}
        role="log"
        tabIndex={0}
        aria-label="Realized commentary"
        aria-live={running ? "polite" : "off"}
        onScroll={() => {
          const el = feed.current;
          if (el) {
            const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
            follow.current = remaining < 80;
            setNearEnd(remaining < 240);
          }
        }}
      >
        {messages.map((item) => (
          <article className="commentary-message" key={item.id}>
            <div className="message-meta">
              <span>SAGE</span>
              <GameTime milliseconds={item.gameTimeMs} />
              <Button
                className="secondary"
                onClick={() => onInspect(item.gameTimeMs)}
              >
                Inspect this moment
              </Button>
            </div>
            <div className="commentary-markdown">
              <Markdown
                remarkPlugins={[remarkGfm]}
                skipHtml
                components={{
                  a: ({ children, href }) => (
                    <a href={href} target="_blank" rel="noopener noreferrer">
                      {children}
                    </a>
                  ),
                  img: ({ alt }) => <span>{alt || "Image omitted"}</span>,
                }}
              >
                {item.text}
              </Markdown>
            </div>
          </article>
        ))}
        {!messages.length && !next.isFetching && (
          <p className="empty">
            {running
              ? "Commentary will appear here as it is realized."
              : "No realized commentary in this run."}
          </p>
        )}
        {next.isError ? (
          <div className="error" role="alert">
            <p>Could not load more commentary: {next.error.message}</p>
            <Button className="secondary" onClick={() => void next.refetch()}>
              Retry
            </Button>
          </div>
        ) : next.isFetching ? (
          <p className="small muted" role="status">
            Loading commentary…
          </p>
        ) : hasMore ? (
          <Button className="secondary" onClick={() => setNearEnd(true)}>
            Load more commentary
          </Button>
        ) : null}
      </div>
    </>
  );
}
