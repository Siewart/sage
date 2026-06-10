suppressPackageStartupMessages({
  library(readr)
  library(dplyr)
  library(lmerTest)
})

input_c <- file.path("data", "clean", "prelim_clean_long_c.csv")
input_g <- file.path("data", "clean", "prelim_clean_long_g.csv")
out_dir <- file.path("output", "diagnostics")

dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)

if (!file.exists(input_c) || !file.exists(input_g)) {
  stop("Clean long files missing. Run analysis/01_load_clean.R first.")
}

long_c <- read_csv(input_c, show_col_types = FALSE)
long_g <- read_csv(input_g, show_col_types = FALSE)

build_diag <- function(df, dataset_name) {
  dat <- df %>%
    filter(!is.na(item_score)) %>%
    mutate(participant_id = factor(participant_id), item_code = factor(item_code))

  model <- lmer(item_score ~ 0 + item_code + (1 | participant_id), data = dat, REML = TRUE)
  residuals_vec <- residuals(model)

  png(file.path(out_dir, paste0("residuals-qq-", dataset_name, ".png")), width = 1000, height = 700)
  qqnorm(residuals_vec, main = paste("Q-Q Plot Residuals", dataset_name))
  qqline(residuals_vec, col = "red", lwd = 2)
  dev.off()

  png(file.path(out_dir, paste0("residuals-hist-", dataset_name, ".png")), width = 1000, height = 700)
  hist(residuals_vec, breaks = 20, main = paste("Residual Histogram", dataset_name), xlab = "Residual")
  dev.off()

  stats <- tibble(
    dataset = dataset_name,
    n_obs = length(residuals_vec),
    residual_mean = mean(residuals_vec),
    residual_sd = sd(residuals_vec),
    residual_min = min(residuals_vec),
    residual_max = max(residuals_vec),
    shapiro_p = ifelse(length(residuals_vec) <= 5000, shapiro.test(residuals_vec)$p.value, NA_real_)
  )

  stats
}

stats_c <- build_diag(long_c, "C")
stats_g <- build_diag(long_g, "G")
all_stats <- bind_rows(stats_c, stats_g)

write_csv(all_stats, file.path(out_dir, "prelim_residual_diagnostics.csv"))

message("Diagnostics complete. Plots and diagnostics saved.")
