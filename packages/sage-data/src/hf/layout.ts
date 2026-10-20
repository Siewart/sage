import { z } from "zod";

import { VIEWS } from "../duckdb/sql.js";

/**
 * How a Hugging Face dataset repository is laid out on disk.
 *
 * The SAGE corpus on the Hub holds thousands of matches at two snapshot
 * resolutions, and its directory shape is not something to hard-code from
 * memory. Run `pnpm gen data probe` once, read what it inferred, then commit
 * the manifest. Everything downstream — listing matches, downloading, opening a
 * match in DuckDB — reads that file, so correcting a bad guess is a text edit
 * rather than a code change.
 */

export const SAGE_TABLES = Object.keys(VIEWS) as (keyof typeof VIEWS)[];

/**
 * Filename stems that map onto a SAGE table. Comparison is case-insensitive
 * and ignores `-` and `_`, so `research-states`, `research_states` and
 * `researchStates` all land on `researchStates`.
 */
export const DEFAULT_TABLE_ALIASES: Record<string, string> = {
  entities: "entities",
  masters: "masters",
  strings: "strings",
  researchstates: "researchStates",
  players: "players",
  events: "events",
  map: "map",
  settings: "settings",
  world: "world",
};

export function normalizeTableName(stem: string): string {
  return stem.toLowerCase().replace(/[-_\s]/g, "");
}

export function resolveTableName(
  stem: string,
  aliases: Record<string, string> = DEFAULT_TABLE_ALIASES,
): keyof typeof VIEWS | undefined {
  return aliases[normalizeTableName(stem)] as keyof typeof VIEWS | undefined;
}

export const layoutSchema = z.object({
  /** `owner/name` of the dataset repository on the Hub. */
  repo: z.string(),
  /** Branch, tag or commit. Pin a commit for a reproducible corpus. */
  revision: z.string().default("main"),
  /**
   * Path template for a match's table files, e.g.
   * `{corpus}/{resolution}/{match}/{table}.parquet`. `{table}` is required and
   * `{match}` identifies one match; every other placeholder is a facet the
   * caller selects.
   */
  template: z.string(),
  /** Values seen per facet placeholder. */
  facets: z.record(z.string(), z.array(z.string())).default({}),
  /** Facet values used when the caller does not name one. */
  defaultFacets: z.record(z.string(), z.string()).default({}),
  /** Filename stem -> SAGE table name. */
  tableAliases: z.record(z.string(), z.string()).default(DEFAULT_TABLE_ALIASES),
  /**
   * SAGE table name -> the filename stem the repository actually uses, so a
   * path can be built back up. `researchStates` is stored as
   * `research-states.parquet`, and filling `{table}` with the canonical name
   * would ask the Hub for a file that does not exist.
   */
  tableStems: z.record(z.string(), z.string()).default({}),
  /**
   * Path template for a per-match archive holding every table, when the
   * repository ships one instead of loose files. Downloaded and unpacked into
   * the cache; the table files are then read from there.
   */
  archiveTemplate: z.string().optional(),
  archiveKind: z.enum(["zip", "none"]).default("none"),
  /**
   * Where a match's snapshot-window bounds come from. `descriptor` means a
   * JSON file at `metadataTemplate` shaped like the `descriptor.json` files
   * under `data/`.
   */
  metadataKind: z.enum(["descriptor", "none"]).default("descriptor"),
  metadataTemplate: z.string().optional(),
  /** Tables the probe found split across several files. */
  shardedTables: z.array(z.string()).default([]),
  /** What the probe was unsure about. Read these before trusting the manifest. */
  warnings: z.array(z.string()).default([]),
});

export type SageLayout = z.infer<typeof layoutSchema>;

/** Placeholders in a template, in order of appearance. */
export function templatePlaceholders(template: string): string[] {
  return [...template.matchAll(/\{(\w+)\}/g)].map((m) => m[1] as string);
}

export function fillTemplate(
  template: string,
  values: Readonly<Record<string, string>>,
): string {
  return template.replace(/\{(\w+)\}/g, (_all, key: string) => {
    const value = values[key];
    if (value === undefined) {
      throw new Error(
        `Template "${template}" needs a value for {${key}}; got ${JSON.stringify(values)}`,
      );
    }
    return value;
  });
}

/**
 * Turn a template into a regular expression capturing every placeholder, so a
 * flat file listing can be read back into (facet, match, table) triples.
 *
 * A placeholder repeated in a template — an archive named after its own
 * directory, `{match}/{match}.parquet.zip` — captures once and back-references
 * after that, so the two positions have to agree.
 */
export function templateToRegExp(template: string): {
  pattern: RegExp;
  keys: string[];
} {
  const keys: string[] = [];
  let source = "";
  let index = 0;
  for (const match of template.matchAll(/\{(\w+)\}/g)) {
    source += escapeRegExp(template.slice(index, match.index));
    const key = match[1] as string;
    const seen = keys.indexOf(key);
    if (seen >= 0) {
      source += `\\${seen + 1}`;
    } else {
      keys.push(key);
      // A match id can contain slashes; every other placeholder is one segment.
      source += key === "match" ? "(.+?)" : "([^/]+)";
    }
    index = (match.index ?? 0) + match[0].length;
  }
  source += escapeRegExp(template.slice(index));
  return { pattern: new RegExp(`^${source}$`), keys };
}

/** The filename stem the repository uses for a table, defaulting to its name. */
export function tableStem(layout: SageLayout, table: string): string {
  return layout.tableStems[table] ?? table;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
