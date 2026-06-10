export class SequenceDBSCAN<I> implements EventProcessor<I> {
  constructor(
    //private data: Array<I>, // Must be sorted by time
    private epsilonFunc: (l: I, r: I) => boolean,
    private minPoints: number,
    private seqThresholdFunc: (l: I, r: I) => boolean,
    private seqSortFunc: (l: I, r: I) => number,
    private shouldCloseEarly: (
      // Can be used to return closed clusters early
      openClusters: Array<Array<I>>,
      closedClusters: Array<Array<I>>,
    ) => boolean = () => false,
    private shouldReturnClosed: (
      openClusters: Array<Array<I>>,
      closedClusters: Array<Array<I>>,
    ) => boolean = () =>
      this.openClusters.length === 0 && this.closedClusters.length > 0,
  ) {}

  private returnedClusters: Array<Array<I>> = []; // clusters that have been returned
  private openClusters: Array<Array<I>> = [];
  private noise: Array<I> = [];
  private closedClusters: Array<Array<I>> = [];
  // private currentDataIndex: number = 0;
  nextEvent(
    currentPoint: I | undefined,
  ):
    | { status: "cluster-found"; values: Array<Array<I>> }
    | { status: "finished"; values: Array<Array<I>> }
    | { status: "no-cluster" } {
    // const currentPoint: I | undefined = this.data[this.currentDataIndex++];
    if (currentPoint === undefined) {
      return {
        status: "finished",
        values: [...this.openClusters, ...this.closedClusters],
      }; // No more data points, return all remaining clusters
    }
    if (currentPoint === null) {
      return { status: "no-cluster" }; // Null points are ignored
    }
    let neighbors: Array<I> | undefined = undefined;
    for (let i = 0; i < this.openClusters.length; i++) {
      const cluster = this.openClusters[i]!;
      if (!this.seqThresholdFunc(currentPoint, cluster[cluster.length - 1]!)) {
        this.closedClusters.push(cluster);
        this.openClusters.splice(i, 1);
        i--; // Adjust index after removal
        console.log(
          "Cluster closed",
          this.closedClusters.length,
          " / ",
          this.openClusters.length,
        );

        continue; // Skip to next cluster
      }
      for (let j = cluster.length - 1; j >= 0; j--) {
        const point = cluster[j]!;
        if (!this.seqThresholdFunc(currentPoint, point)) {
          break; // Further points in the cluster will never be within the time threshold
        }
        if (this.epsilonFunc(currentPoint, point)) {
          // Merge the cluster
          if (neighbors === undefined) {
            neighbors = cluster; // Merge this
            neighbors.push(currentPoint); // And add the current point to it
          } else {
            neighbors.push(...cluster); // Merge this with the existing neighbors
            neighbors.sort(this.seqSortFunc);
          }
          this.openClusters.splice(i, 1); // Cluster is merged, remove it from open clusters
          i--; // Adjust index after removal
          break; // We merged the cluster, we can skip the rest of the points in this cluster
        }
      }
    }
    const noiseNeighbors: Array<I> = [];
    for (let i = 0; i < this.noise.length; i++) {
      const noisePoint = this.noise[i]!;
      if (!this.seqThresholdFunc(currentPoint, noisePoint)) {
        // Outside of time threshold, so will never be part of a cluster
        this.noise.splice(i, 1);
        i--; // Adjust index after removal
        continue;
      }
      if (this.epsilonFunc(currentPoint, noisePoint)) {
        noiseNeighbors.push(noisePoint);
      }
    }

    if (noiseNeighbors.length < this.minPoints && neighbors === undefined) {
      this.noise.push(currentPoint);
    } else {
      if (neighbors === undefined) {
        neighbors = noiseNeighbors;
        neighbors.push(currentPoint);
      } else if (noiseNeighbors.length > 0) {
        // current Point is already added to a cluster and show shoud it's noise neighbors
        neighbors.push(...noiseNeighbors);
        neighbors.sort((l, r) => this.seqSortFunc(l, r));
      }
      this.openClusters.push(neighbors);
      // Old
      // noiseNeighbors.forEach((n) => {
      //   const index = this.noise.indexOf(n);
      //   if (index !== -1) {
      //     this.noise.splice(index, 1); // Remove noise point if it was added to a cluster
      //   }
      // });
      // New
      // Remove noise neighbors from noise array efficiently
      if (noiseNeighbors.length > 0) {
        const noiseSet = new Set(noiseNeighbors);
        this.noise = this.noise.filter((n) => !noiseSet.has(n));
      }
    }

    if (this.shouldReturnClosed(this.openClusters, this.closedClusters)) {
      this.returnedClusters.push(...this.closedClusters);
      const result = [...this.closedClusters];
      this.closedClusters = [];
      return { status: "cluster-found", values: result };
    }
    if (
      this.closedClusters.length > 0 &&
      this.shouldCloseEarly(this.openClusters, this.closedClusters)
    ) {
      // If we have some closed clusters, and we hit a provided condition, we return them
      this.returnedClusters.push(...this.closedClusters);
      const result = [...this.closedClusters];
      this.closedClusters = [];
      return { status: "cluster-found", values: result };
    }
    return { status: "no-cluster" };
  }

  hoistClusters(
    selector: ((cluster: Array<I>) => false | "hoist" | "peek") | undefined,
    hoistClosed: boolean = true,
    hoistOpen: boolean = true,
  ): Array<Array<I>> | null {
    if (!hoistClosed && !hoistOpen) {
      console.warn(
        "At least one of hoistClosed or hoistOpen must be true, otherwise no results will be returned",
      );
      return null;
    }
    const result: Array<Array<I>> = [];

    const processClusters = (
      clusters: Array<Array<I>>,
      setClusters: (newClusters: Array<Array<I>>) => void,
      shouldProcess: boolean,
    ) => {
      if (!shouldProcess) return;
      if (selector === undefined) {
        result.push(...clusters);
        setClusters([]);
        return;
      }
      const toReturn: Array<Array<I>> = [];
      const toKeep: Array<Array<I>> = [];
      for (const cluster of clusters) {
        const sel = selector(cluster);
        if (sel === "hoist") {
          toReturn.push(cluster);
        } else if (sel === "peek") {
          toReturn.push(cluster);
          toKeep.push(cluster);
        } else {
          toKeep.push(cluster);
        }
      }
      setClusters(toKeep);
      result.push(...toReturn);
    };

    processClusters(
      this.closedClusters,
      (newClusters) => (this.closedClusters = newClusters),
      hoistClosed,
    );
    processClusters(
      this.openClusters,
      (newClusters) => (this.openClusters = newClusters),
      hoistOpen,
    );

    return result.length > 0 ? result : null;
  }
}

export class SequenceFilter<I> implements EventProcessor<I> {
  constructor(private classifyFunc: (e: I) => boolean) {}

  nextEvent(
    currentPoint: I | undefined,
  ):
    | { status: "cluster-found"; values: I[][] }
    | { status: "finished"; values: I[][] }
    | { status: "no-cluster" } {
    if (currentPoint === undefined) {
      return { status: "finished", values: [] }; // No more data points
    }
    if (this.classifyFunc(currentPoint)) {
      return { status: "cluster-found", values: [[currentPoint]] }; // Return the current point if it matches the classification
    }
    return { status: "no-cluster" };
  }
}

interface EventProcessor<T> {
  nextEvent(
    currentPoint: T | undefined,
  ):
    | { status: "cluster-found"; values: T[][] }
    | { status: "finished"; values: T[][] }
    | { status: "no-cluster" };
}

