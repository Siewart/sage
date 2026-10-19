# SAGE: Age of Empires II commentary

SAGE generates match commentary from exported Age of Empires II game data. The
desktop app downloads matches, processes them locally with DuckDB, and lets you
inspect the facts, planning steps and prompts behind each commentary.

[Download SAGE](https://github.com/Siewart/sage/releases/latest) ·
[Dataset](https://huggingface.co/datasets/Siewart/sage) ·
[Paper version](https://github.com/Siewart/sage/releases/tag/INLG) ·
[Discord](https://discord.gg/53vnjZ7WhS)

## Install

The [latest release](https://github.com/Siewart/sage/releases/latest) includes
installers for macOS Apple Silicon and Windows x64. The app includes its local
runtime; you do not need Node.js, DuckDB or a terminal to use it.

| Platform                                 | Installation                                                                 |
| ---------------------------------------- | ---------------------------------------------------------------------------- |
| macOS Apple Silicon, macOS 13.5 or newer | Open the DMG, drag SAGE into Applications, then open SAGE from Applications. |
| Windows x64                              | Run the installer, then open SAGE from the Start menu.                       |

The macOS app is ad-hoc signed and is not notarized by Apple. If macOS says it
cannot verify SAGE and offers **Move to Trash** or **Done**:

1. Click **Done**.
2. Open **System Settings → Privacy & Security**.
3. Under **Security**, find the SAGE message and click **Open Anyway**.
4. Confirm **Open** and authenticate if prompted.

See [Apple's instructions](https://support.apple.com/en-ie/102445). The Windows
installer is unsigned. Platform details and download sizes are listed in the
release notes.

## Use SAGE

1. Choose a match from the dataset browser. **Hugging Face · May 2026** is the
   default source; **Local / bundled 60s** provides four example matches.
2. Download the match if needed, then generate commentary. Templates work offline
   without a model or API key.
3. Follow the commentary and current stage. Expand the pipeline inspector to see
   the data and decisions for a realization.

The gear button opens Settings. Saved runs can be pinned, restored from Trash or
permanently deleted. Settings also contains a download manager for removing
cached match files.

### Models

SAGE supports Gemini, OpenAI, Anthropic and local OpenAI-compatible servers. In
Settings, select a provider, enter its model identifier and save the model
settings. Hosted providers require your own API key.

For **Ollama**, start Ollama with a downloaded model, select **OpenAI** in SAGE,
and set the Base URL to `http://localhost:11434/v1`. Use the exact name of the
installed model. A local Ollama server does not require an API key. Increase
**Model request timeout** if model loading or generation takes longer than the
configured limit.

Gemini's thinking budget defaults to **0**, as used in the research. This requests
thinking off where the model supports it; provider-default thinking is a separate
setting.

### Data and storage

The repository includes four matches at 60-second resolution. The larger
[Hugging Face corpus](https://huggingface.co/datasets/Siewart/sage) also provides
1-second data. Downloads are stored in a local directory chosen in Settings;
DuckDB processes the files on your computer.

Download sizes refer to compressed Arrow archives or Parquet files. Decoded
tables need more space, so allow additional memory and temporary disk space for
processing. Analysis ticks are separate from the dataset's snapshot resolution.

You can save your own Hugging Face token in Settings. Model keys and the Hugging
Face token are stored in local settings. Hosted model requests send the prepared
facts and previous commentary to the selected provider.

## Run from source

Use **Node.js 24.13.1** and **pnpm 9.15.9**. From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the local URL printed by Next.js, normally `http://127.0.0.1:3000`, and pair
with the local service using the address and code printed in the terminal. This
starts both the interface and processing service on your machine.

For a production build:

```sh
pnpm build
pnpm start
```

Useful checks:

```sh
pnpm typecheck
pnpm --filter @sage/data test
pnpm --filter @sage/llm test
pnpm --filter @sage/local-service test
pnpm --filter sage-core test:data
pnpm test:generate
```

### CLI and study selections

The CLI remains available alongside the desktop app:

```sh
pnpm gen generate data/ --module base --provider templates
```

It writes Markdown and JSON reports to `packages/sage-core/reports/`. DuckDB is
the default backend; `--backend arquero` supports the bundled Arrow fixtures.
See the [CLI reference](packages/sage-core/README.md) for model options and
individual study selections.

```sh
pnpm test:generate
pnpm --filter sage-core test:generate:t1
pnpm --filter sage-core test:generate --testNamePattern T1M2
```

These run all T1–T4 × M1–M4 cases, T1 across all configurations, or T1M2,
respectively. Generation tests remove their temporary reports after checking
them.

## Research and paper results

The [INLG release](https://github.com/Siewart/sage/releases/tag/INLG) preserves
the version used for the paper results at
[`f4b2655`](https://github.com/Siewart/sage/commit/f4b26555ce4c0c3647b0e3acf1cd165e340e2334).
Use that tag's code, Yarn toolchain and Docker instructions to reproduce the
paper environment. The DuckDB backend and desktop app are later work.

The research materials remain in this repository:

| Location                           | Contents                                              |
| ---------------------------------- | ----------------------------------------------------- |
| [paper/](paper/)                   | INLG paper source and [PDF](paper/main.pdf)           |
| [thesis/](thesis/)                 | Thesis source and [PDF](thesis/latex/.build/main.pdf) |
| [studies/prelim/](studies/prelim/) | Preliminary survey, R analysis and results            |
| [studies/eval/](studies/eval/)     | Evaluation study, R analysis and results              |

Each study has its own README with Docker and R instructions. From `paper/` or
`thesis/`, `pnpm build` builds the document and `pnpm dev` watches for changes.
These commands require TeX Live and `latexmk`.

Language models are used for commentary realization and have also assisted with
code and documentation. The paper and thesis describe their role in the research.

## Repository layout

| Location                     | Purpose                                        |
| ---------------------------- | ---------------------------------------------- |
| `apps/desktop/`              | Tauri desktop app and packaging                |
| `apps/web/`                  | Next.js interface                              |
| `apps/local-service/`        | Jobs, model settings, downloads and saved runs |
| `packages/sage-core/`        | Commentary pipeline and study CLI              |
| `packages/sage-data/`        | DuckDB queries, dataset layouts and downloads  |
| `packages/sage-llm/`         | Model providers and prompt execution           |
| `packages/contracts/`        | Shared schemas and service API                 |
| `packages/ui/`               | Shared components and styles                   |
| `packages/simplenlg-core/`   | SimpleNLG TypeScript port                      |
| `packages/simplenlg-unwrap/` | SimpleNLG XML CLI wrapper                      |

## Citation

For the pipeline:

```bibtex
@inproceedings{vanWingerden2026sage,
  author    = {van Wingerden, Siewart and Theune, Mari\"et and Gatti, Lorenzo},
  title     = {From Full Game State to Live Commentary: A Data-to-Text Pipeline and Corpus for {Age of Empires II}},
  booktitle = {Proceedings of the International Natural Language Generation Conference (INLG 2026)},
  year      = {2026},
  note      = {To appear},
}
```

For the dataset:

```bibtex
@dataset{VanWingerden2026sage,
  author    = {van Wingerden, S.},
  title     = {{SAGE} Dataset: Age of Empires {II} {DE} Match Analytics},
  year      = {2026},
  publisher = {Hugging Face},
  doi       = {10.57967/hf/10202},
  url       = {https://huggingface.co/datasets/Siewart/sage},
}
```

## License

The code is [MIT](LICENSE), except for the [SimpleNLG port](packages/simplenlg-core/LICENSE),
which is MPL 2.0. The paper is [CC BY 4.0](paper/LICENSE.md), with exclusions for
the ACL style files and game screenshot described in its license.

The dataset is released separately under CC0, except for fields derived from game
content, which remain subject to Xbox's Game Content Usage Rules.
