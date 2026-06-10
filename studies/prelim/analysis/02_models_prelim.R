suppressPackageStartupMessages({
  library(dplyr)
  library(readr)
  library(lmerTest)
  library(emmeans)
  library(purrr)
})

input_c <- file.path("data", "clean", "prelim_clean_long_c.csv")
input_g <- file.path("data", "clean", "prelim_clean_long_g.csv")
input_wide <- file.path("data", "clean", "prelim_clean_wide.csv")
out_dir <- file.path("output", "tables")
dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)

if (!file.exists(input_c) || !file.exists(input_g) || !file.exists(input_wide)) {
  stop("Clean inputs missing. Run analysis/01_load_clean.R first.")
}

long_c <- read_csv(input_c, show_col_types = FALSE)
long_g <- read_csv(input_g, show_col_types = FALSE)
wide <- read_csv(input_wide, show_col_types = FALSE)

emm_options(lmer.df = "satterthwaite")

run_emm_tests <- function(df, dataset_label, nulls = c(3, 3.5, 4)) {
  dat <- df %>%
    filter(!is.na(item_score)) %>%
    mutate(
      participant_id = factor(participant_id),
      item_code = factor(item_code)
    )

  model <- lmer(item_score ~ 0 + item_code + (1 | participant_id), data = dat, REML = TRUE)
  emms <- emmeans(model, ~item_code)

  out <- map_dfr(nulls, function(n0) {
    summary(emms, infer = c(TRUE, TRUE), level = 0.95, null = n0, adjust = "none") %>%
      as.data.frame() %>%
      mutate(null_anchor = n0)
  }) %>%
    transmute(
      dataset = dataset_label,
      item_code,
      emmean,
      SE,
      df,
      lower = lower.CL,
      upper = upper.CL,
      t = t.ratio,
      p = p.value,
      null_anchor,
      diff_from_null = emmean - null_anchor
    ) %>%
    group_by(dataset) %>%
    mutate(p_bh_within_dataset = p.adjust(p, method = "BH")) %>%
    ungroup()

  list(model = model, table = out)
}

extract_random_effects_summary <- function(model, dataset_label) {
  singular_flag <- lme4::isSingular(model, tol = 1e-4)
  conv_messages <- model@optinfo$conv$lme4$messages
  conv_message <- if (length(conv_messages)) paste(conv_messages, collapse = " | ") else NA_character_

  as.data.frame(VarCorr(model)) %>%
    mutate(
      dataset = dataset_label,
      is_singular = singular_flag,
      convergence_message = conv_message
    ) %>%
    select(dataset, grp, var1, var2, vcov, sdcor, is_singular, convergence_message)
}

res_c <- run_emm_tests(long_c, "C")
res_g <- run_emm_tests(long_g, "G")
all_tests <- bind_rows(res_c$table, res_g$table) %>%
  mutate(p_bh_global = p.adjust(p, method = "BH")) %>%
  arrange(dataset, item_code, null_anchor)

write_csv(res_c$table, file.path(out_dir, "prelim_c_emm_tests.csv"))
write_csv(res_g$table, file.path(out_dir, "prelim_g_emm_tests.csv"))
write_csv(all_tests, file.path(out_dir, "prelim_all_emm_tests.csv"))

check_covariate_effect <- function(df_long, wide_df, dataset_label) {
  covars <- c("TechnicalIssues", "competence_self", "elo_midpoint", "watch_frequency_level", "watched_before")

  dat <- df_long %>%
    left_join(
      wide_df %>% select(participant_id, TechnicalIssues),
      by = "participant_id"
    ) %>%
    filter(!is.na(item_score)) %>%
    mutate(participant_id = factor(participant_id), watched_before = factor(watched_before))

  one_cov <- function(cov_name) {
    if (cov_name == "watched_before") {
      model <- lmer(item_score ~ watched_before + (1 | participant_id), data = dat, REML = TRUE)
      a <- anova(model)
      p_val <- a["watched_before", "Pr(>F)"]
      tibble(dataset = dataset_label, covariate = cov_name, estimate = NA_real_, p = as.numeric(p_val))
    } else {
      model <- lmer(as.formula(paste0("item_score ~ ", cov_name, " + (1 | participant_id)")), data = dat, REML = TRUE)
      coef_tab <- summary(model)$coefficients
      estimate <- coef_tab[cov_name, "Estimate"]
      p_val <- coef_tab[cov_name, "Pr(>|t|)"]
      tibble(dataset = dataset_label, covariate = cov_name, estimate = as.numeric(estimate), p = as.numeric(p_val))
    }
  }

  bind_rows(lapply(covars, one_cov))
}

cov_c <- check_covariate_effect(long_c, wide, "C")
cov_g <- check_covariate_effect(long_g, wide, "G")
cov_all <- bind_rows(cov_c, cov_g) %>%
  group_by(dataset) %>%
  mutate(p_bh_within_dataset = p.adjust(p, method = "BH")) %>%
  ungroup() %>%
  mutate(p_bh_global = p.adjust(p, method = "BH"))

write_csv(cov_all, file.path(out_dir, "prelim_covariate_checks.csv"))

model_summary <- bind_rows(
  tibble(dataset = "C", sigma = sigma(res_c$model), n = nobs(res_c$model), logLik = as.numeric(logLik(res_c$model))),
  tibble(dataset = "G", sigma = sigma(res_g$model), n = nobs(res_g$model), logLik = as.numeric(logLik(res_g$model)))
)
write_csv(model_summary, file.path(out_dir, "prelim_model_summary.csv"))

random_effects_summary <- bind_rows(
  extract_random_effects_summary(res_c$model, "C"),
  extract_random_effects_summary(res_g$model, "G")
)
write_csv(random_effects_summary, file.path(out_dir, "prelim_random_effects_summary.csv"))

message("Modeling complete. Wrote EMM/BH tables and covariate checks to ", out_dir)
