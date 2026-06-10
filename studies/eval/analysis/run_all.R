args <- commandArgs(trailingOnly = TRUE)
with_power <- "--with-power" %in% args

scripts <- c(
  "analysis/01_load_clean.R",
  "analysis/02_models_eval.R",
  "analysis/03_diagnostics.R",
  "analysis/04_tables_figures.R",
  "analysis/05_robustness.R",
  "analysis/06_participant_covariate_correlations.R"
)

if (with_power) {
  scripts <- c("analysis/00_power_analysis.R", scripts)
}

for (s in scripts) {
  message("Running: ", s)
  source(s, local = new.env())
}

if (with_power) {
  message("All eval analysis scripts completed (including power analysis).")
} else {
  message("All eval analysis scripts completed (power analysis skipped).")
}
