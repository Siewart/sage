# 1001 Tales of Competitive Age of Empires II

Everything for thesis on generating live text commentary for Age of Empires II matches: the pipeline that turns exported CaptureAge game data into commentary (`packages/sage-core/`), the R analysis for the two user studies (`studies/`), and the written thesis itself (`thesis/`). The additional datasets can be found on [Hugging Face](https://huggingface.co/datasets/Siewart/sage).

## Layout

```
packages/
  sage-core/         the data-to-text pipeline (TypeScript)
  simplenlg-core/    TypeScript port of SimpleNLG (location-name generation)
  simplenlg-unwrap/  CLI wrapper around simplenlg-core
studies/   R analysis for the two studies
  prelim/    preliminary survey - which bits of commentary are worth saying
  eval/      main evaluation - a 2x2 within-subject rating study
thesis/    the thesis (LaTeX)
```

Everything is one top-level Yarn workspace (Yarn 4.9.3, Node 24) - the TypeScript packages, the R studies, and the thesis - so `yarn lint` and `yarn format` reach them all from the root. The sage pipeline's reproducible runtime is its Docker image, which pins Node 22 and Yarn 4.6.0, the toolchain it was developed and locked against.

## Running each part

### `packages/sage-core` pipeline

Local dev runs from the top-level workspace (Node 24, Yarn 4.9.3). Corepack reads the pinned Yarn from `packageManager`, so you do not install Yarn yourself; installs are immutable against the committed `yarn.lock`.

```sh
corepack enable        # once, if you have not already
yarn install           # from the repo root
yarn workspace sage-core test:generate   # regenerate the reports for all four matches
```

For a fully reproducible run, build the Docker image (Node 22, Yarn 4.6.0) from the repo root:

```sh
docker build -f packages/sage-core/Dockerfile -t sage-core .
```

The LLM realiser is off by default (`DISABLE_LLM=true`), so this runs end to end with no API key - the realisers fall back to string templates to outline the information structure. See `packages/sage-core/README.md` for more information.

### `/studies` R analysis scripts

Each study is a set of plain numbered R scripts that `run_all.R` runs in order. The reproducible way to run them is the Docker image, which pins R and every package (see "Reproducible builds" below):

```sh
cd studies/eval        # or studies/prelim
yarn docker:build
yarn docker:run        # writes to data/clean/ and output/
yarn docker:power      # eval only: also runs the slow power simulation
```

If you happen to have R 4.5.1 with the right packages, you can skip Docker:

```sh
Rscript analysis/run_all.R
```

The numbers reported in the thesis are the ones from the Docker images. Running on a different setup can shift the last digit or two of the mixed-model fits (optimizer wobble) without changing any of the conclusions.

### `/thesis` LaTeX

```sh
cd thesis
yarn build        # latexmk -> main.pdf
yarn dev          # latexmk -pvc, rebuilds on save
yarn lint         # chktex
```

Needs a TeX Live install with `latexmk` (and `chktex` / `tex-fmt` for lint and format).

## Reproducible builds

- **Node and Yarn.** The exact Yarn version is pinned in each `packageManager` field and run through Corepack; the Node version sits in `engines`. Installs are immutable (`enableImmutableInstalls: true`), so `yarn install` fails rather than quietly bump a dependency, and the committed `yarn.lock` reproduces the dependency tree exactly. The top-level workspace uses Yarn 4.9.3 and Node 24; the sage pipeline's Docker image pins Yarn 4.6.0 and Node 22 - the toolchain it was developed and locked against.
- **R.** Both studies build on `rocker/r-ver:4.5.1`, which fixes the R version. `prelim` pins each package to an explicit version with `remotes::install_version`; `eval` installs from a dated Posit Package Manager snapshot (`2025-08-01`), which pins the whole set at once. The Docker build is the environment the reported results come from.
- **Data.** `sage-core` ships four matches at one-minute resolution under `packages/sage-core/data/`; the studies ship their cleaned inputs and the output tables they produce. Updated versions of the dataset are hosted on [Hugging Face](https://huggingface.co/datasets/Siewart/sage).

## Citation

If you use this code please cite the thesis using this:
```
@mastersthesis{VanWingerden2026,
  month    = {June},
  author   = {van Wingerden, S.},
  year     = {2026},
  school   = {University of Twente},
  address  = {Enschede},
  type     = {Thesis},
  title    = {One Thousand and One Tales: Automated Age of Empires {II} eSports Reports from Raw Real-time Game Data},
  url      = {https://purl.utwente.nl/essays/109934},
}
```

**APA:** van Wingerden, S. (2026). _One Thousand and One Tales: Automated Age of Empires II eSports Reports from Raw Real-time Game Data_ (Master's thesis, University of Twente, Enschede). https://purl.utwente.nl/essays/109934

## A note on AI use.

LLMs were used both inside the pipeline (Gemini, as one of the realisers) and as a writing and coding assistant while putting the rest together. Where it matters for a result it is called out in the relevant README or thesis chapter. All design choices and interpretations were human made. For example this README was written by AI, but all contents have been predecided, checked, and edited by a human.
