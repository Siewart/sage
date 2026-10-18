import { Command, Option } from "clipanion";
import {
  defaultCacheDir,
  fetchMatchFiles,
  listRepoFiles,
  loadLayout,
  matchesFromPaths,
  resolveLayout,
} from "@sage/data/hf/client";
import { fileURLToPath } from "node:url";

const DEFAULT_MANIFEST = fileURLToPath(
  new URL("../../../sage-data/src/default-layout.json", import.meta.url),
);
class DataOptions extends Command {
  manifest = Option.String("--manifest", DEFAULT_MANIFEST);
  facets = Option.Array("--facet", []);
  cache = Option.String("--cache", defaultCacheDir());
  options() {
    return {
      cacheDir: this.cache,
      accessToken: process.env["HF_TOKEN"],
      onProgress: (text: string) => this.context.stderr.write(text + "\n"),
    };
  }
  values() {
    return Object.fromEntries(
      this.facets.map((value) => {
        const at = value.indexOf("=");
        if (at < 1) throw new Error("Use --facet name=value");
        return [value.slice(0, at), value.slice(at + 1)];
      }),
    );
  }
  async execute() {}
}
class ListCommand extends DataOptions {
  static override paths = [["data", "ls"]];
  filter = Option.String("--filter", "");
  limit = Option.String("--limit", "25");
  override async execute() {
    const layout = await resolveLayout(
      loadLayout(this.manifest),
      this.options(),
    );
    const matches = matchesFromPaths(
      layout,
      await listRepoFiles(layout.repo, {
        ...this.options(),
        revision: layout.revision,
      }),
    );
    const facets = this.values();
    const filtered = matches.filter(
      (match) =>
        match.match.toLowerCase().includes(this.filter.toLowerCase()) &&
        Object.entries(facets).every(
          ([key, value]) => match.facets[key] === value,
        ),
    );
    this.context.stdout.write(
      JSON.stringify(
        {
          revision: layout.revision,
          total: filtered.length,
          matches: filtered.slice(
            0,
            Math.max(1, Math.min(500, Number(this.limit))),
          ),
        },
        null,
        2,
      ) + "\n",
    );
  }
}
class PullCommand extends DataOptions {
  static override paths = [["data", "pull"]];
  match = Option.String({ required: true, name: "MATCH" });
  override async execute() {
    const layout = await resolveLayout(
      loadLayout(this.manifest),
      this.options(),
    );
    const result = await fetchMatchFiles(
      layout,
      { ...layout.defaultFacets, ...this.values(), match: this.match },
      this.options(),
    );
    this.context.stdout.write(
      JSON.stringify({ ...result, revision: layout.revision }, null, 2) + "\n",
    );
  }
}
export const DATA_COMMANDS = [ListCommand, PullCommand];
