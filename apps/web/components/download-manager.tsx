"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { createTRPCClient } from "@trpc/client";
import type { LocalRouter } from "@sage/contracts/router";
import type { DownloadedDataset } from "@sage/contracts";
import { Button, Panel } from "@sage/ui";
import { DestructiveConfirmation } from "./destructive-confirmation";

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  const unit = Math.min(3, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** unit).toFixed(1)} ${["B", "KiB", "MiB", "GiB"][unit]}`;
};

export function DownloadManager({
  api,
  onBack,
}: {
  api: ReturnType<typeof createTRPCClient<LocalRouter>>;
  onBack: () => void;
}) {
  const qc = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmation, setConfirmation] = useState<DownloadedDataset[] | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [failures, setFailures] = useState<string[]>([]);
  const downloads = useQuery({
    queryKey: ["downloaded-datasets"],
    queryFn: () => api.downloadedDatasets.query(),
    refetchInterval: busy ? false : 5000,
  });
  const datasets = downloads.data?.datasets ?? [];
  const selectedSet = new Set(selectedIds);
  const selectable = datasets.filter((dataset) => !dataset.protectedReason);
  const selected = selectable.filter((dataset) => selectedSet.has(dataset.id));
  const selectedBytes = selected.reduce(
    (sum, dataset) => sum + dataset.bytes,
    0,
  );
  const allSelected =
    selectable.length > 0 && selected.length === selectable.length;
  async function remove() {
    if (!confirmation || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await api.deleteDownloadedDatasets.mutate({
        ids: confirmation.map((dataset) => dataset.id),
      });
      const deletedIds = new Set(result.deleted);
      setSelectedIds((ids) => ids.filter((id) => !deletedIds.has(id)));
      setNotice(
        `Deleted ${result.deleted.length} ${result.deleted.length === 1 ? "dataset" : "datasets"} (${formatBytes(result.removedBytes)} of stored files).`,
      );
      setFailures(
        result.failed.map(
          (failure) =>
            `${confirmation.find((dataset) => dataset.id === failure.id)?.name ?? "Dataset"}: ${failure.message}`,
        ),
      );
      setConfirmation(null);
      await qc.invalidateQueries();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not delete datasets",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="row downloads-heading">
        <h1>Downloaded datasets</h1>
        <Button className="secondary" disabled={busy} onClick={onBack}>
          ← Back to Settings
        </Button>
      </div>
      <p>
        Remove downloaded match files to free space. Saved runs, commentary and
        inspection traces are kept. You can download a match again when needed.
      </p>
      {downloads.data && (
        <p className="small muted downloads-path">
          Current cache: {downloads.data.directory}
        </p>
      )}
      <Panel
        title="Match files"
        aside={
          <span className="small muted">
            {datasets.length} datasets ·{" "}
            {formatBytes(
              datasets.reduce((sum, dataset) => sum + dataset.bytes, 0),
            )}{" "}
            stored
          </span>
        }
      >
        <div className="panel-body stack">
          <p className="small muted">
            Includes archives, extracted compressed tables and incomplete
            downloads in this cache. Bundled samples and datasets opened from
            other locations are excluded. Files used by queued, running or
            stopping runs cannot be deleted.
          </p>
          <div className="row downloads-toolbar">
            <Button
              className="secondary"
              disabled={busy || !selectable.length}
              onClick={() =>
                setSelectedIds(
                  allSelected ? [] : selectable.map((dataset) => dataset.id),
                )
              }
            >
              {allSelected ? "Clear selection" : "Select all"}
            </Button>
            <span role="status" className="small muted">
              {selected.length} selected · {formatBytes(selectedBytes)}
            </span>
            <Button
              className="danger"
              disabled={busy || !selected.length}
              onClick={() => {
                setError("");
                setConfirmation(selected);
              }}
            >
              Delete selected
            </Button>
            <Button
              className="secondary"
              disabled={busy || downloads.isFetching}
              onClick={() => void downloads.refetch()}
            >
              Refresh
            </Button>
          </div>
          {(error || downloads.error) && !confirmation && (
            <p className="error" role="alert">
              {error || downloads.error?.message}
            </p>
          )}
          {notice && (
            <p className="notice" role="status">
              {notice}
            </p>
          )}
          {failures.length > 0 && (
            <div className="error" role="alert">
              <p>Some datasets could not be deleted. Refresh and try again.</p>
              <ul>
                {failures.map((failure) => (
                  <li key={failure}>{failure}</li>
                ))}
              </ul>
            </div>
          )}
          {downloads.isPending ? (
            <p role="status">Reading local cache…</p>
          ) : datasets.length ? (
            <div className="downloaded-datasets">
              {datasets.map((dataset) => (
                <label className="downloaded-dataset" key={dataset.id}>
                  <input
                    type="checkbox"
                    disabled={busy || Boolean(dataset.protectedReason)}
                    checked={
                      selectedSet.has(dataset.id) && !dataset.protectedReason
                    }
                    onChange={(event) =>
                      setSelectedIds((ids) =>
                        event.target.checked
                          ? [...ids, dataset.id]
                          : ids.filter((id) => id !== dataset.id),
                      )
                    }
                  />
                  <span className="stack">
                    <strong>{dataset.name}</strong>
                    <span className="small muted">
                      {dataset.corpus} · {Number(dataset.resolution) / 1000}s
                      snapshots · {formatBytes(dataset.bytes)} stored files ·
                      revision {dataset.revision.slice(0, 8)}
                    </span>
                    {dataset.protectedReason && (
                      <span className="small muted">
                        {dataset.protectedReason}
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          ) : (
            !downloads.isError && (
              <p className="empty">No downloaded datasets in this cache.</p>
            )
          )}
        </div>
      </Panel>
      {confirmation && (
        <DestructiveConfirmation
          title={`Delete ${confirmation.length} downloaded ${confirmation.length === 1 ? "dataset" : "datasets"}?`}
          description={`${formatBytes(confirmation.reduce((sum, dataset) => sum + dataset.bytes, 0))} of stored match files will be permanently removed from this cache.`}
          retentionNote="Saved runs, commentary and inspection traces will stay. These datasets must be downloaded again to inspect their tables or generate new commentary."
          confirmLabel="Delete datasets"
          items={confirmation.map(
            (dataset) =>
              `${dataset.name} · ${dataset.corpus} · ${Number(dataset.resolution) / 1000}s · ${dataset.revision.slice(0, 8)}`,
          )}
          busy={busy}
          error={error}
          onCancel={() => setConfirmation(null)}
          onConfirm={() => void remove()}
        />
      )}
    </>
  );
}
