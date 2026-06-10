# Prelim study analysis

R scripts for the preliminary survey. The survey asked viewers how relevant
different parts of commentary are to following a match (the "C" items) and a few
general questions about how they watch and what they want from a summary (the
"G" items).

The scripts were written and run piece by piece in RStudio, then collected here
and numbered so they run start to finish. GPT-4o was used to help tidy and stitch
the snippets together and checked the combined output against what I had before.

## Scripts

- `analysis/01_load_clean.R` - read the raw export, recode the Likert answers,
  drop identifiers, write the clean wide/long files.
- `analysis/02_models_prelim.R` - per-item mixed models and the EMM / BH tables.
- `analysis/03_diagnostics.R` - residual Q-Q and histogram plots.
- `analysis/04_tables_figures.R` - the reportable tables and item rankings.

## Running it

```sh
Rscript analysis/run_all.R
```

Or in Docker (pinned package versions):

```sh
yarn docker:build
yarn docker:run
```

Outputs land in `data/clean/` and `output/`.
