import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "@jest/globals";

import { openDuckDbMatch } from "../../src/data/open.js";
import { DuckDbQuery } from "../../src/data/duckdb/query.js";
import {
  preparedMatchDirectory,
  tableFilesFrom,
} from "../../src/data/duckdb/open.js";
import { SyncDuckDb } from "../../src/data/duckdb/sync-client.js";
import { quoteIdent, quoteString, VIEWS } from "../../src/data/duckdb/sql.js";
import {
  BIN_ID,
  windowColumnToRename,
  WINDOW_ID_ALIASES,
} from "../../src/data/types.js";
import { diffRows } from "../../src/data/parity.js";

const PKG_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
process.chdir(PKG_ROOT);

const MATCH_DIR = "Kotd4-Groups S06G3-Mbl vs Vinchester";
const DESCRIPTOR = path.join(PKG_ROOT, "data", MATCH_DIR, "descriptor.json");
const dataAvailable = fs.existsSync(DESCRIPTOR);

/**
 * The snapshot-window column is named `sage:binId` by the matches under
 * `data/` and `sage:windowId` by the Hugging Face corpus. Every query is
 * written against one name, so the other has to be renamed as the data is
 * registered — otherwise reading the corpus fails on the first query with
 * "Referenced column not found", which is what it did.
 */
describe("the snapshot-window column", () => {
  it("renames a window-named column onto the one the queries use", () => {
    expect(windowColumnToRename(["id", "sage:windowId"])).toBe("sage:windowId");
    expect(windowColumnToRename(["id", "sage:windowID"])).toBe("sage:windowID");
  });

  it("leaves a column already named for bins alone", () => {
    expect(windowColumnToRename(["id", BIN_ID])).toBeUndefined();
    // A file carrying both is left as-is rather than colliding two columns.
    expect(windowColumnToRename([BIN_ID, "sage:windowId"])).toBeUndefined();
  });

  it("has nothing to rename when the column is absent entirely", () => {
    expect(windowColumnToRename(["x", "y"])).toBeUndefined();
    expect(windowColumnToRename(undefined)).toBeUndefined();
  });

  it("covers the spellings the corpus uses", () => {
    expect([...WINDOW_ID_ALIASES]).toContain("sage:windowId");
  });
});

describe("a match whose window column is named for windows", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sage-window-"));

  afterAll(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  (dataAvailable ? it : it.skip)(
    "answers identically to the same match named for bins",
    () => {
      // Open once so the Arrow -> Parquet conversion is on disk to rewrite.
      const reference = openDuckDbMatch(DESCRIPTOR);
      const cacheDir = preparedMatchDirectory(DESCRIPTOR);

      const db = new SyncDuckDb();
      const renamed: Record<string, string> = {};
      try {
        for (const table of Object.keys(VIEWS)) {
          const source = path.join(cacheDir, `${table}.parquet`);
          const target = path.join(tmp, `${table}.parquet`);
          const columns = db
            .query(`SELECT name FROM parquet_schema(${quoteString(source)})`)
            .map((row) => String(row["name"]));
          const projection = columns.includes(BIN_ID)
            ? `* EXCLUDE (${quoteIdent(BIN_ID)}), ${quoteIdent(BIN_ID)} AS ${quoteIdent("sage:windowId")}`
            : "*";
          db.exec(
            `COPY (SELECT ${projection} FROM read_parquet(${quoteString(source)})) ` +
              `TO ${quoteString(target)} (FORMAT parquet)`,
          );
          renamed[table] = target;
        }
      } finally {
        db.close();
      }

      const candidate = new DuckDbQuery({
        name: reference.name,
        files: tableFilesFrom(renamed),
        binTimes: reference.binTimes(),
      });

      try {
        const bin = 5;
        for (const [, rows] of [
          [
            "players",
            () => ({
              a: reference.players({ bin }),
              b: candidate.players({ bin }),
            }),
          ],
          [
            "entities",
            () => ({
              a: reference.entities({ bin }),
              b: candidate.entities({ bin }),
            }),
          ],
          [
            "masters",
            () => ({
              a: reference.masters({ bin }),
              b: candidate.masters({ bin }),
            }),
          ],
          [
            "world",
            () => ({
              a: reference.world({ bin }),
              b: candidate.world({ bin }),
            }),
          ],
        ] as const) {
          const { a, b } = rows();
          expect(a.length).toBeGreaterThan(0);
          expect(diffRows(a, b)).toEqual([]);
          // The renamed column reaches callers under the one expected name.
          expect(Object.keys(b[0] as object)).toContain(BIN_ID);
          expect(Object.keys(b[0] as object)).not.toContain("sage:windowId");
        }
      } finally {
        candidate.close();
        reference.close();
      }
    },
    120_000,
  );
});
