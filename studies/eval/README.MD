# Eval study analysis

R scripts for the main evaluation. Each participant read four generated match
summaries in a 2x2 within-subject design (Event Structuring on/off crossed with
Expert Insights on/off) and rated each one on 14 constructs. The models are
linear mixed-effects with crossed random intercepts for participant and text.

These started as separate snippets in RStudio while I worked through the
analysis, then got collected and numbered so the whole thing runs in order. GPT-4o was used to combine and clean them up. We compared the results against
the originals to ensure no drift.

## Scripts

- `analysis/00_power_analysis.R` - the pre-study power simulation (only runs with
  `--with-power`; it's slow).
- `analysis/01_load_clean.R` - reshape the wide Qualtrics export into per-text
  rows, recode items, average the construct scores, strip identifiers.
- `analysis/02_models_eval.R` - the mixed models, fixed/random effect tables,
  EMMs, R^2 and ICC, plus the LaTeX versions used in the write-up.
- `analysis/03_diagnostics.R` - residual plots, skew/kurtosis, reliability and
  construct correlations.
- `analysis/04_tables_figures.R` - demographics and other descriptive tables.
- `analysis/05_robustness.R` - re-fits as CLMM and with text as a fixed effect to
  check whether any conclusions flip (needs the `ordinal` package).
- `analysis/06_participant_covariate_correlations.R` - exploratory Spearman
  correlations between participant covariates and mean ratings.

## Running it

```sh
Rscript analysis/run_all.R              # everything except power
Rscript analysis/run_all.R --with-power # include the power simulation
```

Or in Docker (pinned package versions):

```sh
yarn docker:build
yarn docker:run
yarn docker:power   # with the power simulation
```

Outputs land in `data/clean/` and `output/`.
