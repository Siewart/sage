"use client";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { createTRPCClient } from "@trpc/client";
import type { LocalRouter } from "@sage/contracts/router";
import type { RunSummary } from "@sage/contracts";
import type { DataRow, InspectionRequest } from "@sage/contracts/explorer";
import { Badge, Button, Json, Panel } from "@sage/ui";
import { MatchMap } from "./match-map";
import { MatchVideo } from "./match-video";

const EMPTY: never[] = [];
export const gameClock = (ms: number) =>
  `${Math.floor(ms / 60000)}:${Math.floor((ms / 1000) % 60)
    .toString()
    .padStart(2, "0")}`;
export function parseClock(value: string) {
  const parts = value.trim().split(":").map(Number);
  if (parts.length > 3 || parts.some((n) => !Number.isFinite(n) || n < 0))
    return undefined;
  return parts.reduce((n, v) => n * 60 + v, 0) * 1000;
}
export function snapshotAt(bins: [number, number][], time: number) {
  let lo = 0,
    hi = bins.length - 1,
    result = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (bins[mid][0] <= time) {
      result = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return result;
}

export function MatchExplorer({
  api,
  run,
  position,
  onClose,
}: {
  api: ReturnType<typeof createTRPCClient<LocalRouter>>;
  run: RunSummary;
  position: { timeMs: number; sequence: number };
  onClose: () => void;
}) {
  const [cursor, setCursor] = useState(position.timeMs),
    [timeText, setTimeText] = useState(gameClock(position.timeMs)),
    [seek, setSeek] = useState({ timeMs: position.timeMs, sequence: 0 });
  const [selected, setSelected] = useState<number[]>([]),
    [selectedRow, setSelectedRow] = useState<DataRow | null>(null),
    [selectedEvent, setSelectedEvent] = useState<number | null>(null);
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [table, setTable] = useState<InspectionRequest["table"]>("entities"),
    [offset, setOffset] = useState(0),
    [eventOffset, setEventOffset] = useState(0),
    [player, setPlayer] = useState(""),
    [entityFilter, setEntityFilter] = useState(""),
    [eventType, setEventType] = useState(""),
    [allEvents, setAllEvents] = useState(false),
    [error, setError] = useState(""),
    [evidence, setEvidence] = useState("");
  const info = useQuery({
    queryKey: ["match-info", run.id, !!run.descriptorPath],
    queryFn: ({ signal }) =>
      api.inspect.query({ id: run.id, kind: "info" }, { signal }),
    enabled: !!run.descriptorPath,
    staleTime: Infinity,
    gcTime: 10000,
    retry: false,
  });
  const match = info.data?.info;
  const bins = match?.bins ?? EMPTY;
  const bin = snapshotAt(bins, cursor),
    range = bins[bin];
  const jump = (ms: number) => {
    if (!bins.length) return;
    const time = Math.max(bins[0][0], Math.min(bins.at(-1)![1], ms));
    setCursor(time);
    setTimeText(gameClock(time));
    setSeek((previous) => ({ timeMs: time, sequence: previous.sequence + 1 }));
    setSelectedRow(null);
    setSelectedEvent(null);
    setError("");
  };
  useEffect(() => {
    if (match) jump(position.timeMs);
  }, [position, match?.key]);
  useEffect(() => {
    setOffset(0);
  }, [bin, player, table, entityFilter, selectedOnly]);
  useEffect(() => {
    setEventOffset(0);
  }, [allEvents ? null : bin, player, entityFilter, eventType, allEvents]);
  const filter = {
    ...(player ? { player: Number(player) } : {}),
    ...(entityFilter ? { entity: Number(entityFilter) } : {}),
  };
  const terrain = useQuery({
    queryKey: ["match-terrain", match?.key],
    queryFn: ({ signal }) =>
      api.inspect.query({ id: run.id, kind: "terrain" }, { signal }),
    enabled: !!match,
    staleTime: Infinity,
    gcTime: 10000,
    retry: false,
  });
  const spatial = useQuery({
    queryKey: ["match-spatial", match?.key, bin, player],
    queryFn: ({ signal }) =>
      api.inspect.query(
        {
          id: run.id,
          kind: "spatial",
          bin,
          ...(player ? { player: Number(player) } : {}),
        },
        { signal },
      ),
    enabled: !!range,
    staleTime: Infinity,
    gcTime: 10000,
    retry: false,
  });
  const rows = useQuery({
    queryKey: [
      "match-rows",
      match?.key,
      table,
      bin,
      offset,
      player,
      entityFilter,
      selectedOnly ? selected.slice(0, 500).join(",") : "",
    ],
    queryFn: ({ signal }) =>
      api.inspect.query(
        {
          id: run.id,
          kind: "rows",
          table,
          bin,
          offset,
          limit: 30,
          ...filter,
          ...(selectedOnly && table === "entities"
            ? { entityIds: selected.slice(0, 500) }
            : {}),
        },
        { signal },
      ),
    enabled: !!range,
    staleTime: Infinity,
    gcTime: 10000,
    retry: false,
  });
  const events = useQuery({
    queryKey: [
      "match-events",
      match?.key,
      bin,
      eventOffset,
      player,
      entityFilter,
      eventType,
      allEvents,
    ],
    queryFn: ({ signal }) =>
      api.inspect.query(
        {
          id: run.id,
          kind: "rows",
          table: "events",
          bin,
          offset: eventOffset,
          limit: 30,
          ...filter,
          ...(eventType ? { eventType } : {}),
          ...(allEvents
            ? { timeRange: [bins[0][0], bins.at(-1)![1]] as [number, number] }
            : {}),
        },
        { signal },
      ),
    enabled: !!range,
    staleTime: Infinity,
    gcTime: 10000,
    retry: false,
  });
  const commentary = useQuery({
    gcTime: 0,
    queryKey: ["commentary-at", run.id, cursor, range?.[1], run.updatedAt],
    queryFn: ({ signal }) =>
      api.commentaryAt.query(
        { id: run.id, timeMs: cursor, endMs: range![1] },
        { signal },
      ),
    enabled: !!range,
    retry: false,
  });
  const video = useQuery({
    queryKey: ["match-video", run.id],
    queryFn: () => api.matchVideo.query({ id: run.id }),
    enabled: !!run.descriptorPath,
  });
  const trace = useQuery({
    queryKey: ["explorer-trace", run.id, evidence],
    queryFn: () => api.trace.query({ id: run.id, realizationId: evidence }),
    enabled: !!evidence,
  });
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const context = commentary.data;
  const stateLabel = context
    ? {
        "not-generated": "Not generated for this section",
        processing: "This section is still processing",
        partial: "This section is partially analyzed",
        analyzed: "Section analyzed",
        failed: "Generation failed in this section",
        unknown: "Coverage is unknown for this older run",
      }[context.state]
    : "Loading commentary…";
  const selectEvent = (row: DataRow) => {
    const time = Number(row.worldTime);
    if (Number.isFinite(time)) jump(time);
    setSelectedRow(row);
    setSelectedEvent(Number(row._rowId));
    setSelected(
      [row.subjectEntity, row.objectEntity].filter(
        (v): v is number => typeof v === "number",
      ),
    );
  };
  return (
    <Panel
      title="Match explorer"
      aside={
        <Button className="secondary" onClick={onClose}>
          Close explorer
        </Button>
      }
    >
      <div className="panel-body stack match-explorer">
        {!run.descriptorPath && (
          <p role="status">
            Waiting for the match download to finish. Commentary generation is
            not required.
          </p>
        )}
        {info.error && (
          <p className="error" role="alert">
            {info.error.message}
            <Button className="secondary" onClick={() => void info.refetch()}>
              Retry
            </Button>
          </p>
        )}
        {info.isFetching && <p role="status">Opening local match data…</p>}
        {match && range && (
          <>
            <strong>{match.name}</strong>
            <div className="row explorer-time">
              <Button
                className="secondary"
                disabled={bin === 0}
                onClick={() => jump(bins[bin - 1][0])}
              >
                Previous snapshot
              </Button>
              <form
                className="row"
                onSubmit={(e) => {
                  e.preventDefault();
                  const time = parseClock(timeText);
                  if (time === undefined)
                    setError("Enter a game time such as 12:34 or 1:02:34.");
                  else jump(time);
                }}
              >
                <label>
                  Game time (GT)
                  <input
                    value={timeText}
                    onChange={(e) => setTimeText(e.target.value)}
                    aria-label="Jump to game time"
                  />
                </label>
                <Button>Jump</Button>
              </form>
              <Button
                className="secondary"
                disabled={bin === bins.length - 1}
                onClick={() => jump(bins[bin + 1][0])}
              >
                Next snapshot
              </Button>
              <Badge>
                Snapshot {bin + 1} / {bins.length}
              </Badge>
            </div>
            <label>
              Match timeline
              <input
                type="range"
                min={bins[0][0]}
                max={bins.at(-1)![1]}
                step={1000}
                value={cursor}
                onChange={(e) => jump(Number(e.target.value))}
              />
            </label>
            <p className="small muted">
              Viewing {gameClock(cursor)} GT · recorded snapshot window{" "}
              {gameClock(range[0])}–{gameClock(range[1])}. States are sampled;
              no positions are interpolated. Event timestamps remain exact.
            </p>
            <div className="row">
              <label>
                Player
                <select
                  value={player}
                  onChange={(e) => setPlayer(e.target.value)}
                >
                  <option value="">All players</option>
                  {match.players.map((p) => (
                    <option key={Number(p.id)} value={Number(p.id)}>
                      {String(p.name)} · {String(p.id)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Entity ID
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={entityFilter}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "" || /^\d+$/.test(v)) setEntityFilter(v);
                  }}
                />
              </label>
              <Button
                className="secondary"
                onClick={() => {
                  setSelected([]);
                  setSelectedOnly(false);
                  setSelectedRow(null);
                  setSelectedEvent(null);
                  setEntityFilter("");
                }}
              >
                Clear selection
              </Button>
              <Badge>{selected.length} entities selected</Badge>
            </div>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <div className="explorer-split">
              <div className="stack">
                <MatchMap
                  info={match}
                  entries={spatial.data?.entries ?? EMPTY}
                  terrain={terrain.data?.terrain ?? EMPTY}
                  selected={selected}
                  point={
                    selectedRow &&
                    typeof (selectedRow.worldX ?? selectedRow.x) === "number" &&
                    typeof (selectedRow.worldY ?? selectedRow.y) === "number"
                      ? {
                          x: Number(selectedRow.worldX ?? selectedRow.x),
                          y: Number(selectedRow.worldY ?? selectedRow.y),
                        }
                      : undefined
                  }
                  onSelect={(ids) => {
                    setSelected(ids);
                    setSelectedOnly(ids.length > 0);
                    setTable("entities");
                    setOffset(0);
                    setSelectedRow(null);
                    setSelectedEvent(null);
                  }}
                />
                {spatial.isFetching && (
                  <p className="small" role="status">
                    Loading snapshot positions…
                  </p>
                )}
                {spatial.data?.truncated && (
                  <p className="notice">
                    Map limited to 200,000 entities. Filter by player to narrow
                    the view.
                  </p>
                )}
                {terrain.data?.truncated && (
                  <p className="notice">Terrain limited to 1,000,000 cells.</p>
                )}
                {[spatial, terrain].map((q, i) =>
                  q.error ? (
                    <p key={i} className="error">
                      {q.error.message}
                      <Button
                        className="secondary"
                        onClick={() => void q.refetch()}
                      >
                        Retry
                      </Button>
                    </p>
                  ) : null,
                )}
                <div className="explorer-commentary stack" aria-live="polite">
                  <strong>{stateLabel}</strong>
                  {commentary.error && (
                    <p className="error">{commentary.error.message}</p>
                  )}
                  {context?.entries.length ? (
                    <>
                      <p className="small">
                        {context.earlier
                          ? "Latest earlier commentary"
                          : "Commentary at this time"}{" "}
                        · {gameClock(context.entries[0].gameTimeMs)} GT
                        {context.earlier
                          ? ` · ${Math.floor((cursor - context.entries[0].gameTimeMs) / 1000)} seconds earlier`
                          : ""}
                      </p>
                      {context.entries.map((entry) => (
                        <article key={entry.id}>
                          <p className="explorer-text">{entry.text}</p>
                          <div className="row">
                            <Button
                              className="secondary"
                              onClick={() => {
                                jump(entry.gameTimeMs);
                                setEvidence(entry.id);
                              }}
                            >
                              Inspect this commentary’s evidence
                            </Button>
                          </div>
                        </article>
                      ))}
                    </>
                  ) : (
                    <p>
                      {context?.state === "analyzed"
                        ? "No commentary was emitted at or before this time."
                        : "No earlier commentary is available in this run."}
                    </p>
                  )}
                  {context?.state === "analyzed" && context.earlier && (
                    <p className="small muted">
                      No new commentary at the selected time. Earlier text
                      remains visible.
                    </p>
                  )}
                  {context && (
                    <p className="small muted">
                      This section: {context.decisions.skipped} skipped ·{" "}
                      {context.decisions.deferred} deferred ·{" "}
                      {context.decisions.failed} failed. Seeking never starts
                      generation.
                    </p>
                  )}
                  {evidence && (
                    <details open>
                      <summary>Recorded pipeline evidence · {evidence}</summary>
                      {trace.error ? (
                        <p className="error">{trace.error.message}</p>
                      ) : (
                        <Json value={trace.data ?? "Loading evidence…"} />
                      )}
                    </details>
                  )}
                </div>
              </div>
              <MatchVideo
                key={match.key}
                saved={video.data}
                seek={seek}
                onTime={(ms) => {
                  const time = Math.max(
                    bins[0][0],
                    Math.min(bins.at(-1)![1], ms),
                  );
                  setCursor(time);
                  setTimeText(gameClock(time));
                }}
                onSave={async (value) => {
                  const result = await api.saveMatchVideo.mutate({
                    id: run.id,
                    video: value,
                  });
                  await video.refetch();
                  return result;
                }}
              />
            </div>
            <div className="explorer-split">
              <div className="stack">
                <div className="row">
                  <strong>Backing event stream</strong>
                  <label>
                    Event type
                    <select
                      value={eventType}
                      onChange={(e) => setEventType(e.target.value)}
                    >
                      <option value="">All types</option>
                      {match.eventTypes.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </label>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={allEvents}
                      onChange={(e) => {
                        setAllEvents(e.target.checked);
                        setEventOffset(0);
                      }}
                    />
                    Whole match
                  </label>
                </div>
                <DataTable
                  data={events.data?.rows ?? EMPTY}
                  columns={events.data?.columns ?? EMPTY}
                  preferred={[
                    "_rowId",
                    "worldTime",
                    "sage:modelType",
                    "tag",
                    "subjectEntity",
                    "objectEntity",
                    "subjectPlayerId",
                    "objectPlayerId",
                    "worldX",
                    "worldY",
                  ]}
                  busy={events.isFetching}
                  error={events.error?.message}
                  offset={eventOffset}
                  total={events.data?.total ?? 0}
                  onPage={setEventOffset}
                  onSelect={selectEvent}
                  isSelected={(r) => Number(r._rowId) === selectedEvent}
                />
              </div>
              <div className="stack">
                <div className="row">
                  <strong>Snapshot data</strong>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={selectedOnly}
                      onChange={(e) => {
                        setSelectedOnly(e.target.checked);
                        setOffset(0);
                        setTable("entities");
                      }}
                    />
                    Selected entities only
                    {selected.length > 500 ? " (first 500)" : ""}
                  </label>
                  <label>
                    Table
                    <select
                      value={table}
                      onChange={(e) => {
                        setTable(e.target.value as InspectionRequest["table"]);
                        setOffset(0);
                      }}
                    >
                      {[
                        "entities",
                        "players",
                        "researchStates",
                        "world",
                        "masters",
                        "strings",
                        "settings",
                        "mapCells",
                      ].map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <DataTable
                  data={rows.data?.rows ?? EMPTY}
                  columns={rows.data?.columns ?? EMPTY}
                  preferred={[
                    "_rowId",
                    "id",
                    "ownerId",
                    "refMasterId",
                    "name",
                    "worldX",
                    "worldY",
                    "hp",
                    "sage:binId",
                  ]}
                  busy={rows.isFetching}
                  error={rows.error?.message}
                  offset={offset}
                  total={rows.data?.total ?? 0}
                  onPage={setOffset}
                  onSelect={(r) => {
                    setSelectedRow(r);
                    setSelectedEvent(null);
                    if (table === "entities")
                      setSelected((prev) =>
                        prev.includes(Number(r.id))
                          ? prev.filter((id) => id !== Number(r.id))
                          : [...prev, Number(r.id)],
                      );
                  }}
                  isSelected={(r) =>
                    table === "entities" && selectedSet.has(Number(r.id))
                  }
                />
              </div>
            </div>
            <details open={!!selectedRow}>
              <summary>Selected row · all recorded fields</summary>
              {selectedRow ? (
                <Json value={selectedRow} />
              ) : (
                <p className="small muted">
                  Select a row to inspect all fields. Selected entity IDs:{" "}
                  {selected.slice(0, 100).join(", ") || "none"}
                  {selected.length > 100 ? "…" : ""}
                </p>
              )}
            </details>
            <p className="small muted">
              Map selections highlight entity rows across pages. Event
              selections highlight subject/object entities in the chosen
              snapshot; an entity may be absent at that sampled time. Rows
              without coordinates remain available in the tables.
            </p>
          </>
        )}
      </div>
    </Panel>
  );
}
function DataTable({
  data,
  columns,
  preferred,
  busy,
  error,
  offset,
  total,
  onPage,
  onSelect,
  isSelected,
}: {
  data: DataRow[];
  columns: string[];
  preferred: string[];
  busy: boolean;
  error?: string;
  offset: number;
  total: number;
  onPage: (n: number) => void;
  onSelect: (row: DataRow) => void;
  isSelected: (row: DataRow) => boolean;
}) {
  const shown = preferred.filter((c) => columns.includes(c));
  if (!shown.length) shown.push(...columns.slice(0, 8));
  return (
    <>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="table-scroll explorer-table" aria-busy={busy}>
        <table>
          <thead>
            <tr>
              <th>Select</th>
              {shown.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr
                key={Number(r._rowId)}
                className={isSelected(r) ? "selected-row" : ""}
              >
                <td>
                  <button
                    type="button"
                    className="row-select"
                    aria-pressed={isSelected(r)}
                    aria-label={`Select row ${r._rowId}`}
                    onClick={() => onSelect(r)}
                  >
                    {isSelected(r) ? "●" : "○"}
                  </button>
                </td>
                {shown.map((c) => (
                  <td key={c} title={String(r[c] ?? "")}>
                    {typeof r[c] === "object" && r[c] !== null
                      ? JSON.stringify(r[c])
                      : String(r[c] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!data.length && (
          <p className="empty">
            {busy ? "Loading rows…" : "No rows in this selection."}
          </p>
        )}
      </div>
      <div className="row">
        <Button
          className="secondary"
          disabled={!offset || busy}
          onClick={() => onPage(Math.max(0, offset - 30))}
        >
          Previous rows
        </Button>
        <span className="small">
          {total
            ? `${offset + 1}–${Math.min(total, offset + data.length)} of ${total.toLocaleString()}`
            : "0 rows"}
        </span>
        <Button
          className="secondary"
          disabled={offset + 30 >= total || busy}
          onClick={() => onPage(offset + 30)}
        >
          Next rows
        </Button>
      </div>
    </>
  );
}
