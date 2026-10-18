import { execution } from "@sage/contracts/execution";

declare const hydratedType: unique symbol;
/** Raw facts carry an in-memory hydration plan, never a serialized function. */
export type PreparedHydration<Raw extends object, Hydrated> = Raw & {
  readonly [hydratedType]: Hydrated;
};
export type Hydrated<T> =
  T extends PreparedHydration<object, infer Result> ? Result : T;
const plans = new WeakMap<object, () => unknown>();
const resolved = new WeakMap<object, unknown>();

export function prepareHydration<Raw extends object, Result>(
  facts: Raw,
  hydrate: () => Result,
): PreparedHydration<Raw, Result> {
  plans.set(facts, hydrate);
  if (execution.getStore()?.debugEarlyHydration) {
    // Hydrated values must retain the facts consumed by classifiers/planners.
    const value = hydrateForRealization(facts);
    return value as PreparedHydration<Raw, Result>;
  }
  return facts as PreparedHydration<Raw, Result>;
}

/** Resolve nested plans too: deferred grouping retains the original raw objects. */
export function hydrateForRealization<T>(input: T): Hydrated<T> {
  function visit(value: unknown): unknown {
    if (value === null || typeof value !== "object") return value;
    if (resolved.has(value)) return resolved.get(value);
    const plan = plans.get(value);
    if (plan) {
      const result = visit(plan());
      resolved.set(value, result);
      return result;
    }
    if (Array.isArray(value)) return value.map(visit);
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, visit(item)]),
    );
  }
  return visit(input) as Hydrated<T>;
}
