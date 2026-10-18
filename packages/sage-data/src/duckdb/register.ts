import { BIN_ID, windowColumnToRename } from "../types.js";
import { ORD, VIEWS, quoteIdent, quoteString } from "./sql.js";

/** Parquet files backing one table of one match, in order. */
export type TableFiles = Record<keyof typeof VIEWS, readonly string[]>;

/** Columns each table's files actually carry, when known. */
export type TableColumns = Partial<
  Record<keyof typeof VIEWS, readonly string[]>
>;

/** Read the column names of one Parquet file. */
export function columnsSql(filePath: string): string {
  return `SELECT name FROM parquet_schema(${quoteString(filePath)})`;
}

/**
 * Build the `CREATE VIEW` statements for a match.
 *
 * Every view exposes `__ord`, a zero-based ordinal in source-file order, so
 * that `ORDER BY __ord` reproduces the row order Arquero gets from reading the
 * file top to bottom. Parquet's `file_row_number` gives that for free within a
 * file; when a table is sharded across files each shard's ordinals are shifted
 * by the number of rows before it, which is why `rowCounts` is needed.
 *
 * `columns` lets the view paper over the `sage:windowId` / `sage:binId` naming
 * split between dataset vintages; without it the files are taken as-is.
 */
export function registerStatements(
  files: TableFiles,
  rowCounts: Partial<Record<keyof typeof VIEWS, readonly number[]>> = {},
  columns: TableColumns = {},
): string[] {
  const statements: string[] = [];
  for (const [table, view] of Object.entries(VIEWS) as [
    keyof typeof VIEWS,
    string,
  ][]) {
    const paths = files[table];
    if (!paths || paths.length === 0) continue;
    const counts = rowCounts[table];
    const windowColumn = windowColumnToRename(columns[table]);
    const exclude = windowColumn
      ? `file_row_number, ${quoteIdent(windowColumn)}`
      : "file_row_number";
    const renamed = windowColumn
      ? `${quoteIdent(windowColumn)} AS ${quoteIdent(BIN_ID)}, `
      : "";
    let offset = 0;
    const branches = paths.map((filePath, index) => {
      const branch =
        `SELECT * EXCLUDE (${exclude}), ${renamed}` +
        `file_row_number + ${offset} AS ${ORD} ` +
        `FROM read_parquet(${quoteString(filePath)}, file_row_number = true)`;
      offset += counts?.[index] ?? 0;
      return branch;
    });
    statements.push(
      `CREATE OR REPLACE VIEW ${quoteIdent(view)} AS ${branches.join(" UNION ALL ")}`,
    );
  }
  return statements;
}

/** Row counts per shard, needed only when a table spans more than one file. */
export function rowCountSql(paths: readonly string[]): string {
  return paths
    .map((p) => `SELECT count(*) AS n FROM read_parquet(${quoteString(p)})`)
    .join(" UNION ALL ");
}
