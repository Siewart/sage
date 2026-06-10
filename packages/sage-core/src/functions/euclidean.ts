export function euclidean(left: Array<number>, right: Array<number>): number {
  if (left.length !== right.length) {
    throw new Error(
      "left must be a contiguous array with the same length as right.",
    );
  }
  let sum = 0;
  left.forEach((col, i) => {
    sum += (col - right[i]!) ** 2;
  });
  return sum ** 0.5;
}

