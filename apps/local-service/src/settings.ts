import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  settingsUpdateSchema,
  type PublicSettings,
  type Provider,
  type GenerationSettings,
} from "@sage/contracts";
import type { z } from "zod";

export class Settings {
  readonly home: string;
  private file: string;
  private value: {
    dataDirectory: string;
    preferredProvider?: Provider["kind"];
    generation?: GenerationSettings;
    hfToken?: string;
    providers: Record<
      string,
      {
        model: string;
        baseUrl: string;
        apiKey?: string;
        reasoningEffort?: Provider["reasoningEffort"];
        thinkingBudget?: Provider["thinkingBudget"];
        timeoutMs?: number;
      }
    >;
  };
  constructor(
    home = process.env["SAGE_HOME"] ??
      path.join(os.homedir(), ".config", "sage"),
  ) {
    this.home = home;
    this.file = path.join(home, "settings.json");
    fs.mkdirSync(home, { recursive: true, mode: 0o700 });
    const empty = {
      dataDirectory:
        process.env["SAGE_DATA_DIR"] ??
        path.join(os.homedir(), ".cache", "sage"),
      providers: {},
    };
    try {
      this.value = {
        ...empty,
        ...JSON.parse(fs.readFileSync(this.file, "utf8")),
      };
    } catch {
      this.value = empty;
    }
  }
  token() {
    return this.value.hfToken || process.env["HF_TOKEN"];
  }
  provider(kind: string) {
    const value = this.value.providers[kind];
    return {
      model: value?.model ?? "",
      baseUrl: value?.baseUrl ?? "",
      reasoningEffort: value?.reasoningEffort,
      thinkingBudget:
        kind === "gemini"
          ? value?.thinkingBudget === undefined
            ? 0
            : value.thinkingBudget
          : undefined,
      timeoutMs: value?.timeoutMs,
      apiKey:
        value?.apiKey ||
        process.env[
          kind === "gemini"
            ? "GEMINI_API_KEY"
            : kind === "anthropic"
              ? "ANTHROPIC_API_KEY"
              : "OPENAI_API_KEY"
        ],
    };
  }
  publicSettings(): PublicSettings {
    return {
      dataDirectory: this.value.dataDirectory,
      preferredProvider: this.value.preferredProvider,
      generation: this.value.generation,
      hasHfToken: Boolean(this.token()),
      providers: Object.fromEntries(
        ["gemini", "anthropic", "openai"].map((kind) => {
          const value = this.provider(kind);
          return [
            kind,
            {
              model: value.model,
              baseUrl: value.baseUrl,
              reasoningEffort: value.reasoningEffort,
              thinkingBudget: value.thinkingBudget,
              timeoutMs: value.timeoutMs,
              hasApiKey: Boolean(value.apiKey),
            },
          ];
        }),
      ),
    };
  }
  update(input: z.infer<typeof settingsUpdateSchema>): PublicSettings {
    if (input.dataDirectory !== undefined) {
      const directory = path.resolve(input.dataDirectory);
      fs.mkdirSync(directory, { recursive: true });
      this.value.dataDirectory = directory;
    }
    if (input.generation) this.value.generation = input.generation;
    if (input.hfToken !== undefined) this.value.hfToken = input.hfToken;
    if (input.provider) {
      const {
        kind,
        model,
        baseUrl,
        apiKey,
        reasoningEffort,
        thinkingBudget,
        timeoutMs,
      } = input.provider;
      this.value.preferredProvider = kind;
      const previous = this.value.providers[kind];
      this.value.providers[kind] = {
        model,
        baseUrl,
        reasoningEffort,
        thinkingBudget:
          kind === "gemini"
            ? thinkingBudget === undefined
              ? 0
              : thinkingBudget
            : undefined,
        timeoutMs,
        apiKey: apiKey ?? previous?.apiKey,
      };
    }
    const temporary = this.file + ".partial";
    fs.writeFileSync(temporary, JSON.stringify(this.value), { mode: 0o600 });
    fs.renameSync(temporary, this.file);
    fs.chmodSync(this.file, 0o600);
    return this.publicSettings();
  }
}
