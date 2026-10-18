import { describe, expect, it } from "@jest/globals";

import { probeLayout } from "../../src/data/hf/probe.js";
import {
  fillTemplate,
  layoutSchema,
  tableStem,
  templateToRegExp,
} from "../../src/data/hf/layout.js";
import { matchesFromPaths } from "../../src/data/hf/client.js";

const TABLES = [
  "entities",
  "masters",
  "strings",
  "research-states",
  "players",
  "events",
  "map",
  "settings",
  "world",
];

/** Build a listing for `matches` under `prefix`, one `.parquet.zip` each. */
function archiveListing(prefix: string, matches: readonly string[]) {
  return matches.flatMap((match) => [
    `${prefix}/${match}/${match}.parquet.zip`,
    `${prefix}/${match}/${match}.arrow.zip`,
    `${prefix}/${match}/descriptor.json`,
  ]);
}

/** Build a listing for `matches` under `prefix`, one Parquet file per table. */
function listing(
  prefix: string,
  matches: readonly string[],
  descriptor = true,
) {
  return matches.flatMap((match) => [
    ...TABLES.map((table) => `${prefix}/${match}/${table}.parquet`),
    ...(descriptor ? [`${prefix}/${match}/descriptor.json`] : []),
  ]);
}

describe("probeLayout", () => {
  it("infers a directory-per-match layout with corpus and resolution facets", () => {
    const paths = [
      ...listing("kotd4/60s", ["m1", "m2", "m3"]),
      ...listing("kotd4/1s", ["m1", "m2", "m3"]),
      ...listing("may2026/60s", ["a", "b"]),
    ];

    const { layout, matchCount } = probeLayout({ repo: "Siewart/sage", paths });

    expect(layout.template).toBe(
      "{corpus}/{resolution}/{match}/{table}.parquet",
    );
    expect(layout.facets["corpus"]).toEqual(["kotd4", "may2026"]);
    expect(layout.facets["resolution"]).toEqual(["1s", "60s"]);
    expect(layout.metadataTemplate).toBe(
      "{corpus}/{resolution}/{match}/descriptor.json",
    );
    expect(matchCount).toBe(8);
  });

  it("normalises table file names onto SAGE table names", () => {
    const { tableFileCounts } = probeLayout({
      repo: "r",
      paths: listing("corpus", ["m1"]),
    });
    expect(tableFileCounts["researchStates"]).toBe(1);
    expect(Object.keys(tableFileCounts).sort()).toEqual([
      "entities",
      "events",
      "map",
      "masters",
      "players",
      "researchStates",
      "settings",
      "strings",
      "world",
    ]);
  });

  it("recognises a table-per-directory shard layout", () => {
    const paths = TABLES.flatMap((table) => [
      `data/m1/${table}/part-0.parquet`,
      `data/m1/${table}/part-1.parquet`,
    ]);
    const { layout } = probeLayout({ repo: "r", paths });
    expect(layout.template).toBe("data/{match}/{table}/*.parquet");
    expect(layout.shardedTables).toContain("entities");
  });

  it("warns instead of guessing when no descriptor is present", () => {
    const { layout } = probeLayout({
      repo: "r",
      paths: listing("corpus", ["m1"], false),
    });
    expect(layout.metadataKind).toBe("none");
    expect(layout.warnings.join(" ")).toMatch(/binTimes/);
  });

  it("finds matches shipped as one archive each", () => {
    const paths = [
      ...archiveListing("kotd4/export/1000", ["m1", "m2"]),
      ...archiveListing("kotd4/export/60000", ["m1", "m2"]),
    ];

    const { layout, matchCount } = probeLayout({ repo: "r", paths });

    expect(layout.archiveTemplate).toBe(
      "kotd4/export/{resolution}/{match}/{match}.parquet.zip",
    );
    expect(layout.archiveKind).toBe("zip");
    expect(matchCount).toBe(4);
    // Nothing is "missing": which tables an archive holds is only knowable
    // once one is unpacked.
    expect(layout.warnings).toEqual([]);
  });

  it("names a bare-millisecond segment as the resolution facet", () => {
    const { layout } = probeLayout({
      repo: "r",
      paths: [
        ...archiveListing("kotd4/export/1000", ["m1"]),
        ...archiveListing("kotd4/export/60000", ["m1"]),
      ],
    });
    expect(layout.facets["resolution"]).toEqual(["1000", "60000"]);
  });

  it("reads both shapes when a repository mixes them", () => {
    const paths = [
      ...archiveListing("kotd4/export/1000", ["m1", "m2"]),
      ...listing("sample/export/1000", ["m3"]),
    ];

    const { layout, matchCount } = probeLayout({ repo: "r", paths });

    expect(matchCount).toBe(3);
    expect(layout.archiveTemplate).toBeDefined();
    expect(layout.warnings.join(" ")).toMatch(
      /2 of 3 match directories hold a .parquet.zip archive/,
    );
  });

  it("records the filename stem each table is stored under", () => {
    const { layout } = probeLayout({ repo: "r", paths: listing("c", ["m1"]) });
    // `researchStates` is the table; `research-states` is the file.
    expect(layout.tableStems["researchStates"]).toBe("research-states");
    expect(tableStem(layoutSchema.parse(layout), "researchStates")).toBe(
      "research-states",
    );
    expect(tableStem(layoutSchema.parse(layout), "entities")).toBe("entities");
  });

  it("refuses a repository with no recognisable tables", () => {
    expect(() =>
      probeLayout({ repo: "r", paths: ["README.md", "misc/thing.parquet"] }),
    ).toThrow(/no parquet files/i);
  });
});

describe("templates", () => {
  it("round-trips a filled path back into its parts", () => {
    const template = "{corpus}/{resolution}/{match}/{table}.parquet";
    const filled = fillTemplate(template, {
      corpus: "kotd4",
      resolution: "60s",
      match: "Mbl vs Vinchester",
      table: "entities",
    });
    expect(filled).toBe("kotd4/60s/Mbl vs Vinchester/entities.parquet");

    const { pattern, keys } = templateToRegExp(template);
    const result = pattern.exec(filled);
    expect(result).not.toBeNull();
    expect(keys).toEqual(["corpus", "resolution", "match", "table"]);
    expect(result?.[3]).toBe("Mbl vs Vinchester");
  });

  it("requires a repeated placeholder to match the same text", () => {
    const { pattern } = templateToRegExp(
      "{corpus}/{match}/{match}.parquet.zip",
    );

    expect(pattern.test("kotd4/g1/g1.parquet.zip")).toBe(true);
    expect(pattern.test("kotd4/g1/g2.parquet.zip")).toBe(false);
  });

  it("reports a missing placeholder rather than emitting a broken path", () => {
    expect(() => fillTemplate("{a}/{b}", { a: "x" })).toThrow(/needs a value/);
  });

  it("lists each match once regardless of how many table files it has", () => {
    const paths = [
      ...listing("kotd4/60s", ["m1", "m2"]),
      ...listing("may2026/1s", ["m3"]),
    ];
    const layout = probeLayout({ repo: "r", paths }).layout;
    const matches = matchesFromPaths(layout, paths);
    expect(matches.map((m) => m.match).sort()).toEqual(["m1", "m2", "m3"]);
    expect(matches[0]?.facets).toEqual({ corpus: "kotd4", resolution: "60s" });
  });
});
