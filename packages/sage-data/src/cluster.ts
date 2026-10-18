import * as aq from "arquero";
import { op } from "arquero";
import "./functions/dbscan.js";
import type { Cluster, ClusterOptions, Row } from "./types.js";

const DEFAULTS = { maxDistance: 2, minSize: 2 };

/**
 * DBSCAN over `(xKey, yKey)`, rolled up to one row per cluster.
 *
 * Both backends route here rather than clustering in their own engine, so a
 * cluster is a pure function of the rows a backend returns. That keeps the
 * expensive part of map quality identical across backends and leaves the parity
 * check testing data access rather than re-implemented geometry.
 *
 * Points DBSCAN rejects as noise are labelled `-1` and roll up into a single
 * group, which is the behaviour the map-quality code has always relied on.
 */
export function clusterRows(
  rows: readonly Row[],
  xKey: string,
  yKey: string,
  idKey: string,
  options?: ClusterOptions,
): Cluster[] {
  if (rows.length === 0) return [];
  const opts = {
    maxDistance: options?.maxDistance ?? DEFAULTS.maxDistance,
    minSize: options?.minSize ?? DEFAULTS.minSize,
  };
  return aq
    .from(rows as Row[])
    .select(idKey, xKey, yKey)
    .dbscan([xKey, yKey], opts.maxDistance, opts.minSize, "dbscan")
    .groupby("dbscan")
    .rollup({
      dbscan: op.any("dbscan"),
      clusterX: op.mean(xKey),
      clusterY: op.mean(yKey),
      size: op.count(),
      ids: op.array_agg(idKey),
    })
    .objects() as Cluster[];
}

/**
 * Clusters as an Arquero table, for the map-quality verbs that still want one.
 *
 * An empty result still needs its columns declared: `aq.from([])` produces a
 * table with no schema, and the joins downstream would fail on it.
 */
export function clustersToTable(clusters: readonly Cluster[]) {
  if (clusters.length === 0) {
    return aq.table({
      dbscan: [],
      clusterX: [],
      clusterY: [],
      size: [],
      ids: [],
    });
  }
  return aq.from(clusters as Cluster[]);
}
