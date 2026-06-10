// Generic versions of Arquero
export type ColumnGetter<T> = (row: number) => T;
export type DistanceFunction = (
  dataset: ColumnGetter<number>[],
  p: number,
  q: number,
) => number;

