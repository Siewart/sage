import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "@jest/globals";

import { openArqueroMatch, openDuckDbMatch } from "../../src/data/open.js";
import { DuckDbQuery } from "../../src/data/duckdb/query.js";
import {
  preparedMatchDirectory,
  tableFilesFrom,
} from "../../src/data/duckdb/open.js";
import { SyncDuckDb } from "../../src/data/duckdb/sync-client.js";
import { quoteString } from "../../src/data/duckdb/sql.js";
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
 * A table split across several Parquet files.
 *
 * Every table under `data/` is a single file, so nothing else covers the
 * multi-file path — and that path is the fiddly one: `file_row_number` restarts
 * at zero in each shard, so the registered view has to offset each shard by the
 * rows before it or `ORDER BY __ord` interleaves them. A dataset export that
 * shards its larger tables would hit this on the first query, and the failure
 * would be silently reordered rows rather than an error.
 */
describe("a table sharded across files", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sage-shard-"));

  afterAll(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  (dataAvailable ? it : it.skip)(
    "reads in the same order as the same rows in one file",
    () => {
      // Open once so the Arrow -> Parquet conversion is on disk to split up.
      const single = openDuckDbMatch(DESCRIPTOR);
      const cacheDir = preparedMatchDirectory(DESCRIPTOR);

      const db = new SyncDuckDb();
      const shards: string[] = [];
      try {
        const source = path.join(cacheDir, "entities.parquet");
        const total = Number(
          db.query(
            `SELECT count(*) AS n FROM read_parquet(${quoteString(source)})`,
          )[0]!["n"],
        );
        // An uneven split, so an off-by-one in the offset cannot cancel out.
        const cut = Math.floor(total / 3);
        for (const [index, [offset, limit]] of [
          [0, cut],
          [cut, total - cut],
        ].entries()) {
          const shard = path.join(tmp, `entities-${index}.parquet`);
          db.exec(
            `COPY (SELECT * FROM read_parquet(${quoteString(source)}) ` +
              `LIMIT ${limit} OFFSET ${offset}) TO ${quoteString(shard)} (FORMAT parquet)`,
          );
          shards.push(shard);
        }
        expect(shards).toHaveLength(2);
      } finally {
        db.close();
      }

      const files = tableFilesFrom({
        entities: shards,
        masters: path.join(cacheDir, "masters.parquet"),
        strings: path.join(cacheDir, "strings.parquet"),
        researchStates: path.join(cacheDir, "researchStates.parquet"),
        players: path.join(cacheDir, "players.parquet"),
        events: path.join(cacheDir, "events.parquet"),
        map: path.join(cacheDir, "map.parquet"),
        settings: path.join(cacheDir, "settings.parquet"),
        world: path.join(cacheDir, "world.parquet"),
      });
      const sharded = new DuckDbQuery({
        name: "sharded",
        files,
        binTimes: single.binTimes(),
      });

      try {
        const reference = openArqueroMatch(DESCRIPTOR);
        for (const bin of [0, 21, 42]) {
          expect(
            diffRows(reference.entities({ bin }), sharded.entities({ bin })),
          ).toEqual([]);
          expect(
            diffRows(
              reference.namedEntities({ bin, ownerId: 1 }),
              sharded.namedEntities({ bin, ownerId: 1 }),
            ),
          ).toEqual([]);
        }
        // The split falls inside the table, so a shard boundary is crossed here.
        expect(
          diffRows(
            reference.entities({ columns: ["id", "sage:binId"] }),
            sharded.entities({ columns: ["id", "sage:binId"] }),
          ),
        ).toEqual([]);
      } finally {
        sharded.close();
        single.close();
      }
    },
    180_000,
  );
});
