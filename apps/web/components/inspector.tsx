"use client";
import dynamic from "next/dynamic";
const MatchExplorer = dynamic(
  () => import("./match-explorer").then((module) => module.MatchExplorer),
  { ssr: false },
);
import { CommentaryFeed } from "./commentary-feed";
import { DatasetResults } from "./dataset-results";
import { GameTime } from "./game-time";
import { DownloadManager } from "./download-manager";
import { RunProgress } from "./run-progress";
import { ThemeRuntime, ThemeSetting, ThemeToggle } from "./theme";
import { DestructiveConfirmation } from "./destructive-confirmation";
import {
  configuredModel,
  defaultGenerationSettings,
  type GenerationSettings,
} from "@sage/contracts";
import { ConnectionStatus } from "./connection-status";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { ServiceSetup } from "./service-setup";
import { isTauri, invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { localFetch } from "./local-fetch";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useInfiniteQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { LocalRouter } from "@sage/contracts/router";
import type {
  Dataset,
  Provider,
  RunEvent,
  RunSummary,
  TraceStep,
} from "@sage/contracts";
import { Button, Panel, Badge, Json } from "@sage/ui";

type Session = { url: string; token: string; desktop?: boolean };
type Client = ReturnType<typeof createTRPCClient<LocalRouter>>;
const emptyProvider: Provider = { kind: "templates", model: "", baseUrl: "" };
const active = (run?: RunSummary) =>
  run && ["queued", "running"].includes(run.status);
function formatBytes(bytes: number | undefined) {
  if (bytes === undefined) return "Unknown";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KiB", "MiB", "GiB", "TiB"];
  let value = bytes / 1024,
    index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index++;
  }
  return `${value.toFixed(1)} ${units[index]}`;
}
function localUrl(value: string) {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error(
      "Enter a loopback service URL, for example http://127.0.0.1:5417",
    );
  return url.origin;
}
export function InspectorApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [desktopError, setDesktopError] = useState("");
  const [connecting, setConnecting] = useState(true);
  const [desktop, setDesktop] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  useEffect(() => {
    if (isTauri()) {
      setDesktop(true);
      let disposed = false;
      let unlisten: (() => void) | undefined;
      const failed = () => {
        if (disposed) return;
        setSession(null);
        setDesktopError(
          "SAGE's local service stopped or could not start. Your saved results remain on your computer.",
        );
        setConnecting(false);
      };
      void listen("desktop-runtime-stopped", failed)
        .then(async (stopListening) => {
          if (disposed) {
            stopListening();
            return;
          }
          unlisten = stopListening;
          const value = await invoke<{ url: string; token: string }>(
            "desktop_session",
          );
          if (!disposed) setSession({ ...value, desktop: true });
        })
        .catch(failed)
        .finally(() => {
          if (!disposed) setConnecting(false);
        });
      return () => {
        disposed = true;
        unlisten?.();
      };
    }
    try {
      const saved = sessionStorage.getItem("sage-session");
      if (saved) {
        const value = JSON.parse(saved);
        setSession({ url: localUrl(value.url), token: String(value.token) });
      }
    } catch {
      sessionStorage.removeItem("sage-session");
    }
    setConnecting(false);
  }, []);
  function connect(value: Session) {
    sessionStorage.setItem("sage-session", JSON.stringify(value));
    setSession(value);
  }
  function disconnect() {
    sessionStorage.removeItem("sage-session");
    setSession(null);
  }
  return (
    <div className="app">
      <ThemeRuntime />
      <header className={`topbar${settingsOpen ? " settings-navigation" : ""}`}>
        <div className="brand">
          <span className="brand-icon">S</span>SAGE
        </div>
        <div className="row">
          <ConnectionStatus
            connected={Boolean(session)}
            desktop={desktop}
            onDisconnect={disconnect}
          />
          <ThemeToggle />
          {session && (
            <Button
              className={settingsOpen ? "secondary" : "secondary icon-button"}
              aria-label={settingsOpen ? "Back to commentary" : "Settings"}
              title={settingsOpen ? "Back to commentary" : "Settings"}
              onClick={() => setSettingsOpen((value) => !value)}
            >
              {settingsOpen ? (
                "← Back to commentary"
              ) : (
                <span aria-hidden="true">⚙</span>
              )}
            </Button>
          )}
        </div>
      </header>
      {desktopError && (
        <main className="connect">
          <p role="alert" className="error">
            {desktopError}
          </p>
          <div className="row">
            <Button onClick={() => window.location.reload()}>Retry</Button>
            <Button
              className="secondary"
              onClick={() => void invoke("desktop_diagnostics")}
            >
              Open diagnostics
            </Button>
          </div>
        </main>
      )}
      {session ? (
        <Workspace
          key={session.url + session.token}
          session={session}
          settingsOpen={settingsOpen}
          onBack={() => setSettingsOpen(false)}
          onSettings={() => setSettingsOpen(true)}
        />
      ) : connecting ? (
        <main className="connect">
          <p role="status">Opening SAGE…</p>
        </main>
      ) : desktopError ? null : desktop ? (
        <main className="connect">
          <h1>Connect to SAGE</h1>
          <p>
            Your local service and saved runs are available when you reconnect.
          </p>
          <Button
            onClick={() => {
              setConnecting(true);
              void invoke<{ url: string; token: string }>("desktop_session")
                .then((value) => setSession({ ...value, desktop: true }))
                .catch(() =>
                  setDesktopError(
                    "SAGE could not connect to its local service.",
                  ),
                )
                .finally(() => setConnecting(false));
            }}
          >
            Connect
          </Button>
        </main>
      ) : (
        <Connect onConnect={connect} />
      )}
      <footer>
        SAGE · Data and runs stay on your machine. Hosted model requests send
        the prepared facts to your selected provider.
      </footer>
    </div>
  );
}
function Connect({ onConnect }: { onConnect: (value: Session) => void }) {
  const [url, setUrl] = useState("http://127.0.0.1:5417"),
    [code, setCode] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <main className="connect">
      <h1>Connect to SAGE</h1>
      <p className="muted">
        Open the SAGE app to download and process matches on your computer. It
        starts the service and interface for you.
      </p>
      <ServiceSetup expanded />
      <details className="panel settings">
        <summary className="panel-body">
          Connect an existing service (advanced)
        </summary>
        <form
          className="panel-body stack"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const base = localUrl(url);
              const response = await localFetch(base + "/pair", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code }),
              });
              if (!response.ok)
                throw new Error(
                  "Pairing failed. Check the current code and allowed origin in your terminal.",
                );
              const value = await response.json();
              onConnect({ url: base, token: value.token });
              setCode("");
            } catch (error) {
              setError(
                error instanceof Error ? error.message : "Unable to connect",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <p className="small muted">
            Start the service using the instructions above, then enter the URL
            and pairing code printed in your terminal.
          </p>
          <label>
            Local service URL
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
          </label>
          <label>
            One-time pairing code
            <input
              autoComplete="off"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Code from your terminal"
              required
            />
          </label>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <div>
            <Button disabled={busy}>
              {busy ? "Connecting…" : "Connect local service"}
            </Button>
          </div>
        </form>
      </details>
    </main>
  );
}
function Workspace({
  session,
  settingsOpen,
  onBack,
  onSettings,
}: {
  session: Session;
  settingsOpen: boolean;
  onBack: () => void;
  onSettings: () => void;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
      }),
  );
  const api = useMemo(
    () =>
      createTRPCClient<LocalRouter>({
        links: [
          httpBatchLink({
            url: session.url + "/trpc",
            fetch: localFetch,
            headers: () => ({ Authorization: `Bearer ${session.token}` }),
          }),
        ],
      }),
    [session],
  );
  return (
    <QueryClientProvider client={queryClient}>
      <Workbench
        api={api}
        session={session}
        settingsOpen={settingsOpen}
        onBack={onBack}
        onSettings={onSettings}
      />
    </QueryClientProvider>
  );
}
function ProviderFields({
  value,
  onChange,
}: {
  value: Provider;
  onChange: (value: Provider) => void;
}) {
  return (
    <>
      <label>
        Realizer
        <select
          value={value.kind}
          onChange={(e) =>
            onChange({ ...value, kind: e.target.value as Provider["kind"] })
          }
        >
          <option value="templates">Templates · offline</option>
          <option value="gemini">Gemini</option>
          <option value="anthropic">Anthropic</option>
          <option value="openai">OpenAI / compatible local server</option>
        </select>
      </label>
      {value.kind !== "templates" && (
        <>
          <label>
            Model identifier
            <input
              value={value.model}
              onChange={(e) => onChange({ ...value, model: e.target.value })}
              placeholder="Exact model ID from your provider"
              required
            />
          </label>
          <label>
            API base URL (optional)
            <input
              value={value.baseUrl}
              onChange={(e) => onChange({ ...value, baseUrl: e.target.value })}
              placeholder={
                value.kind === "openai"
                  ? "http://127.0.0.1:11434/v1"
                  : "Provider default"
              }
            />
          </label>
          <label>
            Model request timeout (seconds)
            <input
              type="number"
              min={1}
              max={3600}
              step={1}
              value={
                value.timeoutMs !== undefined
                  ? value.timeoutMs / 1000
                  : value.kind === "openai" &&
                      /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?=[:/]|$)/.test(
                        value.baseUrl,
                      )
                    ? 300
                    : 60
              }
              onChange={(event) =>
                onChange({
                  ...value,
                  timeoutMs: Number(event.target.value) * 1000,
                })
              }
            />
            <span className="small muted">
              Per commentary request, including model loading, prompt processing
              and generation.
            </span>
          </label>
          {value.kind === "gemini" && (
            <div className="stack">
              <label>
                Thinking budget (tokens)
                <input
                  type="number"
                  min={0}
                  max={1000000}
                  step={1}
                  value={value.thinkingBudget ?? 0}
                  disabled={value.thinkingBudget === null}
                  onChange={(event) =>
                    onChange({
                      ...value,
                      thinkingBudget: Number(event.target.value),
                    })
                  }
                />
                <span className="small muted">
                  Research default: 0. This requests thinking off where
                  supported. A positive value sets a thinking-token budget;
                  model limits apply.
                </span>
              </label>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={value.thinkingBudget === null}
                  onChange={(event) =>
                    onChange({
                      ...value,
                      thinkingBudget: event.target.checked ? null : 0,
                    })
                  }
                />
                <span>Use provider default instead</span>
              </label>
            </div>
          )}
          {value.kind === "openai" && (
            <label>
              Thinking
              <select
                value={value.reasoningEffort ?? ""}
                onChange={(event) =>
                  onChange({
                    ...value,
                    reasoningEffort: (event.target.value ||
                      undefined) as Provider["reasoningEffort"],
                  })
                }
              >
                <option value="">Provider default</option>
                <option value="none">Off · direct commentary</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
          )}
        </>
      )}
    </>
  );
}
function Workbench({
  api,
  session,
  settingsOpen,
  onBack,
  onSettings,
}: {
  api: Client;
  session: Session;
  settingsOpen: boolean;
  onBack: () => void;
  onSettings: () => void;
}) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Dataset | null>(null),
    [runId, setRunId] = useState(""),
    [realizationId, setRealizationId] = useState("");
  const [corpus, setCorpus] = useState("may2026"),
    [resolution, setResolution] = useState<"1000" | "60000">("1000"),
    [filter, setFilter] = useState("");
  const [minMinutes, setMinMinutes] = useState("");
  const [maxMinutes, setMaxMinutes] = useState("");
  const [downloadSize, setDownloadSize] = useState("");
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [page, setPage] = useState(0);
  const [explorerPosition, setExplorerPosition] = useState<{
    timeMs: number;
    sequence: number;
  } | null>(null);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [downloadsOpen, setDownloadsOpen] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [lastDeleted, setLastDeleted] = useState("");
  const [purgeTarget, setPurgeTarget] = useState<RunSummary | "all" | null>(
    null,
  );
  const [purgeNotice, setPurgeNotice] = useState("");
  const modelSettings = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.settings.query(),
  });
  const { provider, fallback } = configuredModel(modelSettings.data);
  const {
    module,
    analysisIntervalMs: analysis,
    commentaryIntervalMs: commentary,
    debugEarlyHydration,
  } = modelSettings.data?.generation ?? defaultGenerationSettings;
  const runs = useQuery({
    queryKey: ["runs", showDeleted],
    queryFn: () => api.runs.query({ deleted: showDeleted }),
    refetchInterval: 2000,
  });
  const activeRuns = useQuery({
    queryKey: ["active-runs"],
    queryFn: ({ signal }) => api.activeRuns.query(undefined, { signal }),
    refetchInterval: 1000,
    refetchIntervalInBackground: true,
  });
  const trashCount = useQuery({
    queryKey: ["trash-count"],
    queryFn: () => api.trashCount.query(),
    enabled: showDeleted,
    refetchInterval: showDeleted ? 2000 : false,
  });
  const datasetQueryKey = [
    "datasets",
    corpus,
    resolution,
    filter,
    minMinutes,
    maxMinutes,
    downloadSize,
  ];
  const datasets = useInfiniteQuery({
    queryKey: datasetQueryKey,
    enabled: corpus !== "register",
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      api.datasets.query(
        {
          corpus,
          resolution,
          filter,
          offset: pageParam,
          limit: 20,
          ...(minMinutes ? { minDurationMs: Number(minMinutes) * 60000 } : {}),
          ...(maxMinutes ? { maxDurationMs: Number(maxMinutes) * 60000 } : {}),
          ...(downloadSize === "over1024"
            ? { minDownloadBytes: 1024 * 1024 * 1024 }
            : downloadSize
              ? { maxDownloadBytes: Number(downloadSize) * 1024 * 1024 }
              : {}),
        },
        { signal },
      ),
    getNextPageParam: (lastPage, _pages, lastOffset) => {
      const nextOffset = lastOffset + lastPage.datasets.length;
      return lastPage.datasets.length && nextOffset < lastPage.total
        ? nextOffset
        : undefined;
    },
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
  const datasetItems = useMemo(
    () => [
      ...new Map(
        datasets.data?.pages
          .flatMap((result) => result.datasets)
          .map((item) => [item.id, item]) ?? [],
      ).values(),
    ],
    [datasets.data],
  );
  const loadMoreDatasets = useCallback(() => {
    void datasets.fetchNextPage({ cancelRefetch: false });
  }, [datasets.fetchNextPage]);
  const run = useQuery({
    queryKey: ["run", runId],
    queryFn: () => api.run.query({ id: runId }),
    enabled: !!runId,
    refetchInterval: (query) => (active(query.state.data) ? 1000 : false),
  });
  const displayedPage = page;
  const loadCommentaryPage = useCallback(
    (offset: number, signal: AbortSignal) =>
      api.realizations.query({ id: runId, offset, limit: 50 }, { signal }),
    [api, runId],
  );
  const realizations = useQuery({
    queryKey: ["realizations", runId, displayedPage],
    queryFn: () =>
      api.realizations.query({
        id: runId,
        offset: displayedPage * 50,
        limit: 50,
      }),
    enabled: !!runId && diagnosticsOpen,
    refetchInterval: active(run.data) && diagnosticsOpen ? 1500 : false,
  });
  const trace = useQuery({
    queryKey: ["trace", runId, realizationId],
    queryFn: () => api.trace.query({ id: runId, realizationId }),
    enabled: !!runId && !!realizationId && diagnosticsOpen,
    refetchInterval: active(run.data) ? 1500 : false,
  });
  const events = useEvents(session, runId, () => {
    void qc.invalidateQueries({ queryKey: ["run", runId] });
    void qc.invalidateQueries({ queryKey: ["realizations", runId] });
    void qc.invalidateQueries({ queryKey: ["datasets"] });
  });
  function chooseRun(id: string) {
    setExplorerPosition(null);
    setRunId(id);
    setRealizationId("");
    setPage(0);
    setDiagnosticsOpen(false);
  }
  async function action(fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      await qc.invalidateQueries();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }
  const apiError =
    error ||
    datasets.error?.message ||
    modelSettings.error?.message ||
    runs.error?.message ||
    trashCount.error?.message ||
    run.error?.message ||
    realizations.error?.message ||
    trace.error?.message;
  const progressDock = (
    <RunProgress
      runs={activeRuns.data ?? []}
      loading={activeRuns.isPending}
      unavailable={activeRuns.isError}
      busy={busy}
      onOpen={(id) => {
        chooseRun(id);
        onBack();
      }}
      onStop={(id) => void action(() => api.cancel.mutate({ id }))}
    />
  );
  if (settingsOpen)
    return (
      <main className="settings-view">
        {downloadsOpen ? (
          <DownloadManager api={api} onBack={() => setDownloadsOpen(false)} />
        ) : (
          <>
            <h1>Settings</h1>
            <Settings
              api={api}
              action={action}
              busy={busy}
              desktop={Boolean(session.desktop)}
              onManageDownloads={() => setDownloadsOpen(true)}
            />
          </>
        )}
        <Button className="secondary" onClick={onBack}>
          ← Back to commentary
        </Button>
        {apiError && (
          <p className="error" role="alert">
            {apiError}
          </p>
        )}
        {progressDock}
      </main>
    );
  return (
    <main>
      <div className="intro">
        <div>
          <h1>Generate AoE II match commentary</h1>
          <p>
            Choose a dataset, generate commentary, and inspect the data and
            decisions behind each section.
          </p>
        </div>
        <Badge>DuckDB · Local execution</Badge>
      </div>
      {apiError && (
        <div className="error settings" role="alert">
          {apiError}
          {session.desktop && (runs.isError || datasets.isError) && (
            <Button
              className="secondary"
              onClick={() => window.location.reload()}
            >
              Restart local service
            </Button>
          )}
        </div>
      )}
      <div className="workspace">
        <section className="dataset-browser" aria-label="Dataset browser">
          <Panel
            title="Datasets"
            aside={
              corpus === "register" ? undefined : (
                <Badge>{datasets.data?.pages[0]?.total ?? "…"}</Badge>
              )
            }
          >
            <div className="panel-body dataset-filters">
              <label>
                Source
                <select
                  value={corpus}
                  onChange={(e) => {
                    setCorpus(e.target.value);
                    setSelected(null);
                  }}
                >
                  <option value="local">On this computer</option>
                  <option value="register">Open an existing dataset…</option>
                  <option value="kotd4">Hugging Face · KotD4</option>
                  <option value="may2026">Hugging Face · May 2026</option>
                  <option value="sample-unzipped">Hugging Face · Sample</option>
                </select>
              </label>
              {corpus !== "local" && corpus !== "register" && (
                <label>
                  Snapshot resolution
                  <select
                    value={resolution}
                    onChange={(e) => {
                      setResolution(e.target.value as "1000" | "60000");
                    }}
                  >
                    <option value="1000">1 second</option>
                    <option value="60000">60 seconds</option>
                  </select>
                </label>
              )}
              {corpus !== "register" && (
                <>
                  <label>
                    Find a match
                    <input
                      type="search"
                      value={filter}
                      onChange={(e) => {
                        setFilter(e.target.value);
                      }}
                      placeholder="Player, match, map or civilization"
                    />
                  </label>
                  <details className="small">
                    <summary>Filter by size and length</summary>
                    <div className="stack filter-fields">
                      <div className="two">
                        <label>
                          Minimum length (GT minutes)
                          <input
                            type="number"
                            min={0}
                            value={minMinutes}
                            onChange={(event) => {
                              setMinMinutes(event.target.value);
                            }}
                          />
                        </label>
                        <label>
                          Maximum length (GT minutes)
                          <input
                            type="number"
                            min={0}
                            value={maxMinutes}
                            onChange={(event) => {
                              setMaxMinutes(event.target.value);
                            }}
                          />
                        </label>
                      </div>
                      <label>
                        Download size (compressed)
                        <select
                          value={downloadSize}
                          onChange={(event) => {
                            setDownloadSize(event.target.value);
                          }}
                        >
                          <option value="">Any size</option>
                          <option value="100">Up to 100 MiB</option>
                          <option value="500">Up to 500 MiB</option>
                          <option value="1024">Up to 1 GiB</option>
                          <option value="over1024">1 GiB or more</option>
                        </select>
                      </label>
                      <p className="muted">
                        Filters use available metadata. Matches with missing
                        values are excluded when that filter is active.
                      </p>
                      <Button
                        type="button"
                        className="secondary"
                        onClick={() => {
                          setMinMinutes("");
                          setMaxMinutes("");
                          setDownloadSize("");
                        }}
                      >
                        Clear size and length filters
                      </Button>
                    </div>
                  </details>
                </>
              )}
            </div>
            {corpus === "register" ? (
              <Register
                api={api}
                action={action}
                desktop={Boolean(session.desktop)}
                onRegistered={(dataset) => {
                  setCorpus("local");
                  setSelected(dataset);
                }}
              />
            ) : (
              <DatasetResults
                key={JSON.stringify(datasetQueryKey)}
                hasMore={Boolean(datasets.hasNextPage)}
                fetching={datasets.isFetching}
                error={datasets.error?.message}
                onMore={loadMoreDatasets}
                onRetry={() => {
                  void (datasets.isFetchNextPageError
                    ? datasets.fetchNextPage({ cancelRefetch: false })
                    : datasets.refetch());
                }}
              >
                {datasets.isPending ? (
                  <div className="empty">Loading dataset index…</div>
                ) : (
                  datasetItems.map((dataset) => (
                    <button
                      key={dataset.id}
                      className={`list-item ${selected?.id === dataset.id ? "active" : ""}`}
                      onClick={() => setSelected(dataset)}
                    >
                      <strong>{dataset.name}</strong>
                      {dataset.metadata && (
                        <>
                          <span className="row small">
                            <Badge>
                              {dataset.metadata.mapName ?? "Map not recorded"}
                            </Badge>
                            {dataset.metadata.durationMs != null && (
                              <Badge>
                                <GameTime
                                  milliseconds={dataset.metadata.durationMs}
                                />
                              </Badge>
                            )}
                            {dataset.metadata.isRanked != null && (
                              <Badge>
                                {dataset.metadata.isRanked
                                  ? "Ranked"
                                  : "Unranked"}
                              </Badge>
                            )}
                            {dataset.metadata.split && (
                              <Badge>{dataset.metadata.split}</Badge>
                            )}
                          </span>
                          <span className="small muted">
                            {dataset.metadata.players
                              .map(
                                (player) =>
                                  `${player.name} · ${player.civName ?? "Civ not recorded"} · Elo ${player.elo ?? "not recorded"}`,
                              )
                              .join(" vs ")}
                          </span>
                        </>
                      )}
                      {!dataset.metadata && dataset.source.kind === "hf" && (
                        <span className="small muted">
                          Index metadata unavailable
                        </span>
                      )}
                      <span className="muted small">
                        {Number(dataset.resolution) / 1000}s snapshots ·{" "}
                        {dataset.cached
                          ? "On this machine"
                          : "Download required"}
                        {dataset.space?.downloadBytes !== undefined &&
                          !dataset.cached && (
                            <>
                              {" "}
                              · {formatBytes(dataset.space.downloadBytes)}{" "}
                              compressed download
                            </>
                          )}
                        {dataset.space?.additionalDiskBytes !== undefined &&
                          !dataset.cached && (
                            <>
                              {" "}
                              · {formatBytes(
                                dataset.space.additionalDiskBytes,
                              )}{" "}
                              stored files (compressed)
                            </>
                          )}
                        {!dataset.cached &&
                          dataset.space?.diskBytes === undefined && (
                            <> · stored-file size unavailable</>
                          )}
                      </span>
                    </button>
                  ))
                )}
                {datasets.data?.pages[0]?.total === 0 && (
                  <div className="empty">No matches in this selection.</div>
                )}
              </DatasetResults>
            )}
            {corpus !== "register" && datasets.data && (
              <p className="panel-body small muted" role="status">
                Showing {datasetItems.length} of{" "}
                {datasets.data.pages[0]?.total ?? 0} matches
              </p>
            )}
            {corpus !== "register" && (
              <p className="panel-body small muted">
                Download sizes are compressed (Arrow or Parquet). Decoded tables
                need more space; allow extra memory and temporary disk space for
                processing. GT = Game Time and RT = Real Time. The game runs at
                roughly 1.69× real time, so RT is estimated as GT ÷ 1.69.
              </p>
            )}
          </Panel>
        </section>
        <aside className="sidebar saved-runs" aria-label="Saved runs">
          <Panel
            title={showDeleted ? "Deleted runs" : "Saved runs"}
            aside={
              <div className="row">
                <Badge>
                  {showDeleted
                    ? (trashCount.data ?? "…")
                    : (runs.data?.length ?? 0)}
                </Badge>
                {showDeleted && (
                  <Button
                    className="danger compact"
                    disabled={busy || !trashCount.data}
                    onClick={() => {
                      setError("");
                      setPurgeTarget("all");
                    }}
                  >
                    Clear all
                  </Button>
                )}
                <Button
                  className="secondary compact"
                  onClick={() => {
                    setShowDeleted(!showDeleted);
                    setPurgeNotice("");
                  }}
                >
                  {showDeleted ? "Saved runs" : "Trash"}
                </Button>
              </div>
            }
          >
            {purgeNotice && (
              <p className="notice small" role="status">
                {purgeNotice}
              </p>
            )}
            {lastDeleted && !showDeleted && (
              <div className="notice small run-undo" role="status">
                Run moved to Trash.
                <Button
                  className="secondary compact"
                  disabled={busy}
                  onClick={() =>
                    void action(async () => {
                      await api.restoreRun.mutate({ id: lastDeleted });
                      setLastDeleted("");
                    })
                  }
                >
                  Undo
                </Button>
              </div>
            )}
            <div className="list">
              {runs.data?.map((value) => (
                <div
                  className={`saved-run-row ${runId === value.id ? "active" : ""}`}
                  key={value.id}
                  role="group"
                  aria-label={`${value.sourceName} · ${new Date(value.createdAt).toLocaleString()}`}
                >
                  <button
                    className="list-item"
                    disabled={showDeleted}
                    onClick={() => chooseRun(value.id)}
                  >
                    <strong>
                      {value.pinned && <span aria-label="Pinned">★ </span>}
                      {value.sourceName}
                    </strong>
                    <span className="small muted">
                      {value.status} ·{" "}
                      {value.request.provider.model ||
                        value.request.provider.kind}
                    </span>
                    <span className="small muted">
                      {new Date(value.createdAt).toLocaleString()}
                    </span>
                  </button>
                  <div className="run-actions">
                    {showDeleted ? (
                      <>
                        <Button
                          className="secondary compact"
                          disabled={busy}
                          onClick={() =>
                            void action(async () => {
                              await api.restoreRun.mutate({ id: value.id });
                              if (lastDeleted === value.id) setLastDeleted("");
                            })
                          }
                        >
                          Restore
                        </Button>
                        <Button
                          className="danger compact"
                          disabled={busy}
                          onClick={() => {
                            setError("");
                            setPurgeTarget(value);
                          }}
                        >
                          Delete permanently
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          className="secondary compact"
                          aria-pressed={Boolean(value.pinned)}
                          disabled={busy}
                          onClick={() =>
                            void action(() =>
                              api.setPinned.mutate({
                                id: value.id,
                                pinned: !value.pinned,
                              }),
                            )
                          }
                        >
                          {value.pinned ? "Unpin" : "Pin"}
                        </Button>
                        <Button
                          className="secondary compact"
                          disabled={busy || Boolean(active(value))}
                          title={
                            active(value)
                              ? "Stop the run before deleting it"
                              : "Move this saved run to Trash"
                          }
                          onClick={() =>
                            void action(async () => {
                              await api.deleteRun.mutate({ id: value.id });
                              setLastDeleted(value.id);
                              if (runId === value.id) chooseRun("");
                            })
                          }
                        >
                          Delete
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {!runs.data?.length && (
                <div className="empty">
                  {showDeleted
                    ? "Trash is empty."
                    : "Your runs will appear here."}
                </div>
              )}
            </div>
          </Panel>
        </aside>
        <div className="main-column">
          <Panel
            title="Selected match"
            aside={
              <Badge>
                {selected
                  ? `${Number(selected.resolution) / 1000}s source`
                  : "Choose a dataset"}
              </Badge>
            }
          >
            <form
              className="panel-body stack"
              onSubmit={(e) => {
                e.preventDefault();
                if (selected)
                  void action(async () => {
                    const result = await api.start.mutate({
                      source: selected.source,
                      module,
                      provider,
                      analysisIntervalMs: analysis,
                      commentaryIntervalMs: commentary,
                      debugEarlyHydration,
                      operation: "generate",
                    });
                    chooseRun(result.id);
                  });
              }}
            >
              <p className="small muted">
                {selected?.name ??
                  "Choose a local fixture or a Hugging Face match from the dataset list."}
              </p>
              {selected?.metadata && (
                <details>
                  <summary className="small">
                    Match metadata from corpus index
                  </summary>
                  <Json value={selected.metadata} />
                </details>
              )}
              {selected?.space && (
                <p className="small muted">
                  {formatBytes(
                    selected.space.additionalDiskBytes ??
                      selected.space.diskBytes,
                  )}{" "}
                  additional storage for downloaded files, including the ZIP and
                  extracted Parquet files where applicable. Parquet is still
                  compressed. Decoded tables, working memory and DuckDB
                  temporary files need extra space.
                </p>
              )}
              {modelSettings.isSuccess && fallback ? (
                <div className="notice model-fallback" role="status">
                  <p>
                    Falling back to offline templates because no usable model is
                    configured.
                  </p>
                  <Button
                    type="button"
                    className="secondary"
                    onClick={onSettings}
                  >
                    Set up a model
                  </Button>
                </div>
              ) : (
                <p className="small muted">
                  {modelSettings.isPending
                    ? "Loading model settings…"
                    : `Using ${provider.model || "offline templates"}`}
                </p>
              )}
              <div className="row">
                <Button
                  disabled={!selected || busy || !modelSettings.isSuccess}
                >
                  Generate commentary
                </Button>
                <Button
                  type="button"
                  className="secondary"
                  disabled={!selected || busy}
                  onClick={() => {
                    if (!selected) return;
                    if (
                      run.data?.descriptorPath &&
                      JSON.stringify(run.data.request.source) ===
                        JSON.stringify(selected.source)
                    ) {
                      setExplorerPosition({ timeMs: 0, sequence: Date.now() });
                      return;
                    }
                    void action(async () => {
                      const result = await api.start.mutate({
                        source: selected.source,
                        operation: "download",
                        provider: emptyProvider,
                        module: "base",
                      });
                      chooseRun(result.id);
                      setExplorerPosition({ timeMs: 0, sequence: Date.now() });
                    });
                  }}
                >
                  {selected?.cached ? "Explore match" : "Download and explore"}
                </Button>
                {selected?.source.kind === "hf" && (
                  <Button
                    type="button"
                    className="secondary"
                    disabled={busy}
                    onClick={() =>
                      void action(async () => {
                        const result = await api.start.mutate({
                          source: selected.source,
                          module,
                          provider: emptyProvider,
                          analysisIntervalMs: analysis,
                          commentaryIntervalMs: commentary,
                          debugEarlyHydration,
                          operation: "download",
                        });
                        chooseRun(result.id);
                      })
                    }
                  >
                    Download only
                  </Button>
                )}
                <span className="small muted">
                  Source resolution and analysis interval are independent.
                </span>
              </div>
            </form>
          </Panel>
          {explorerPosition && run.data && (
            <MatchExplorer
              key={runId}
              api={api}
              run={run.data}
              position={explorerPosition}
              onClose={() => setExplorerPosition(null)}
            />
          )}
          <Panel
            title="Commentary"
            aside={
              run.data ? (
                <div className="row">
                  <Badge>{run.data.status}</Badge>
                  <Button
                    className="secondary"
                    onClick={() =>
                      setExplorerPosition({ timeMs: 0, sequence: Date.now() })
                    }
                  >
                    Explore match
                  </Button>
                </div>
              ) : undefined
            }
          >
            {run.data ? (
              <>
                <CommentaryFeed
                  key={runId}
                  run={run.data}
                  loadPage={loadCommentaryPage}
                  onInspect={(timeMs) =>
                    setExplorerPosition({ timeMs, sequence: Date.now() })
                  }
                  busy={busy}
                  onStop={() =>
                    void action(() => api.cancel.mutate({ id: runId }))
                  }
                />
                <details
                  className="run-diagnostics"
                  open={diagnosticsOpen}
                  onToggle={(event) =>
                    setDiagnosticsOpen(event.currentTarget.open)
                  }
                >
                  <summary>Pipeline inspector and statistics</summary>
                  <div className="panel-body row">
                    <Button
                      className="secondary"
                      disabled={!page}
                      onClick={() => {
                        setPage(page - 1);
                        setRealizationId("");
                      }}
                    >
                      Previous
                    </Button>
                    <Badge>Inspector page {page + 1}</Badge>
                    <Button
                      className="secondary"
                      disabled={(realizations.data?.length ?? 0) < 50}
                      onClick={() => {
                        setPage(page + 1);
                        setRealizationId("");
                      }}
                    >
                      Next
                    </Button>
                  </div>
                  <div className="toolbar">
                    <div className="row">
                      <div className="metric">
                        <strong>{realizations.data?.length ?? 0}</strong>
                        <span>This page</span>
                      </div>
                      <div className="metric">
                        <strong>
                          {run.data.metrics?.elapsedMs
                            ? `${(Number(run.data.metrics.elapsedMs) / 1000).toFixed(1)}s`
                            : "—"}
                        </strong>
                        <span title="Measured wall-clock time spent generating this run.">
                          Processing time
                        </span>
                      </div>
                      <div className="metric">
                        <strong>
                          {run.data.metrics?.maxRssBytes
                            ? `${Math.round(Number(run.data.metrics.maxRssBytes) / 1048576)} MB`
                            : "—"}
                        </strong>
                        <span>Peak memory</span>
                      </div>
                    </div>
                  </div>
                  <div className="panel-body small stack">
                    <strong>{run.data.sourceName}</strong>
                    {run.data.phase && <Badge>{run.data.phase}</Badge>}
                    {run.data.comparison && (
                      <div className="notice stack">
                        <strong>Comparison · same prepared prompt</strong>
                        <p>Original: {run.data.comparison.originalText}</p>
                        <div>
                          <Button
                            className="secondary"
                            disabled={
                              !runs.data?.some(
                                (item) =>
                                  item.id === run.data?.comparison?.runId,
                              )
                            }
                            onClick={() =>
                              chooseRun(run.data!.comparison!.runId)
                            }
                          >
                            Open original run
                          </Button>
                        </div>
                      </div>
                    )}
                    <div className="row muted">
                      <span>{run.data.request.module}</span>
                      <span>·</span>
                      <span>
                        {run.data.request.provider.model || "Templates"}
                      </span>
                      <span>·</span>
                      <span>
                        {run.data.request.analysisIntervalMs / 1000}s analysis ·{" "}
                        {run.data.request.debugEarlyHydration
                          ? "early hydration (debug)"
                          : "hydration at realization"}
                      </span>
                    </div>
                    {run.data.error && (
                      <div className="error" role="alert">
                        {run.data.error}
                      </div>
                    )}
                    {events.length > 0 && (
                      <details>
                        <summary>Run activity · {events.at(-1)?.kind}</summary>
                        <Json value={events.slice(-5)} />
                      </details>
                    )}
                  </div>
                  <div className="timeline-layout">
                    <div className="timeline">
                      {realizations.data?.map((value) => (
                        <button
                          className={`comment ${realizationId === value.id ? "active" : ""}`}
                          key={value.id}
                          onClick={() => setRealizationId(value.id)}
                        >
                          <span className="row">
                            <Badge>
                              <GameTime milliseconds={value.gameTimeMs} />
                            </Badge>
                            <span className="small muted">
                              {value.template}
                            </span>
                          </span>
                          <p>
                            {value.text ||
                              (value.decision === "skipped"
                                ? "Skipped by commentary interval"
                                : value.decision === "failed"
                                  ? "Realization failed · inspect error"
                                  : value.deferred
                                    ? "Deferred for later realization"
                                    : "No commentary at this step")}
                          </p>
                          <span className="small muted">
                            {value.realizeMs.toFixed(1)} ms realization
                          </span>
                        </button>
                      ))}
                      {!realizations.data?.length && (
                        <div className="empty">
                          {active(run.data)
                            ? "Processing locally. Realizations appear as they complete."
                            : "No commentary was generated for this run."}
                        </div>
                      )}
                    </div>
                    <div className="inspector">
                      {realizationId ? (
                        <TraceViewer
                          api={api}
                          run={run.data}
                          realizationId={realizationId}
                          steps={trace.data ?? []}
                          provider={provider}
                          action={action}
                          onComparison={chooseRun}
                        />
                      ) : (
                        <div className="empty">
                          <h3>Select a realization</h3>
                          <p>
                            Inspect its source facts, analysis, planning,
                            prompt, response, and timings.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="panel-body small muted">
                    Run {run.data.id}
                    <details>
                      <summary>Reproducibility metadata</summary>
                      <Json
                        value={{
                          codeVersion: run.data.codeVersion,
                          datasetRevision: run.data.datasetRevision,
                          descriptorPath: run.data.descriptorPath,
                          request: run.data.request,
                          metrics: run.data.metrics,
                        }}
                      />
                    </details>
                  </div>
                  <Preview api={api} runId={runId} />
                </details>
              </>
            ) : (
              <div className="empty">
                <h3>No run selected</h3>
                <p>
                  Generate commentary or open a saved run to inspect its
                  results.
                </p>
              </div>
            )}
          </Panel>
        </div>
      </div>
      {progressDock}
      {purgeTarget && (
        <DestructiveConfirmation
          title={
            purgeTarget === "all"
              ? "Clear all runs from Trash?"
              : "Permanently delete this run?"
          }
          description={
            purgeTarget === "all"
              ? `All ${trashCount.data ?? 0} runs currently in Trash, including their saved commentary and inspection data, will be permanently deleted.`
              : `“${purgeTarget.sourceName}” and its saved commentary and inspection data will be permanently deleted.`
          }
          busy={busy}
          error={error}
          onCancel={() => setPurgeTarget(null)}
          onConfirm={() =>
            void action(async () => {
              if (purgeTarget === "all") {
                const result = await api.clearTrash.mutate();
                setLastDeleted("");
                setPurgeNotice(
                  `Permanently deleted ${result.deleted} ${result.deleted === 1 ? "run" : "runs"}.${result.failed ? ` ${result.failed} could not be deleted; try again.` : ""}`,
                );
              } else {
                await api.purgeRun.mutate({ id: purgeTarget.id });
                if (lastDeleted === purgeTarget.id) setLastDeleted("");
                setPurgeNotice("Run permanently deleted.");
              }
              setPurgeTarget(null);
            })
          }
        />
      )}
    </main>
  );
}
function Register({
  api,
  action,
  desktop,
  onRegistered,
}: {
  api: Client;
  action: (fn: () => Promise<unknown>) => Promise<void>;
  desktop: boolean;
  onRegistered: (dataset: Dataset) => void;
}) {
  const [file, setFile] = useState("");
  return (
    <div className="panel-body stack">
      <h3>Open a dataset on this computer</h3>
      <p className="small muted">
        Choose the dataset's descriptor.json file. Large tables stay on disk.
      </p>
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          void action(async () =>
            onRegistered(await api.register.mutate({ descriptorPath: file })),
          );
        }}
      >
        <label>
          Dataset descriptor
          <input
            value={file}
            readOnly={desktop}
            onChange={(event) => setFile(event.target.value)}
            placeholder="descriptor.json"
            required
          />
        </label>
        {desktop && (
          <Button
            type="button"
            className="secondary"
            onClick={() =>
              void action(async () => {
                const path = await openDialog({
                  multiple: false,
                  directory: false,
                  filters: [
                    { name: "Dataset descriptor", extensions: ["json"] },
                  ],
                });
                if (typeof path === "string") setFile(path);
              })
            }
          >
            Choose descriptor…
          </Button>
        )}
        <Button disabled={!file}>Open dataset</Button>
      </form>
    </div>
  );
}
function GenerationFields({
  value,
  onChange,
}: {
  value: GenerationSettings;
  onChange: (value: GenerationSettings) => void;
}) {
  const {
    module,
    analysisIntervalMs: analysis,
    commentaryIntervalMs: commentary,
    debugEarlyHydration,
  } = value;
  const setModule = (module: GenerationSettings["module"]) =>
    onChange({ ...value, module });
  const setAnalysis = (analysisIntervalMs: number) =>
    onChange({ ...value, analysisIntervalMs });
  const setCommentary = (commentaryIntervalMs: number) =>
    onChange({ ...value, commentaryIntervalMs });
  const setDebugEarlyHydration = (debugEarlyHydration: boolean) =>
    onChange({ ...value, debugEarlyHydration });
  return (
    <>
      {" "}
      <div className="controls">
        <label>
          Analysis module
          <select
            value={module}
            onChange={(e) => setModule(e.target.value as typeof module)}
          >
            <option value="base">Base</option>
            <option value="eventStructuring">Event structuring</option>
            <option value="expertInsights">Expert insights</option>
            <option value="all">All modules</option>
          </select>
        </label>
        <div className="field">
          <div className="field-label">
            <label htmlFor="analysis-interval">
              Analysis tick interval (ms)
            </label>
            <details
              className="field-help"
              onKeyDown={(event) => {
                if (event.key === "Escape") event.currentTarget.open = false;
              }}
            >
              <summary aria-label="About analysis ticks">i</summary>
              <p id="analysis-tick-help">
                Spacing of the synthetic ticks added to the event stream for
                periodic analysis, such as strategy detection. 60000 means one
                tick per minute of game time. Snapshot resolution stays
                unchanged, and game events are processed between ticks.
                Commentary is generated when planning selects it, rather than at
                every tick.
              </p>
            </details>
          </div>
          <input
            id="analysis-interval"
            aria-describedby="analysis-tick-help"
            type="number"
            min={1000}
            max={3600000}
            step={1000}
            value={analysis}
            onChange={(e) => setAnalysis(Number(e.target.value))}
          />
        </div>
        <label>
          Minimum commentary interval (GT ms)
          <input
            type="number"
            min={0}
            max={3600000}
            step={1000}
            value={commentary}
            onChange={(e) => setCommentary(Number(e.target.value))}
          />
          <span className="small muted">
            Minimum gap between commentaries in game time. 0 adds no spacing
            restriction; 60000 means one GT minute (about 35.5 RT seconds). This
            skips closely spaced commentary, independently of analysis ticks.
          </span>
        </label>
      </div>
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={debugEarlyHydration}
          onChange={(event) => setDebugEarlyHydration(event.target.checked)}
        />
        <span>
          <strong>Debug IDs</strong>
          <span className="small muted">
            Replace IDs with names earlier in the JSON. Otherwise names are
            added at realization.
          </span>
        </span>
      </label>
    </>
  );
}
function Settings({
  api,
  action,
  busy,
  desktop,
  onManageDownloads,
}: {
  api: Client;
  action: (fn: () => Promise<unknown>) => Promise<void>;
  busy: boolean;
  desktop: boolean;
  onManageDownloads: () => void;
}) {
  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.settings.query(),
  });
  const [generation, setGeneration] = useState<GenerationSettings | null>(null);
  const [directory, setDirectory] = useState<string | null>(null);
  const [hfToken, setHfToken] = useState("");
  const [tokenStatus, setTokenStatus] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [provider, setProvider] = useState<Provider>({
    ...emptyProvider,
    kind: "openai",
  });
  const [providerInitialized, setProviderInitialized] = useState(false);
  useEffect(() => {
    if (settings.data && !providerInitialized) {
      const kind =
        settings.data.preferredProvider ??
        (["openai", "gemini", "anthropic"] as const).find((candidate) =>
          settings.data?.providers[candidate]?.model.trim(),
        ) ??
        "openai";
      const saved = settings.data.providers[kind];
      setProvider((value) => ({
        ...value,
        kind,
        model: saved?.model ?? "",
        baseUrl: saved?.baseUrl ?? "",
        reasoningEffort: saved?.reasoningEffort,
        thinkingBudget: saved?.thinkingBudget,
        timeoutMs: saved?.timeoutMs,
      }));
      setProviderInitialized(true);
    }
  }, [settings.data, providerInitialized]);
  const validate = async () => {
    const result = await api.validateHfToken.mutate({
      ...(hfToken ? { token: hfToken.trim() } : {}),
    });
    setTokenStatus(result.message);
    return result;
  };
  return (
    <div className="stack">
      <Panel title="Appearance">
        <ThemeSetting />
      </Panel>
      <Panel title="Analysis and commentary">
        <form
          className="panel-body stack"
          onSubmit={(event) => {
            event.preventDefault();
            void action(() =>
              api.updateSettings.mutate({
                generation:
                  generation ??
                  settings.data?.generation ??
                  defaultGenerationSettings,
              }),
            );
          }}
        >
          <GenerationFields
            value={
              generation ??
              settings.data?.generation ??
              defaultGenerationSettings
            }
            onChange={setGeneration}
          />
          <div>
            <Button disabled={busy}>Save analysis settings</Button>
          </div>
        </form>
      </Panel>
      <Panel title="Downloaded data">
        <div className="panel-body stack">
          <div>
            <Button className="secondary" onClick={onManageDownloads}>
              Manage downloaded datasets
            </Button>
          </div>
          <label>
            Data/cache directory
            <input
              value={directory ?? settings.data?.dataDirectory ?? ""}
              readOnly={desktop}
              onChange={(event) => setDirectory(event.target.value)}
            />
          </label>
          {desktop ? (
            <Button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() =>
                void action(async () => {
                  const path = await openDialog({
                    directory: true,
                    multiple: false,
                    defaultPath: directory || settings.data?.dataDirectory,
                    title: "Choose the SAGE data folder",
                  });
                  if (typeof path === "string") setDirectory(path);
                })
              }
            >
              Choose folder…
            </Button>
          ) : (
            <p className="small muted">
              The SAGE desktop app provides a native folder picker. In this
              developer browser view, enter a path on the service's computer.
            </p>
          )}
          <p className="small muted">
            Changing this folder changes where future downloads are stored.
            Existing files are not moved.
          </p>
          <Button
            disabled={busy || !directory}
            onClick={() =>
              void action(() =>
                api.updateSettings.mutate({ dataDirectory: directory! }),
              )
            }
          >
            Save data folder
          </Button>
        </div>
      </Panel>
      <Panel title="Hugging Face">
        <div className="panel-body stack">
          <p className="small muted">
            Public downloads work without a token. Your token is stored locally
            and used directly with Hugging Face.
          </p>
          <label>
            Access token {settings.data?.hasHfToken ? "· configured" : ""}
            <input
              type="password"
              autoComplete="off"
              value={hfToken}
              onChange={(event) => {
                setHfToken(event.target.value);
                setTokenStatus("");
              }}
            />
          </label>
          <div className="row">
            <Button
              className="secondary"
              disabled={busy || (!hfToken && !settings.data?.hasHfToken)}
              onClick={() =>
                void action(async () => {
                  await validate();
                })
              }
            >
              Validate token
            </Button>
            <Button
              disabled={busy || !hfToken}
              onClick={() =>
                void action(async () => {
                  const result = await validate();
                  if (!result.valid) throw new Error(result.message);
                  await api.updateSettings.mutate({ hfToken: hfToken.trim() });
                  setHfToken("");
                })
              }
            >
              Save token
            </Button>
            <Button
              className="secondary"
              disabled={busy || !settings.data?.hasHfToken}
              onClick={() =>
                void action(async () => {
                  await api.updateSettings.mutate({ hfToken: "" });
                  setHfToken("");
                  setTokenStatus(
                    "Saved token cleared. Downloads will use anonymous access unless HF_TOKEN is set for the service.",
                  );
                })
              }
            >
              Clear saved token
            </Button>
          </div>
          {tokenStatus && <p role="status">{tokenStatus}</p>}
        </div>
      </Panel>
      <Panel title="Models">
        <div className="panel-body stack">
          <ProviderFields
            value={provider}
            onChange={(value) => {
              const saved = settings.data?.providers[value.kind];
              setProvider(
                value.kind === provider.kind
                  ? value
                  : {
                      ...value,
                      model: saved?.model ?? "",
                      baseUrl: saved?.baseUrl ?? "",
                      reasoningEffort: saved?.reasoningEffort,
                      thinkingBudget: saved?.thinkingBudget,
                      timeoutMs: saved?.timeoutMs,
                    },
              );
              setApiKey("");
            }}
          />
          {provider.kind !== "templates" && (
            <>
              <label>
                Provider API key{" "}
                {settings.data?.providers[provider.kind]?.hasApiKey
                  ? "· configured"
                  : ""}
                <input
                  type="password"
                  autoComplete="off"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                />
              </label>
              <p className="small muted">
                Keys are stored on this computer and cleared from this form
                after saving. Leave the key blank to keep the saved key.
              </p>
            </>
          )}
          <div className="row">
            <Button
              disabled={busy}
              onClick={() =>
                void action(async () => {
                  await api.updateSettings.mutate({
                    provider: { ...provider, ...(apiKey ? { apiKey } : {}) },
                  });
                  setApiKey("");
                })
              }
            >
              Save model settings
            </Button>
            <Button
              className="secondary"
              disabled={
                busy || !settings.data?.providers[provider.kind]?.hasApiKey
              }
              onClick={() =>
                void action(() =>
                  api.updateSettings.mutate({
                    provider: { ...provider, apiKey: "" },
                  }),
                )
              }
            >
              Clear saved key
            </Button>
          </div>
        </div>
      </Panel>
      {settings.error && <p className="error">{settings.error.message}</p>}
    </div>
  );
}
function TraceViewer({
  api,
  run,
  realizationId,
  steps,
  provider,
  action,
  onComparison,
}: {
  api: Client;
  run: RunSummary;
  realizationId: string;
  steps: TraceStep[];
  provider: Provider;
  action: (fn: () => Promise<unknown>) => Promise<void>;
  onComparison: (id: string) => void;
}) {
  const hasPrompt = steps.some((step) => step.stage === "prompt");
  return (
    <div className="stack">
      <div>
        <div className="eyebrow">{realizationId} · recorded execution</div>
        <h3>Follow the realization</h3>
      </div>
      {steps.map((step, i) => (
        <details
          key={`${step.stage}-${i}`}
          className="stage"
          open={step.stage === "realization"}
        >
          <summary>
            <span>{step.stage}</span>
            <span className="small muted">{step.elapsedMs.toFixed(1)} ms</span>
          </summary>
          <Json value={step.data} />
        </details>
      ))}
      <div className="notice small stack">
        <strong>Compare this prepared input</strong>
        <p>
          Replay with the model selected in Settings. The saved facts and
          previous commentary stay identical; analysis is reused.
        </p>
        <Button
          className="secondary"
          disabled={
            !hasPrompt || provider.kind === "templates" || !provider.model
          }
          onClick={() =>
            void action(async () => {
              const result = await api.rerun.mutate({
                id: run.id,
                realizationId,
                provider,
              });
              onComparison(result.id);
            })
          }
        >
          Re-realize with {provider.model || "selected model"}
        </Button>
        {!hasPrompt && (
          <p className="muted">
            This realization has no recorded model prompt. Comparison is
            available for model-generated realizations.
          </p>
        )}
      </div>
    </div>
  );
}
function Preview({ api, runId }: { api: Client; runId: string }) {
  const [table, setTable] = useState<
      | "players"
      | "entities"
      | "researchStates"
      | "events"
      | "world"
      | "mapCells"
    >("players"),
    [bin, setBin] = useState(0),
    [offset, setOffset] = useState(0),
    [enabled, setEnabled] = useState(false);
  const preview = useQuery({
    queryKey: ["preview", runId, table, bin, offset],
    queryFn: () =>
      api.preview.query({ id: runId, table, bin, offset, limit: 20 }),
    enabled,
    retry: false,
  });
  const rows = preview.data?.rows as Record<string, unknown>[] | undefined;
  const columns = rows?.length ? Object.keys(rows[0]!).slice(0, 12) : [];
  return (
    <details
      className="panel-body"
      onToggle={(e) => setEnabled(e.currentTarget.open)}
    >
      <summary>
        <strong>Source table preview</strong>{" "}
        <span className="small muted">· bounded, 20 rows per page</span>
      </summary>
      <div className="stack">
        <div className="row">
          <label>
            Table
            <select
              value={table}
              onChange={(e) => {
                setTable(e.target.value as typeof table);
                setOffset(0);
              }}
            >
              {[
                "players",
                "entities",
                "researchStates",
                "events",
                "world",
                "mapCells",
              ].map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
          <label>
            Snapshot bin
            <input
              type="number"
              min={0}
              value={bin}
              onChange={(e) => {
                setBin(Number(e.target.value));
                setOffset(0);
              }}
            />
          </label>
          <Badge>{preview.data?.total ?? "…"} rows in selection</Badge>
        </div>
        {preview.error && <p className="error">{preview.error.message}</p>}
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {columns.map((key) => (
                  <th key={key}>{key}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows?.map((row, i) => (
                <tr key={i}>
                  {columns.map((key) => (
                    <td key={key}>
                      {typeof row[key] === "object"
                        ? JSON.stringify(row[key])
                        : String(row[key] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="row">
          <Button
            className="secondary"
            disabled={!offset || preview.isFetching}
            onClick={() => setOffset(Math.max(0, offset - 20))}
          >
            Previous rows
          </Button>
          <Button
            className="secondary"
            disabled={
              offset + 20 >= (preview.data?.total ?? 0) || preview.isFetching
            }
            onClick={() => setOffset(offset + 20)}
          >
            Next rows
          </Button>
        </div>
      </div>
    </details>
  );
}
function useEvents(session: Session, runId: string, onFinished: () => void) {
  const [events, setEvents] = useState<RunEvent[]>([]);
  useEffect(() => {
    if (!runId) return;
    const controller = new AbortController();
    let cursor = 0;
    setEvents([]);
    async function stream() {
      while (!controller.signal.aborted) {
        try {
          const response = await localFetch(
            `${session.url}/events?id=${runId}&after=${cursor}`,
            {
              headers: { Authorization: `Bearer ${session.token}` },
              signal: controller.signal,
            },
          );
          if (!response.ok) throw new Error(`Event stream: ${response.status}`);
          const reader = response.body!.getReader();
          const decoder = new TextDecoder();
          let pending = "";
          while (!controller.signal.aborted) {
            const { done, value } = await reader.read();
            if (done) break;
            pending += decoder.decode(value, { stream: true });
            let newline: number;
            while ((newline = pending.indexOf("\n")) >= 0) {
              const line = pending.slice(0, newline);
              pending = pending.slice(newline + 1);
              if (!line.trim()) continue;
              const event = JSON.parse(line) as RunEvent;
              if (!event.sequence || event.sequence <= cursor) continue;
              cursor = event.sequence;
              setEvents((current) => [...current, event].slice(-30));
              if (["finished", "failed", "status"].includes(event.kind))
                onFinished();
            }
          }
        } catch (error) {
          if (controller.signal.aborted) return;
        }
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, 2000);
          controller.signal.addEventListener(
            "abort",
            () => {
              clearTimeout(timer);
              resolve();
            },
            { once: true },
          );
        });
      }
    }
    void stream();
    return () => controller.abort();
    // The callback only invalidates queries; changing its identity must not restart the cursor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, runId]);
  return events;
}
