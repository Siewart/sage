import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "@jest/globals";

import { openArqueroMatch, openDuckDbMatch } from "../../src/data/open.js";
import {
  defaultParityChecks,
  diffRows,
  runParity,
} from "../../src/data/parity.js";
import type { SageQuery } from "../../src/data/types.js";

const PKG_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
process.chdir(PKG_ROOT);

const DESCRIPTORS = fs
  .readdirSync(path.join(PKG_ROOT, "data"), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => path.join(PKG_ROOT, "data", d.name, "descriptor.json"));

/**
 * The Arquero backend reproduces the queries that produced the thesis results,
 * so it is the reference. These run against the 60-second match committed under
 * `data/`, converted to Parquet on first use, which is the only way both
 * backends can see byte-identical data.
 */
describe.each(DESCRIPTORS)("DuckDB matches Arquero: %s", (DESCRIPTOR) => {
  const dataAvailable = fs.existsSync(DESCRIPTOR);
  let reference: SageQuery | undefined;
  let candidate: SageQuery | undefined;

  if (dataAvailable) {
    reference = openArqueroMatch(DESCRIPTOR);
    candidate = openDuckDbMatch(DESCRIPTOR);
  }

  afterAll(() => {
    candidate?.close();
    reference?.close();
  });

  (dataAvailable ? it : it.skip)(
    "answers every query shape identically",
    () => {
      const results = runParity(
        reference!,
        candidate!,
        defaultParityChecks(reference!),
      );
      const failures = results.filter((r) => r.differences.length > 0);
      expect(
        failures.map((f) => `${f.name}: ${f.differences[0]?.message}`),
      ).toEqual([]);
      // Guard against a check set that silently stops reading anything.
      expect(results.every((r) => r.rows >= 0)).toBe(true);
      expect(results.some((r) => r.rows > 0)).toBe(true);
    },
    180_000,
  );

  (dataAvailable ? it : it.skip)(
    "agrees on the join keys the lookup relies on",
    () => {
      // Arquero's lookup keeps one right-hand row per key, so the SQL left join
      // is only equivalent while these keys stay unique.
      const masters = candidate!.sql(
        `SELECT count(*) AS rows, count(DISTINCT ("id", "sage:binId", "playerId")) AS keys FROM masters`,
      )[0]!;
      expect(masters["rows"]).toBe(masters["keys"]);

      const strings = candidate!.sql(
        `SELECT count(*) AS rows, count(DISTINCT "id") AS keys FROM strings`,
      )[0]!;
      expect(strings["rows"]).toBe(strings["keys"]);
    },
  );
});

describe("diffRows", () => {
  it("reports a row-count mismatch", () => {
    expect(diffRows([{ a: 1 }], [])[0]?.message).toMatch(/row count differs/);
  });

  it("treats null and undefined as the same absent value", () => {
    expect(diffRows([{ a: null }], [{ a: undefined }])).toEqual([]);
  });

  it("compares nested structs and lists by value", () => {
    expect(
      diffRows(
        [{ action: { targetId: 7 }, seen: [1, null] }],
        [{ action: { targetId: 7 }, seen: [1, null] }],
      ),
    ).toEqual([]);
    expect(
      diffRows([{ action: { targetId: 7 } }], [{ action: { targetId: 8 } }]),
    ).toHaveLength(1);
  });
});
