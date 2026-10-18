import { masterToId } from "../aoe2/ids.js";
import type { Row, SageQuery } from "./types.js";

/**
 * Cross-backend parity checking.
 *
 * The Arquero backend is the reference — it reproduces, verb for verb, the
 * queries that produced the thesis results. A DuckDB backend is only usable if
 * it answers the same questions with the same rows in the same order, so this
 * module runs both over the same match and diffs them. Run it against the
 * 60-second matches under `data/`, where both backends can see identical data.
 */

export interface ParityCheck {
  name: string;
  run: (query: SageQuery) => Row[];
}

export interface ParityDifference {
  /** Row index, or `-1` when the row counts themselves differ. */
  row: number;
  key?: string;
  reference: unknown;
  candidate: unknown;
  message: string;
}

export interface ParityResult {
  name: string;
  rows: number;
  differences: ParityDifference[];
}

/** `null` and `undefined` both mean "absent" once rows have crossed a backend. */
const absent = (value: unknown) => value === null || value === undefined;

function valuesEqual(a: unknown, b: unknown): boolean {
  if (absent(a) && absent(b)) return true;
  if (typeof a === "number" && typeof b === "number") {
    return a === b || (Number.isNaN(a) && Number.isNaN(b));
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => valuesEqual(v, b[i]));
  }
  if (
    !absent(a) &&
    !absent(b) &&
    typeof a === "object" &&
    typeof b === "object"
  ) {
    const keys = new Set([
      ...Object.keys(a as object),
      ...Object.keys(b as object),
    ]);
    return [...keys].every((k) =>
      valuesEqual(
        (a as Record<string, unknown>)[k],
        (b as Record<string, unknown>)[k],
      ),
    );
  }
  return a === b;
}

export function diffRows(
  reference: readonly Row[],
  candidate: readonly Row[],
  maxDifferences = 10,
): ParityDifference[] {
  const differences: ParityDifference[] = [];
  if (reference.length !== candidate.length) {
    differences.push({
      row: -1,
      reference: reference.length,
      candidate: candidate.length,
      message: `row count differs: ${reference.length} vs ${candidate.length}`,
    });
  }

  const rows = Math.min(reference.length, candidate.length);
  for (let i = 0; i < rows && differences.length < maxDifferences; i++) {
    const left = reference[i] ?? {};
    const right = candidate[i] ?? {};
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    for (const key of keys) {
      if (!valuesEqual(left[key], right[key])) {
        differences.push({
          row: i,
          key,
          reference: left[key],
          candidate: right[key],
          message: `row ${i} key "${key}": ${JSON.stringify(left[key])} vs ${JSON.stringify(right[key])}`,
        });
        if (differences.length >= maxDifferences) break;
      }
    }
  }
  return differences;
}

export function runParity(
  reference: SageQuery,
  candidate: SageQuery,
  checks: readonly ParityCheck[],
): ParityResult[] {
  return checks.map((check) => {
    const referenceRows = check.run(reference);
    const candidateRows = check.run(candidate);
    return {
      name: check.name,
      rows: referenceRows.length,
      differences: diffRows(referenceRows, candidateRows),
    };
  });
}

/**
 * Checks covering every query shape the pipeline uses, parameterised from the
 * match itself so they exercise real bins, players and master ids.
 */
export function defaultParityChecks(
  query: SageQuery,
  options: { bins?: readonly number[]; playerIds?: readonly number[] } = {},
): ParityCheck[] {
  const binCount = query.binTimes().length;
  const bins = options.bins ?? [
    0,
    Math.floor(binCount / 3),
    Math.floor((binCount * 2) / 3),
    binCount - 1,
  ];
  const playerIds = options.playerIds ?? [1, 2];

  const checks: ParityCheck[] = [
    { name: "settings", run: (q) => [q.settings() as unknown as Row] },
    { name: "players/all", run: (q) => q.players() },
    {
      name: "players/bin0 non-gaia",
      run: (q) => q.players({ bin: 0, minId: 0 }),
    },
    { name: "world/all", run: (q) => q.world() },
    { name: "strings/all", run: (q) => q.strings() },
    { name: "strings/by id", run: (q) => q.strings({ ids: [5164, 5350, 1] }) },
    { name: "map/hills", run: (q) => q.mapCells({ minElevationExclusive: 1 }) },
    {
      name: "events/damage+death with both players",
      run: (q) =>
        q.events({
          modelTypes: ["damage", "death"],
          requireObjectPlayer: true,
          requireSubjectPlayer: true,
        }),
    },
    {
      name: "events/building lifecycle",
      run: (q) =>
        q.events({
          modelTypes: ["lifeCycle"],
          tags: ["underConstruction", "constructed"],
          requireSubjectPlayer: true,
        }),
    },
    {
      name: "clusters/gaia gold mines",
      run: (q) =>
        q
          .clusterEntities(
            { bin: 0, ownerId: 0, masterIds: [masterToId["Gold Mine"]] },
            { maxDistance: 2, minSize: 2 },
          )
          .map((c) => ({ ...c })) as Row[],
    },
    {
      name: "clusters/hills",
      run: (q) =>
        q
          .clusterMapCells({ minElevationExclusive: 1 }, { minSize: 8 })
          .map((c) => ({ ...c })) as Row[],
    },
  ];

  checks.push({
    // study-context falls back to an unwindowed lookup when an entity is
    // missing from the window being reported on.
    name: "entities/one id across every window",
    run: (q) =>
      q.entities({ ids: [1729], columns: ["id", "sage:binId", "ownerId"] }),
  });

  for (const bin of bins) {
    checks.push({
      name: `entities/bin ${bin} all`,
      run: (q) => q.entities({ bin }),
    });
    checks.push({
      name: `masters/bin ${bin} all`,
      run: (q) => q.masters({ bin }),
    });
    checks.push({
      name: `masters/bin ${bin} town centre`,
      run: (q) => q.masters({ bin, ids: [109], columns: ["id", "stringId"] }),
    });
    checks.push({
      name: `entities/bin ${bin} within 25 tiles of (50,21)`,
      run: (q) => q.entities({ bin, near: { x: 50, y: 21, radius: 25 } }),
    });
    for (const playerId of playerIds) {
      checks.push({
        name: `namedEntities/bin ${bin} player ${playerId}`,
        run: (q) => q.namedEntities({ bin, ownerId: playerId }),
      });
      checks.push({
        name: `namedResearchStates/bin ${bin} player ${playerId}`,
        run: (q) => q.namedResearchStates({ bin, playerId }),
      });
    }
  }
  return checks;
}
