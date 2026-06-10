export abstract class JLikeEnum<T extends string> {
  protected constructor(public readonly value: T) {
    this.value = value;
  }
  toString = () => this.value;
  readonly name = () => this.value;
  private _ordinal: number | undefined;
  // this doesnt currently handle deeper inheritance since that is not allowed in Java
  get ordinal(): number {
    if (this._ordinal) return this._ordinal;
    this._ordinal = Object.values(this.constructor)
      .filter((x) => x instanceof this.constructor) // could be cached better
      .findIndex((x) => {
        return x === this;
      });
    return this._ordinal;
  }
  static get values() {
    return Object.values(this).filter((x) => x instanceof this); // could be cached
  }

  static fromValue<T extends string>(value: T): JLikeEnum<T> | undefined {
    return this.values.find((x) => x.value === value);
  }
}

export const containsString = <T extends string>(
  array: readonly T[],
  value: string,
  ignoreCase = true,
): boolean =>
  array.find((v) =>
    ignoreCase ? v.toLowerCase() === value.toLowerCase() : v === value,
  ) !== undefined;

export type BoxedValue<T> = { value: T };
export const box = <T>(value: T): BoxedValue<T> => ({ value });
export const unbox = <T>(boxed: BoxedValue<T>): T => boxed.value;

export const arrayEquals = <T extends { equals: (other: unknown) => boolean }>(
  a: T[],
  b: T[],
) => {
  if (a.length !== b.length) return false;
  return a.every((item, i) => item?.equals(b[i]) ?? false);
};

export const everyEquals = <T extends { equals: (other: unknown) => boolean }>(
  a: T,
  b: T[],
) => {
  return b.every((element) => element?.equals(a) ?? false);
};

export const someEquals = <T extends { equals: (other: unknown) => boolean }>(
  a: T,
  b: T[],
) => b.some((element) => element?.equals(a) ?? false);

// currently this allows copying fields that are not allowed on the target/to object
export const cloneInto = <T extends Record<string, unknown>>(
  from: T,
  to: T,
  deleteExisting = true, // since to and from have the same type, we should always readd the required features
  features?: Array<keyof T>,
) => {
  if (deleteExisting) {
    for (const key in to) {
      if (
        features === undefined ||
        (features.includes(key) && Object.hasOwn(to, key))
      ) {
        delete to[key];
      }
    }
  }
  for (const key in from) {
    if (
      (features === undefined || features.includes(key)) &&
      Object.hasOwn(from, key)
    ) {
      to[key] = from[key];
    }
  }
};

// currently this allows copying fields that are not allowed on the target/to object
export const copyField = <T extends Record<string, unknown>>(
  from: Partial<T>,
  to: T,
  field: keyof T,
  deleteIfUndefined = true,
) => {
  if (from[field] !== undefined) to[field] = from[field];
  else if (deleteIfUndefined) delete to[field];
};

export function javaLikeEquals(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== "object" || typeof b !== "object") return false;
  if ("equals" in a && typeof a.equals === "function") {
    return a.equals(b);
  }
  if ("equals" in b && typeof b.equals === "function") {
    return b.equals(a);
  }
  if (Array.isArray(a)) {
    if (!Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!javaLikeEquals(a[i], b[i])) return false;
    }
    return true;
  }
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (
      !javaLikeEquals(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
      )
    ) {
      return false;
    }
  }
  return true;
}

export function deepEquals(
  a: unknown,
  b: unknown,
  trackCycles: boolean = false,
  seen = new Map<unknown, unknown>(),
): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== "object" || typeof b !== "object") return false;

  if (trackCycles) {
    if (seen.has(a)) return seen.get(a) === b;
    seen.set(a, b);
  }

  if (Array.isArray(a)) {
    if (!Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEquals(a[i], b[i], trackCycles, seen)) return false;
    }
    return true;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (
      !deepEquals(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
        trackCycles,
        seen,
      )
    ) {
      return false;
    }
  }
  return true;
}
