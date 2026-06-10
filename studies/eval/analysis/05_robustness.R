library(dplyr)
library(lme4)
library(lmerTest)
library(broom.mixed)

clean_dir <- file.path("data", "clean")
tables_dir <- file.path("output", "tables")
reports_dir <- file.path("output", "reports")
dir.create(tables_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(reports_dir, recursive = TRUE, showWarnings = FALSE)

# The CLMM cross-check needs the ordinal package; skip cleanly if it's missing.
if (!requireNamespace("ordinal", quietly = TRUE)) {
  writeLines(
    "Robustness check skipped: package 'ordinal' is not installed.",
    file.path(reports_dir, "robustness_status.txt")
  )
  message("Robustness skipped: 'ordinal' not installed.")
} else {
  outcome_labels <- c(
    cons1_competitive_enjoy = "Competitive Nature",
    cons2_learning = "Skill Improvement",
    cons3_expertise_enjoy = "Game Knowledge",
    cons4_awe_novelty = "Skill Appreciation",
    cons5_fun = "Entertaining Nature",
    cons6_excitement = "Dramatic Nature",
    cons7_immersion = "Vicarious Sensation",
    cons8_quality = "Overall Quality",
    cons9_word_choice = "Word Choice",
    cons10_ease_reading = "Readability",
    cons11_orderliness = "Logicality",
    cons12_detail_level = "Detail Level",
    cons13_thoroughness = "Reading Thoroughness",
    cons14_understanding = "Understanding"
  )
  outcomes <- names(outcome_labels)
  labels <- outcome_labels
  outcome_levels <- unname(labels[outcomes])

  focal_effects <- c("Event Structuring", "Expert Insights", "Order", "Interaction")

  dat <- read.csv(file.path(clean_dir, "eval-long-data.csv"), stringsAsFactors = FALSE)
  dat$participantId <- factor(dat$participantId)
  dat$TextId <- factor(dat$TextId)
  dat$EventStructuring <- factor(dat$EventStructuring, levels = c(TRUE, FALSE))
  dat$ExpertInsights <- factor(dat$ExpertInsights, levels = c(TRUE, FALSE))
  contrasts(dat$EventStructuring) <- contr.sum(2)
  contrasts(dat$ExpertInsights) <- contr.sum(2)

  # The LMM uses contr.sum labels; the CLMM can label the same terms with a "1"
  # or "TRUE" suffix and either interaction ordering, so match a bit loosely.
  lmm_effect <- c(
    "EventStructuring1" = "Event Structuring",
    "ExpertInsights1" = "Expert Insights",
    "Order_c" = "Order",
    "EventStructuring1:ExpertInsights1" = "Interaction"
  )
  clmm_effect <- function(term) {
    case_when(
      grepl("EventStructuring(1|TRUE):ExpertInsights(1|TRUE)|ExpertInsights(1|TRUE):EventStructuring(1|TRUE)", term) ~ "Interaction",
      grepl("^EventStructuring(1|TRUE)$", term) ~ "Event Structuring",
      grepl("^ExpertInsights(1|TRUE)$", term) ~ "Expert Insights",
      term == "Order_c" ~ "Order",
      TRUE ~ NA_character_
    )
  }

  lmm_random_rows <- list()
  lmm_match_fixed_rows <- list()
  clmm_rows <- list()

  for (outcome in outcomes) {
    label <- labels[[outcome]]

    # Baseline: TextId as a random intercept.
    lmm_random <- tryCatch(
      lmer(
        as.formula(paste0(outcome, " ~ EventStructuring * ExpertInsights + Order_c + (1 | TextId) + (1 | participantId)")),
        data = dat, REML = FALSE
      ),
      error = function(e) NULL
    )
    # Alternative: TextId as a fixed effect instead.
    lmm_match_fixed <- tryCatch(
      lmer(
        as.formula(paste0(outcome, " ~ EventStructuring * ExpertInsights + Order_c + TextId + (1 | participantId)")),
        data = dat, REML = FALSE
      ),
      error = function(e) NULL
    )

    if (!is.null(lmm_random)) {
      tidy_random <- broom.mixed::tidy(lmm_random, effects = "fixed", conf.int = FALSE) %>%
        mutate(
          Outcome = label,
          Effect = unname(lmm_effect[term]),
          p_random = as.numeric(p.value),
          sig_random = !is.na(p_random) & p_random < 0.05
        ) %>%
        filter(Effect %in% focal_effects) %>%
        select(Outcome, Effect, p_random, sig_random)
      if (nrow(tidy_random) > 0) lmm_random_rows[[length(lmm_random_rows) + 1]] <- tidy_random
    }

    if (!is.null(lmm_match_fixed)) {
      tidy_fixed <- broom.mixed::tidy(lmm_match_fixed, effects = "fixed", conf.int = FALSE) %>%
        mutate(
          Outcome = label,
          Effect = unname(lmm_effect[term]),
          p_match_fixed = as.numeric(p.value),
          sig_match_fixed = !is.na(p_match_fixed) & p_match_fixed < 0.05
        ) %>%
        filter(Effect %in% focal_effects) %>%
        select(Outcome, Effect, p_match_fixed, sig_match_fixed)
      if (nrow(tidy_fixed) > 0) lmm_match_fixed_rows[[length(lmm_match_fixed_rows) + 1]] <- tidy_fixed
    }

    # Ordinal mixed model on the same outcome treated as ranks.
    values <- dat[[outcome]]
    levels_ord <- sort(unique(na.omit(values)))
    if (length(levels_ord) < 2) next
    dat$OutcomeOrd <- ordered(values, levels = levels_ord)

    clmm_fit <- tryCatch(
      ordinal::clmm(
        OutcomeOrd ~ EventStructuring * ExpertInsights + Order_c + (1 | TextId) + (1 | participantId),
        data = dat, link = "logit", Hess = TRUE, nAGQ = 1
      ),
      error = function(e) NULL
    )

    if (!is.null(clmm_fit)) {
      coefs <- as.data.frame(coef(summary(clmm_fit)), stringsAsFactors = FALSE)
      coefs$Term <- rownames(coefs)
      rownames(coefs) <- NULL

      coefs <- coefs %>%
        filter(!grepl("\\|", Term)) %>%
        mutate(
          Outcome = label,
          Effect = clmm_effect(Term),
          Estimate = Estimate,
          SE = `Std. Error`,
          z = `z value`,
          p_clmm = as.numeric(`Pr(>|z|)`),
          sig_clmm = !is.na(p_clmm) & p_clmm < 0.05
        ) %>%
        filter(Effect %in% focal_effects) %>%
        select(Outcome, Effect, Estimate, SE, z, p_clmm, sig_clmm)
      if (nrow(coefs) > 0) clmm_rows[[length(clmm_rows) + 1]] <- coefs
    }
  }

  if (length(lmm_random_rows) == 0) {
    writeLines(
      "Robustness check produced no rows; check model convergence.",
      file.path(reports_dir, "robustness_status.txt")
    )
    message("Robustness ran but produced no rows.")
  } else {
    lmm_random_df <- bind_rows(lmm_random_rows)
    lmm_match_fixed_df <- if (length(lmm_match_fixed_rows) > 0) bind_rows(lmm_match_fixed_rows) else data.frame()
    clmm_df <- if (length(clmm_rows) > 0) bind_rows(clmm_rows) else data.frame()

    order_effects <- function(df) {
      df %>%
        mutate(
          Outcome = factor(Outcome, levels = outcome_levels, ordered = TRUE),
          Effect = factor(Effect, levels = focal_effects, ordered = TRUE)
        ) %>%
        arrange(Outcome, Effect)
    }

    lmm_match_robustness <- left_join(lmm_random_df, lmm_match_fixed_df, by = c("Outcome", "Effect")) %>%
      mutate(significance_flip = sig_random != sig_match_fixed) %>%
      order_effects()

    clmm_vs_lmm <- left_join(
      lmm_random_df,
      select(clmm_df, Outcome, Effect, p_clmm, sig_clmm),
      by = c("Outcome", "Effect")
    ) %>%
      mutate(significance_flip = sig_random != sig_clmm) %>%
      order_effects()

    if (nrow(clmm_df) > 0) clmm_df <- order_effects(clmm_df)

    write.csv(clmm_df, file.path(tables_dir, "clmm_fixed_effects.csv"), row.names = FALSE)
    write.csv(lmm_match_robustness, file.path(tables_dir, "lmm_match_robustness.csv"), row.names = FALSE)
    write.csv(clmm_vs_lmm, file.path(tables_dir, "clmm_vs_lmm_significance.csv"), row.names = FALSE)

    writeLines(
      c(
        sprintf("LMM (TextId random) vs LMM (TextId fixed) significance flips: %d", sum(lmm_match_robustness$significance_flip, na.rm = TRUE)),
        sprintf("CLMM vs LMM significance flips: %d", sum(clmm_vs_lmm$significance_flip, na.rm = TRUE))
      ),
      file.path(reports_dir, "robustness_status.txt")
    )
    message("Robustness complete.")
  }
}
