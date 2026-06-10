suppressPackageStartupMessages({
  library(readr)
  library(dplyr)
  library(stringr)
})

input_all <- file.path("output", "tables", "prelim_all_emm_tests.csv")
out_dir <- file.path("output", "tables")
dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)

if (!file.exists(input_all)) {
  stop("Model results not found. Run analysis/02_models_prelim.R first.")
}

all_tests <- read_csv(input_all, show_col_types = FALSE)

fmt <- function(x, digits = 2) sprintf(paste0("%.", digits, "f"), x)

summary_table <- all_tests %>%
  mutate(
    p_display = ifelse(p_bh_within_dataset < 0.001, "< .001", fmt(p_bh_within_dataset, 3)),
    ci = paste0(fmt(lower), " -- ", fmt(upper)),
    emm_se = paste0(fmt(emmean), " (", fmt(SE), ")")
  ) %>%
  select(dataset, item_code, null_anchor, emm_se, df, ci, t, p_display, p_bh_within_dataset) %>%
  arrange(dataset, item_code, null_anchor)

write_csv(summary_table, file.path(out_dir, "prelim_reportable_tables.csv"))

topline <- all_tests %>%
  group_by(dataset, item_code) %>%
  summarise(
    emmean = first(emmean),
    lower = first(lower),
    upper = first(upper),
    is_above_3_bh = any(null_anchor == 3 & p_bh_within_dataset < 0.05 & diff_from_null > 0),
    is_above_4_bh = any(null_anchor == 4 & p_bh_within_dataset < 0.05 & diff_from_null > 0),
    .groups = "drop"
  ) %>%
  arrange(dataset, desc(emmean))

write_csv(topline, file.path(out_dir, "prelim_item_rankings.csv"))

message("Table exports complete: prelim_reportable_tables.csv and prelim_item_rankings.csv")
