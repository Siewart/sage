import type { Dataset } from "@sage/contracts";
export interface CatalogFilter {
  filter: string;
  minDurationMs?: number | undefined;
  maxDurationMs?: number | undefined;
  minDownloadBytes?: number | undefined;
  maxDownloadBytes?: number | undefined;
  mapSize?: string | undefined;
}
export function matchesDataset(dataset: Dataset, input: CatalogFilter) {
  const metadata = dataset.metadata;
  const text = [
    dataset.name,
    metadata?.mapName,
    metadata?.mapSize,
    metadata?.mapWidth,
    metadata?.mapHeight,
    ...(metadata?.players ?? []).flatMap((p) => [p.name, p.civName, p.elo]),
  ]
    .join(" ")
    .toLowerCase();
  if (
    !input.filter
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .every((part) => text.includes(part))
  )
    return false;
  const duration = metadata?.durationMs;
  if (
    input.minDurationMs !== undefined &&
    (duration == null || duration < input.minDurationMs)
  )
    return false;
  if (
    input.maxDurationMs !== undefined &&
    (duration == null || duration > input.maxDurationMs)
  )
    return false;
  const bytes = dataset.space?.downloadBytes;
  if (
    input.minDownloadBytes !== undefined &&
    (bytes === undefined || bytes < input.minDownloadBytes)
  )
    return false;
  if (
    input.maxDownloadBytes !== undefined &&
    (bytes === undefined || bytes > input.maxDownloadBytes)
  )
    return false;
  if (
    input.mapSize &&
    !`${metadata?.mapSize ?? ""} ${metadata?.mapWidth ?? ""}x${metadata?.mapHeight ?? ""}`
      .toLowerCase()
      .includes(input.mapSize.toLowerCase())
  )
    return false;
  return true;
}
