scripts <- c(
  "analysis/01_load_clean.R",
  "analysis/02_models_prelim.R",
  "analysis/03_diagnostics.R",
  "analysis/04_tables_figures.R"
)

for (s in scripts) {
  message("Running: ", s)
  source(s, local = new.env())
}

message("All prelim analysis scripts completed.")
