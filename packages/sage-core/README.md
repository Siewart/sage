# SAGE CLI

The CLI generates commentary and inspection reports from match descriptors. Set
up the workspace with the [root instructions](../../README.md#run-from-source),
then run the commands below from the repository root.

## Generate commentary

```sh
pnpm gen generate data/ --module base --provider templates
pnpm gen generate "data/Kotd4-Groups S06G3-Mbl vs Vinchester/descriptor.json" --module base --provider templates
```

Paths are resolved from `packages/sage-core/`, and a directory is searched
recursively for `descriptor.json` files. Reports are written as Markdown and JSON
to `packages/sage-core/reports/`.

| Option           | Values or behavior                                                                                       |
| ---------------- | -------------------------------------------------------------------------------------------------------- |
| `--module`       | `all`, `base`, `eventStructuring`, `expertInsights`; defaults to `all`                                   |
| `--provider`     | `templates`, `gemini`, `anthropic`, `openai`; defaults to templates unless configured in the environment |
| `--model`        | Explicit provider model identifier                                                                       |
| `--base-url`     | OpenAI-compatible API URL, including `/v1`                                                               |
| `--backend`      | `duckdb` (default) or `arquero` for the bundled Arrow fixtures                                           |
| `--no-anonymize` | Keep original player names instead of pseudonyms                                                         |

`--module all` runs all four study configurations. Templates need no API key. For
a model provider, pass its identifier with `--model` and set `GEMINI_API_KEY`,
`ANTHROPIC_API_KEY` or `OPENAI_API_KEY`. A local OpenAI-compatible server on
loopback needs no key:

```sh
pnpm gen generate data/ --module base --provider openai --model MODEL_ID --base-url http://localhost:11434/v1
```

Replace `MODEL_ID` with a model installed on your local server. The CLI also
reads `SAGE_REALISER`, `SAGE_MODEL` and `SAGE_BASE_URL` from the environment;
the command-line options take precedence.

## Run study selections

The selections run as tests, which check the generated reports and then remove
them:

```sh
pnpm test:generate                                                            # all study cases
pnpm --filter sage-core test:generate:t1                                      # T1 in all configurations
pnpm --filter sage-core test:generate --testNamePattern T1M2                  # one case
pnpm --filter sage-core test:generate --testNamePattern 'M3 - eventStructuring'  # M3 on all four matches
```

| Configuration | Modules                            |
| ------------- | ---------------------------------- |
| M1            | All modules                        |
| M2            | Base pipeline                      |
| M3            | Base pipeline + event structuring  |
| M4            | Base pipeline + expert insights    |

T1–T4 are the four bundled matches in `data/`. We keep their 60-second Arrow
files so the study results can be traced; the [data note](data/DATA.MD) describes
their limitations. More matches are on the
[Hugging Face dataset](https://huggingface.co/datasets/Siewart/sage).

For the original paper environment, use the [INLG tag](https://github.com/Siewart/sage/tree/INLG)
and its Yarn and Docker instructions.
