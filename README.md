# SAGE: Age of Empires II commentary

[![Discord](https://img.shields.io/badge/Discord-join%20the%20chat-5865F2?logo=discord&logoColor=white)](https://discord.gg/53vnjZ7WhS)

SAGE turns exported Age of Empires II game data into match commentary. The
desktop app downloads matches, processes them on your computer with DuckDB, and
shows the facts, planning steps and prompts behind each piece of commentary. This
repository also holds the INLG 2026 paper, the thesis and the R analysis for both
user studies.

[Download SAGE](https://github.com/Siewart/sage/releases/latest) ·
[Dataset](https://huggingface.co/datasets/Siewart/sage) ·
[Paper code (INLG tag)](https://github.com/Siewart/sage/releases/tag/INLG) ·
[Discord](https://discord.gg/53vnjZ7WhS)

## Install

The [latest release](https://github.com/Siewart/sage/releases/latest) has
installers for macOS on Apple Silicon (macOS 13.5 or newer) and Windows x64.
Everything SAGE needs is bundled, so you do not need Node.js, DuckDB or a
terminal. On macOS, open the DMG, drag SAGE into Applications and open it from
there. On Windows, run the installer and open SAGE from the Start menu.

The macOS app is ad-hoc signed and not notarized by Apple, so macOS blocks the
first launch. If it says it cannot verify SAGE and offers **Move to Trash** or
**Done**:

1. Click **Done**.
2. Open **System Settings → Privacy & Security**.
3. Under **Security**, find the SAGE message and click **Open Anyway**.
4. Confirm **Open** and authenticate if prompted.

Apple describes this in [its support article](https://support.apple.com/en-us/102445).
The Windows installer is unsigned. Download sizes are in the release notes.

## Use SAGE

1. Pick a match in the dataset browser. The default source is
   **Hugging Face · May 2026**; **Local / bundled 60s** has four example matches.
2. Download the match if needed and generate commentary. Templates work offline,
   without a model or API key.
3. Follow the commentary and the current pipeline stage, and expand the pipeline
   inspector to see the data and decisions behind a realization.

The gear button opens Settings. Saved runs can be pinned, moved to Trash and
restored, or deleted for good, and the download manager in Settings removes
cached match files.

### Models

SAGE works with Gemini, OpenAI, Anthropic and local OpenAI-compatible servers. In
Settings, pick a provider, enter the model identifier and save. Hosted providers
need your own API key.

For **Ollama**, start Ollama with a downloaded model, choose **OpenAI** in SAGE
and set the Base URL to `http://localhost:11434/v1`, using the exact name of the
installed model. A local Ollama server needs no API key. If loading or generating
takes longer than the limit, raise **Model request timeout**.

Gemini's thinking budget defaults to **0**, the value used in the research, which
turns thinking off on models that allow it. Provider-default thinking is a
separate setting.

### Data

The repository includes four matches at 60-second resolution. The
[Hugging Face corpus](https://huggingface.co/datasets/Siewart/sage) has more
matches and also 1-second data. Downloads go to a folder you choose in Settings,
and DuckDB processes them on your computer.

Download sizes are for the compressed Arrow archives and Parquet files. Decoded
tables are much larger, so leave room in memory and in temporary disk space.
Analysis ticks are set separately from the dataset's snapshot resolution.

You can add your own Hugging Face token in Settings; it is stored in local
settings together with the model keys. When you use a hosted model, SAGE sends
the prepared facts and the previous commentary to that provider.

## Run from source

Use **Node.js 24.13.1** and **pnpm 9.15.9**. From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

This starts the interface and the processing service. Open the URL that Next.js
prints, normally `http://127.0.0.1:3000`, and pair it with the local service using
the address and code shown in the terminal.

For a production build, run `pnpm build` and then `pnpm start`. To check your
changes:

```sh
pnpm typecheck
pnpm --filter @sage/data test
pnpm --filter @sage/llm test
pnpm --filter @sage/local-service test
pnpm --filter sage-core test:data
```

### Command line

The original CLI still runs next to the desktop app:

```sh
pnpm gen generate data/ --module base --provider templates
```

It writes Markdown and JSON reports to `packages/sage-core/reports/`. DuckDB is
the default backend; `--backend arquero` runs the bundled Arrow fixtures. The
[CLI reference](packages/sage-core/README.md) covers model options.

The study selections run as tests, which check the generated reports and then
remove them:

```sh
pnpm test:generate                                            # all T1–T4 × M1–M4 cases
pnpm --filter sage-core test:generate:t1                      # T1 in all four configurations
pnpm --filter sage-core test:generate --testNamePattern T1M2  # one case
```

## Research

The [INLG release](https://github.com/Siewart/sage/releases/tag/INLG) at
[`f4b2655`](https://github.com/Siewart/sage/commit/f4b26555ce4c0c3647b0e3acf1cd165e340e2334)
is the code behind the paper results. To reproduce them, use that tag's code,
Yarn toolchain and Docker instructions; the DuckDB backend and the desktop app
came later.

| Location                           | Contents                                              |
| ---------------------------------- | ----------------------------------------------------- |
| [paper/](paper/)                   | INLG paper source and [PDF](paper/main.pdf)           |
| [thesis/](thesis/)                 | Thesis source and [PDF](thesis/latex/.build/main.pdf) |
| [studies/prelim/](studies/prelim/) | Preliminary survey, R analysis and results            |
| [studies/eval/](studies/eval/)     | Evaluation study, R analysis and results              |

Each study folder has a README with its Docker and R instructions. In `paper/` or
`thesis/`, `pnpm build` builds the PDF and `pnpm dev` rebuilds on save. Both need
TeX Live with `latexmk`.

### A note on AI use

Language models realize the commentary in the pipeline and were also used as
coding and writing assistants. All design choices and interpretations were made
by people. The paper and thesis describe where models were used in the research.

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

**APA:** van Wingerden, S., Theune, M., & Gatti, L. (2026). _From full game state
to live commentary: A data-to-text pipeline and corpus for Age of Empires II_. In
Proceedings of the International Natural Language Generation Conference (INLG 2026).

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
which is MPL 2.0 like SimpleNLG itself. The paper is [CC BY 4.0](paper/LICENSE.md),
since MIT is a software license and does not fit a written work; the ACL style
files and the game screenshot are excluded, as its license describes.

The dataset is released separately under CC0, except for fields derived from game
content, which remain subject to Xbox's Game Content Usage Rules.
