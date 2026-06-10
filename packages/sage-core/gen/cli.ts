import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { Cli, Command, Option } from "clipanion";

import { doFromDataSet } from "./study/utils.js";
import {
  DATASET_CONFIGS,
  MODULE_CONFIGS,
  ModuleConfig,
  makeDataSet,
  makeDataSetFromPath,
} from "./study/init.js";

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function findDescriptors(target: string): string[] {
  const stat = fs.statSync(target, { throwIfNoEntry: false });
  if (!stat) return [];
  if (stat.isFile()) return [target];

  const results: string[] = [];
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    const full = path.join(target, entry.name);
    if (entry.isDirectory()) {
      results.push(...findDescriptors(full));
    } else if (entry.name === "descriptor.json") {
      results.push(full);
    }
  }
  return results;
}

class GenerateCommand extends Command {
  static override paths = [["generate"]];

  static override usage = Command.Usage({
    description: "Generate NLG study reports",
    details: `
      Runs the NLG pipeline for one or more datasets, writing markdown and JSON
      reports to the reports/ directory.

      DATA can be a path to a descriptor.json file or a folder. When a folder is
      given, all descriptor.json files found recursively inside it are processed.
    `,
    examples: [
      ["Run all module configs on a single dataset", "generate data/my-game/descriptor.json"],
      ["Run all datasets in the data/ folder", "generate data/"],
      ["Run only the base module on a folder of datasets", "generate data/ --module base"],
    ],
  });

  data = Option.String({ required: true, name: "DATA" });

  module = Option.String("--module", "all", {
    description: "Module config: all | base | eventStructuring | expertInsights",
  });

  anonymize = Option.Boolean("--anonymize", true, {
    description:
      "Replace player names with anonymized pseudonyms (default; use --no-anonymize to keep the original in-game names). Player trivia always comes from playerData.",
  });

  async execute() {
    process.chdir(PKG_ROOT);
    fs.mkdirSync("reports", { recursive: true });

    const moduleArg = this.module as ModuleConfig | "all";
    const validModules: (ModuleConfig | "all")[] = ["all", "base", "eventStructuring", "expertInsights"];
    if (!validModules.includes(moduleArg)) {
      this.context.stderr.write(`Error: --module must be one of: ${validModules.join(", ")}\n`);
      return 1;
    }

    const descriptors = findDescriptors(path.resolve(PKG_ROOT, this.data));
    if (descriptors.length === 0) {
      this.context.stderr.write(`No descriptor.json files found at: ${this.data}\n`);
      return 1;
    }

    const modules = moduleArg === "all"
      ? MODULE_CONFIGS
      : MODULE_CONFIGS.filter((m) => m.config === moduleArg);

    for (const descriptorPath of descriptors) {
      const cfg = DATASET_CONFIGS.find(
        (c) => path.resolve(PKG_ROOT, c.descriptorPath) === descriptorPath,
      );
      const dataSet = cfg
        ? makeDataSet(cfg, this.anonymize)
        : (makeDataSetFromPath(descriptorPath) as ReturnType<typeof makeDataSet>);
      const label = dataSet.name;

      if (!cfg) {
        this.context.stderr.write(
          `Warning: "${label}" is not in DATASET_CONFIGS — player names and trivia will be omitted.\n`,
        );
      }

      for (const mod of modules) {
        const id = cfg ? `${cfg.key}${mod.id}` : mod.id;
        this.context.stdout.write(`Generating ${label} — ${mod.config} (${id})...\n`);
        await doFromDataSet(dataSet, id, mod.config);
      }
    }

    return 0;
  }
}

const cli = new Cli({
  binaryLabel: "sage-core",
  binaryName: "yarn gen",
  binaryVersion: "0.0.0",
});

cli.register(GenerateCommand);
cli.runExit(process.argv.slice(2));
