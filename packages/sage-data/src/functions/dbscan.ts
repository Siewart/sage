/*
 * Modified from: https://github.com/uhho/density-clustering/
 *
 * Copyright © 2013 Abeja Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the “Software”), to deal in the
 * Software without restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the
 * Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * The software is provided “as is”, without warranty of any kind, express or
 * implied, including but not limited to the warranties of merchantability, fitness
 * for a particular purpose and noninfringement. In no event shall the authors or
 * copyright holders be liable for any claim, damages or other liability, whether
 * in an action of contract, tort or otherwise, arising from, out of or in
 * connection with the software or the use or other dealings in the software.
 */

import * as aq from "arquero";
import { DistanceFunction, ColumnGetter } from "./shared.js";

const euclideanDistance = (
  dataset: ColumnGetter<number>[],
  p: number,
  q: number,
): number => {
  let sum = 0;
  let i = dataset.length;

  while (i--) {
    sum += ((dataset[i]?.(p) ?? 0) - (dataset[i]?.(q) ?? 0)) ** 2;
  }

  return Math.sqrt(sum);
};

class DBSCAN {
  dataset: ColumnGetter<number>[] = [];
  epsilon = 1;
  minPts = 2;
  distance: DistanceFunction = euclideanDistance;
  clusters: number[][] = [];
  noise: number[] = [];

  private _visited: number[] = [];
  private _assigned: number[] = [];
  private _datasetLength = 0;

  constructor(
    dataset: ColumnGetter<number>[],
    entryCount: number,
    epsilon?: number,
    minPts?: number,
    distanceFunction?: DistanceFunction,
  ) {
    this.init(dataset, entryCount, epsilon, minPts, distanceFunction);
  }

  run(): number[][] {
    for (let pointId = 0; pointId < this._datasetLength; pointId++) {
      // if point is not visited, check if it forms a cluster
      if (this._visited[pointId] !== 1) {
        this._visited[pointId] = 1;

        // if closest neighborhood is too small to form a cluster, mark as noise
        const neighbors = this.regionQuery(pointId);

        if (neighbors.length < this.minPts) {
          this.noise.push(pointId);
        } else {
          // create new cluster and add point
          const clusterId = this.clusters.length;
          this.clusters.push([]);
          this.addToCluster(pointId, clusterId);
          this.expandCluster(clusterId, neighbors);
        }
      }
    }

    return this.clusters;
  }

  private init(
    dataset: ColumnGetter<number>[], // TODO: This should be 2 Arrays of numbers instead
    entryCount: number,
    epsilon?: number,
    minPts?: number,
    distance?: DistanceFunction,
  ): void {
    if (dataset) {
      if (!(dataset instanceof Array)) {
        throw Error(
          "Dataset must be of type array, " + typeof dataset + " given",
        );
      }

      this.dataset = dataset;
      this.clusters = [];
      this.noise = [];
      this._datasetLength = entryCount;
      this._visited = new Array(this._datasetLength);
      this._assigned = new Array(this._datasetLength);
    }

    if (epsilon) {
      this.epsilon = epsilon;
    }

    if (minPts) {
      this.minPts = minPts;
    }

    if (distance) {
      this.distance = distance;
    }
  }

  private expandCluster(clusterId: number, neighbors: number[]): void {
    for (let i = 0; i < neighbors.length; i++) {
      const pointId2: number = neighbors[i] ?? 0;

      if (this._visited[pointId2] !== 1) {
        this._visited[pointId2] = 1;
        const neighbors2 = this.regionQuery(pointId2);

        if (neighbors2.length >= this.minPts) {
          neighbors = this.mergeArrays(neighbors, neighbors2);
        }
      }

      // add to cluster
      if (this._assigned[pointId2] !== 1) {
        this.addToCluster(pointId2, clusterId);
      }
    }
  }

  private addToCluster(pointId: number, clusterId: number): void {
    this.clusters[clusterId]?.push(pointId);
    this._assigned[pointId] = 1;
  }

  private regionQuery(pointId: number): number[] {
    const neighbors = [] as Array<number>;

    for (let id = 0; id < this._datasetLength; id++) {
      const dist = this.distance(this.dataset, pointId, id);
      if (dist < this.epsilon) {
        neighbors.push(id);
      }
    }

    return neighbors;
  }

  // TODO (later): This is inefficient: can it be zero-copy?
  private mergeArrays(a: number[], b: number[]): number[] {
    const len = b.length;

    for (let i = 0; i < len; i++) {
      const P = b[i] ?? 0;
      if (a.indexOf(P) < 0) {
        a.push(P);
      }
    }

    return a;
  }
}

declare module "arquero" {
  interface ColumnTable {
    dbscan(
      inCols: [string, ...string[]],
      epsilon: number,
      minPts?: number,
      outCol?: string,
      after?: string,
    ): ColumnTable;
  }
}

Object.assign(aq.ColumnTable.prototype, {
  dbscan: function (
    this: aq.ColumnTable,
    inCols: [string, ...string[]],
    epsilon: number,
    minPts: number = 2,
    outCol: string = "cluster",
  ): aq.ColumnTable {
    const dataset = inCols.map((col) =>
      (this as unknown as aq.ColumnTable).getter(col),
    ) as ColumnGetter<number>[];
    const entryCount = (this as unknown as aq.ColumnTable).numRows();

    if (!(entryCount > 0 && dataset.every((d) => typeof d?.(0) === "number"))) {
      throw new Error(
        "Invalid table or columns: table must have at least 1 row, column names must be valid and all entries must be numbers. Reading columns: " +
          inCols.join(", ") +
          " from table with " +
          entryCount +
          " rows.",
      );
    }

    // Run DBSCAN
    const dbscan = new DBSCAN(dataset, entryCount, epsilon, minPts);
    dbscan.run();

    // Create cluster assignments array (-1 represents noise)
    const clusterAssignments = new Array(entryCount).fill(-1) as number[];

    // Assign clusters
    for (let clusterId = 0; clusterId < dbscan.clusters.length; clusterId++) {
      const cluster = dbscan.clusters[clusterId] ?? [];
      for (const pointId of cluster) {
        clusterAssignments[pointId] = clusterId;
      }
    }

    return this.assign(aq.table({ [outCol]: clusterAssignments }));
  },
});
