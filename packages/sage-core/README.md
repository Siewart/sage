# SAGE CLI

The CLI generates commentary and inspection reports from match descriptors. Install
the workspace dependencies using the [root setup instructions](../../README.md#run-from-source),
then run the commands below from the repository root.

## Generate commentary

```sh
pnpm gen generate data/ --module base --provider templates
pnpm gen generate "data/Kotd4-Groups S06G3-Mbl vs Vinchester/descriptor.json" --module base --provider templates
```

Paths are resolved from `packages/sage-core/`. A directory is searched recursively
for `descriptor.json` files. Reports are written as Markdown and JSON under
`packages/sage-core/reports/`.

| Option           | Values or behavior                                                                                       |
| ---------------- | -------------------------------------------------------------------------------------------------------- |
| `--module`       | `all`, `base`, `eventStructuring`, `expertInsights`; defaults to `all`                                   |
| `--provider`     | `templates`, `gemini`, `anthropic`, `openai`; defaults to templates unless configured in the environment |
| `--model`        | Explicit provider model identifier                                                                       |
| `--base-url`     | OpenAI-compatible API URL, including `/v1`                                                               |
| `--backend`      | `duckdb` (default) or `arquero` for the bundled Arrow fixtures                                           |
| `--no-anonymize` | Keep original player names instead of pseudonyms                                                         |

`--module all` runs all four study configurations. Templates require no API key.
For a model provider, pass its identifier with `--model` and set the corresponding
`GEMINI_API_KEY`, `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` environment variable. A
local OpenAI-compatible server on loopback does not require a key:

```sh
pnpm gen generate data/ --module base --provider openai --model MODEL_ID --base-url http://localhost:11434/v1
```

Replace `MODEL_ID` with a model installed in your local server. The CLI also reads
`SAGE_REALISER`, `SAGE_MODEL` and `SAGE_BASE_URL` from the environment. Command-line
provider, model and URL options override the corresponding environment values.

## Run study selections

```sh
pnpm test:generate
pnpm --filter sage-core test:generate:t1
pnpm --filter sage-core test:generate --testNamePattern T1M2
pnpm --filter sage-core test:generate --testNamePattern 'M3 - eventStructuring'
```

These run all study cases, all configurations for T1, T1M2, or M3 across all four
matches. Tests check the generated reports and remove their temporary files.

| Configuration | Modules           |
| ------------- | ----------------- |
| M1            | All modules       |
| M2            | Base pipeline     |
| M3            | Event structuring |
| M4            | Expert insights   |

T1–T4 are the four bundled matches in `data/`. Their 60-second Arrow files are
retained for tracing the study results; the [data note](data/DATA.MD) describes
their limitations. Additional matches are available from the
[Hugging Face dataset](https://huggingface.co/datasets/Siewart/sage).

For the original paper environment, use the preserved
[INLG tag](https://github.com/Siewart/sage/tree/INLG) and its Yarn/Docker
instructions.
