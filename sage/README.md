# SAGE — Semantic Abstraction & Generation from Events

A data-to-text pipeline that generates live match commentary for Age of Empires II from CaptureAge game data. Built with TypeScript and Yarn workspaces.

## Packages

```
packages/
  sage-core/         main pipeline — signal analysis, interpretation, planning, realization
  simplenlg-core/    TypeScript port of SimpleNLG, used for location name generation
  simplenlg-unwrap/  CLI wrapper around simplenlg-core for XML-based realisation
```

## Setup

Requires Node 22 and Yarn 4. If you have [Corepack](https://nodejs.org/api/corepack.html) enabled, Yarn is managed automatically via the `packageManager` field in `package.json`.

```bash
corepack enable        # once, if not already done
yarn install
yarn build
```

## Environment variables

Create `.env.local` in this directory (it is gitignored):

```
GEMINI_API_KEY=your_key_here

# Remove this line or set to false to enable LLM calls.
# DISABLE_LLM=false
```

`DISABLE_LLM` defaults to **true** — the pipeline runs fully without any API calls and realisers fall back to string templates. Set `DISABLE_LLM=false` and supply a `GEMINI_API_KEY` to get natural language output from the LLM realiser. The free Gemini tier may hit rate limits for full runs; a paid key is recommended.

## Running the pipeline

```bash
# run all module configs on all datasets in data/
yarn workspace sage-core gen generate data/

# run on a single dataset
yarn workspace sage-core gen generate "data/Kotd4-Groups S06G3-Mbl vs Vinchester/descriptor.json"

# run only one module config
yarn workspace sage-core gen generate data/ --module base
# modules: all | base | eventStructuring | expertInsights

# player names are anonymized to pseudonyms by default; opt out to keep originals
yarn workspace sage-core gen generate data/ --no-anonymize

yarn workspace sage-core gen generate --help
```

Reports are written to `packages/sage-core/reports/` as Markdown and JSON.

## Running with Docker

```bash
# build
docker build -t sage-core .

# run — mount your data and reports directories, pass env vars from .env.local
docker run --rm \
  -v "$(pwd)/packages/sage-core/data:/app/packages/sage-core/data" \
  -v "$(pwd)/packages/sage-core/reports:/app/packages/sage-core/reports" \
  --env-file .env.local \
  sage-core generate data/

# override module config
docker run --rm \
  -v "$(pwd)/packages/sage-core/data:/app/packages/sage-core/data" \
  -v "$(pwd)/packages/sage-core/reports:/app/packages/sage-core/reports" \
  --env-file .env.local \
  sage-core generate data/ --module base
```

**`.env.local` for Docker** — the same file used for local dev:
```
GEMINI_API_KEY=your_key_here
DISABLE_LLM=false
```
`DISABLE_LLM` defaults to true inside the container as well; uncomment to enable LLM calls.

## Tests

```bash
# generate reports for all datasets and module configs (requires all data to be present)
yarn workspace sage-core test:generate

# run only text 1
yarn workspace sage-core test:generate:t1
```


## Data

Game data lives in `packages/sage-core/data/` in Apache Arrow format. Each match has its own subdirectory with a `descriptor.json` pointing to the Arrow files. The included dataset is Group Stage round 6, game 3 from King of the Desert IV (Mbl vs Vinchester).

The pipeline reads the descriptor, loads the Arrow tables, then streams events through the pipeline stages. Snapshot data uses 60-second windows; the `binTimes` array in the descriptor maps window IDs to game time ranges.

## Additional files

- `packages/sage-core/src/` — pipeline source: `events/`, `aoe2/`, `gemini/`, `templates/`, `fuzzy/`
- `packages/sage-core/src/gemini/prompts.ts` — all LLM prompt templates
- `packages/sage-core/src/templates/study/` — the full pipeline implementation used for the study
- `packages/simplenlg-core/src/` — SimpleNLG TypeScript port
- `yarn.lock` — exact dependency versions with integrity checksums (yarn berry format), for reproducible installs
