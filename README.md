# SAGE: Age of Empires II commentary

SAGE turns exported game state into commentary. The desktop app downloads match
data to your computer, processes it with DuckDB and shows the pipeline steps and
commentary for each realization.

> **Paper results:** use the preserved [INLG tag](https://github.com/Siewart/sage/tree/INLG)
> at [`f4b2655`](https://github.com/Siewart/sage/commit/f4b26555ce4c0c3647b0e3acf1cd165e340e2334).
> Its code, study materials and original setup instructions are the paper baseline.
> The DuckDB, Next.js and desktop work on `main` is subsequent development.

## Desktop app

The end-user workflow is **download SAGE → install it → open the app**. Tauri
starts the private local service and opens the Next.js interface automatically;
users need no terminal, Node, pnpm or pairing code. Both UI and data processing
run locally. New 1-second matches are downloaded into the user's data directory.
Public installers have not been released yet. Local macOS Apple Silicon previews
are ad-hoc signed and are not notarized.

The commands below are for developers working from a source checkout.

## Run from source

Use **pnpm 9.15.9 + Node 24.13.1**. Run `pnpm install --frozen-lockfile`, then `pnpm dev`; open http://127.0.0.1:3000 and pair using the terminal code. For a production local build, run `pnpm build` then `pnpm start`.

The four committed 60-second matches remain in the repository. Larger 1-second
matches are downloaded into a local cache. Templates work offline; cloud model
providers and local OpenAI-compatible servers are supported.

The desktop app runs both the UI and processing locally. A hosted Next.js UI can
use the paired local service, but deployed HTTPS-to-loopback behavior still needs
browser qualification.

For a local macOS preview installer, install Rust and the Tauri build prerequisites,
commit your source changes, then run `pnpm desktop:package`. The packager uses a
clean source export and writes the DMG, checksum and privacy report under
`apps/desktop/release/<commit>/`. Allow several GB of temporary disk space.

[![Discord](https://img.shields.io/badge/Discord-join%20the%20chat-5865F2?logo=discord&logoColor=white)](https://discord.gg/53vnjZ7WhS)

Everything for thesis on generating live text commentary for Age of Empires II matches: the pipeline that turns exported CaptureAge game data into commentary (`packages/sage-core/`), the R analysis for the two user studies (`studies/`), the INLG paper (`paper/`), and the written thesis itself (`thesis/`). The additional datasets can be found on [Hugging Face](https://huggingface.co/datasets/Siewart/sage).

## Layout

```
packages/
  contracts/        shared runtime and UI schemas
  sage-core/         the data-to-text pipeline (TypeScript)
  sage-data/         native DuckDB, datasets and downloads
  sage-llm/          templates and model providers
  simplenlg-core/    TypeScript port of SimpleNLG (location-name generation)
  simplenlg-unwrap/  CLI wrapper around simplenlg-core
  ui/               shared components and styles
apps/
  web/              Next.js inspector
  local-service/    local jobs, credentials, saved runs and DuckDB
  desktop/          Tauri app and installer packaging
studies/   R analysis for the two studies
  prelim/    preliminary survey - which bits of commentary are worth saying
  eval/      main evaluation - a 2x2 within-subject rating study
paper/     the INLG 2026 paper (LaTeX)
thesis/    the thesis (LaTeX)
```

The current workspace uses pnpm and Turborepo. R studies and LaTeX sources remain
available, with their own toolchain requirements. Use the INLG tag's Yarn and
Docker instructions when reproducing the paper environment.

## Running each part

### `packages/sage-core` pipeline

Run the original CLI and study selections from the pnpm workspace:

```sh
pnpm test:generate                                # all T1–T4 × M1–M4 cases
pnpm --filter sage-core test:generate:t1            # T1 across all four configurations
pnpm --filter sage-core test:generate --testNamePattern 'M3 - eventStructuring'
pnpm --filter sage-core test:generate --testNamePattern T1M2
pnpm gen generate data/ --module base --provider templates
```

The test selections verify generation and remove their temporary reports. The CLI
writes Markdown and JSON files to `packages/sage-core/reports/`. M1 enables all
modules, M2 uses the base pipeline, M3 adds event structuring and M4 adds expert
insights. `--backend arquero` remains available for the bundled Arrow fixtures;
DuckDB is the default. Templates need no model API key.

The historical paper Dockerfile and Yarn lockfile are retained. Build that
environment from the [INLG source](https://github.com/Siewart/sage/tree/INLG),
using its original instructions.

### `/studies` R analysis scripts

Each study is a set of plain numbered R scripts that `run_all.R` runs in order. The reproducible way to run them is the Docker image, which pins R and every package (see "Reproducible builds" below):

```sh
cd studies/eval        # or studies/prelim
pnpm docker:build
pnpm docker:run        # writes to data/clean/ and output/
pnpm docker:power      # eval only: also runs the slow power simulation
```

If you happen to have R 4.5.1 with the right packages, you can skip Docker:

```sh
Rscript analysis/run_all.R
```

The numbers reported in the thesis are the ones from the Docker images. Running on a different setup can shift the last digit or two of the mixed-model fits (optimizer wobble) without changing any of the conclusions.

### `/paper` LaTeX

```sh
cd paper
pnpm build        # latexmk -> main.pdf
pnpm dev          # latexmk -pvc, rebuilds on save
pnpm lint         # chktex
```

The camera-ready for the INLG paper cited below. `main.pdf` is committed, so the
built paper is there without a TeX install; the other build products are not.

### `/thesis` LaTeX

```sh
cd thesis
pnpm build        # latexmk -> .build/main.pdf
pnpm dev          # latexmk -pvc, rebuilds on save
pnpm lint         # chktex
```

Needs a TeX Live install with `latexmk` (and `chktex` / `tex-fmt` for lint and format).

## Reproducible builds

- **Paper runtime.** The preserved INLG tag pins the original Yarn toolchain and lockfile. Its pipeline Docker image uses Node 22 and Yarn 4.6.0. Use that version for the published results.
- **Current runtime.** Node 24.13.1 and pnpm 9.15.9 use the committed `pnpm-lock.yaml`; install with `--frozen-lockfile`. Local macOS packaging exports committed source and writes a checksum and privacy report alongside the installer.
- **R.** Both studies build on `rocker/r-ver:4.5.1`, which fixes the R version. `prelim` pins each package to an explicit version with `remotes::install_version`; `eval` installs from a dated Posit Package Manager snapshot (`2025-08-01`), which pins the whole set at once. The Docker build is the environment the reported results come from.
- **Data.** `sage-core` ships four matches at one-minute resolution under `packages/sage-core/data/`; the studies ship their cleaned inputs and the output tables they produce. Updated versions of the dataset are hosted on [Hugging Face](https://huggingface.co/datasets/Siewart/sage).

## License

The code is MIT (see `LICENSE`), with two exceptions:

- `paper/` is [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) - MIT is a
  software license and does not fit a written work. The ACL style files and the game
  screenshot in that directory are excluded; see `paper/LICENSE.md`.
- `packages/simplenlg-core/` is MPL 2.0, inherited from SimpleNLG upstream (see
  `packages/simplenlg-core/LICENSE`).

The dataset is released separately to the public domain (CC0), except fields derived
from game content, which remain subject to Xbox's Game Content Usage Rules.

## Citation

If you use this code please cite the INLG paper:

```
@inproceedings{vanWingerden2026sage,
  author    = {van Wingerden, Siewart and Theune, Mari\"et and Gatti, Lorenzo},
  title     = {From Full Game State to Live Commentary: A Data-to-Text Pipeline and Corpus for {Age of Empires II}},
  booktitle = {Proceedings of the International Natural Language Generation Conference (INLG 2026)},
  year      = {2026},
  note      = {To appear},
}
```

**APA:** van Wingerden, S., Theune, M., & Gatti, L. (2026). _From full game state to live commentary: A data-to-text pipeline and corpus for Age of Empires II_. In Proceedings of the International Natural Language Generation Conference (INLG 2026).

For the dataset itself:

```
@dataset{VanWingerden2026sage,
  author    = {van Wingerden, S.},
  title     = {{SAGE} Dataset: Age of Empires {II} {DE} Match Analytics},
  year      = {2026},
  publisher = {Hugging Face},
  doi       = {10.57967/hf/10202},
  url       = {https://huggingface.co/datasets/Siewart/sage},
}
```

## A note on AI use.

LLMs were used both inside the pipeline (Gemini, as one of the realisers) and as a writing and coding assistant while putting the rest together. Where it matters for a result it is called out in the relevant README or thesis chapter. All design choices and interpretations were human made. For example this README was written by AI, but all contents have been predecided, checked, and edited by a human.

Saved runs support pins, Trash and Restore. Browse datasets above the commentary,
follow the current stage, or expand the pipeline inspector to examine a result.
Model and analysis options are saved in Settings.
