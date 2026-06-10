library(dplyr)
library(lme4)
library(lmerTest)
library(broom.mixed)
library(emmeans)

clean_dir <- file.path("data", "clean")
tables_dir <- file.path("output", "tables")
reports_dir <- file.path("output", "reports")
dir.create(tables_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(reports_dir, recursive = TRUE, showWarnings = FALSE)

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

dat <- read.csv(file.path(clean_dir, "eval-long-data.csv"), stringsAsFactors = FALSE)

dat$participantId <- factor(dat$participantId)
dat$TextId <- factor(dat$TextId)
dat$EventStructuring <- factor(dat$EventStructuring, levels = c(TRUE, FALSE))
dat$ExpertInsights <- factor(dat$ExpertInsights, levels = c(TRUE, FALSE))
contrasts(dat$EventStructuring) <- contr.sum(2)
contrasts(dat$ExpertInsights) <- contr.sum(2)

# Nakagawa marginal/conditional R^2 for a random-intercept LMM.
nakagawa_r2 <- function(m) {
  var_fixed <- var(as.numeric(predict(m, re.form = NA)))

  vc <- as.data.frame(VarCorr(m))
  var_random <- vc %>%
    filter(grp != "Residual", var1 == "(Intercept)") %>%
    summarise(v = sum(vcov)) %>%
    pull(v)
  if (length(var_random) == 0 || is.na(var_random)) var_random <- 0

  var_residual <- sigma(m)^2
  var_total <- var_fixed + var_random + var_residual

  list(
    R2_marginal = var_fixed / var_total,
    R2_conditional = (var_fixed + var_random) / var_total,
    var_fixed = var_fixed,
    var_random = var_random,
    var_residual = var_residual
  )
}

# ICC split between participant and text random intercepts.
crossed_icc <- function(m) {
  vc <- as.data.frame(VarCorr(m))
  pick <- function(g) {
    v <- vc %>%
      filter(grp == g, var1 == "(Intercept)") %>%
      summarise(v = sum(vcov)) %>%
      pull(v)
    if (length(v) == 0 || is.na(v)) 0 else v
  }
  var_participant <- pick("participantId")
  var_match <- pick("TextId")
  var_residual <- sigma(m)^2
  denom <- var_participant + var_match + var_residual

  list(
    ICC_participant = var_participant / denom,
    ICC_match = var_match / denom,
    ICC_total_random = (var_participant + var_match) / denom,
    var_participant = var_participant,
    var_match = var_match,
    var_residual = var_residual
  )
}

effect_name <- c(
  "(Intercept)" = "Intercept",
  "EventStructuring1" = "Event Structuring",
  "ExpertInsights1" = "Expert Insights",
  "Order_c" = "Order",
  "EventStructuring1:ExpertInsights1" = "Interaction"
)

fit_outcome <- function(outcome) {
  fml <- as.formula(
    paste0(outcome, " ~ EventStructuring * ExpertInsights + Order_c + (1 | TextId) + (1 | participantId)")
  )
  m <- lmer(fml, data = dat, REML = FALSE)

  r2 <- nakagawa_r2(m)
  icc <- crossed_icc(m)

  tidy_fixed <- broom.mixed::tidy(m, effects = "fixed", conf.int = TRUE, conf.level = 0.95) %>%
    mutate(
      Outcome = labels[[outcome]],
      Effect = ifelse(term %in% names(effect_name), effect_name[term], term)
    )

  fixed <- tidy_fixed %>%
    mutate(
      beta = estimate,
      SE = std.error,
      t = statistic,
      p = if_else(p.value < 0.001, "< .001", sprintf("%.3f", p.value)),
      CI_low = conf.low,
      CI_high = conf.high
    ) %>%
    select(Outcome, Effect, beta, SE, df, t, p, CI_low, CI_high)

  sig <- tidy_fixed %>% select(Outcome, Effect, p_value = p.value)

  random <- as.data.frame(VarCorr(m)) %>%
    filter(grp %in% c("participantId", "TextId", "Residual")) %>%
    filter(var1 == "(Intercept)" | grp == "Residual") %>%
    mutate(
      Outcome = labels[[outcome]],
      Grouping = recode(grp, participantId = "Participant", TextId = "Match", Residual = "Residual"),
      Effect = if_else(grp == "Residual", "Observation", "Intercept"),
      variance = vcov,
      SD = sdcor
    ) %>%
    select(Outcome, Grouping, Effect, variance, SD)

  emm <- emmeans(m, ~ EventStructuring * ExpertInsights)
  emm_means <- as.data.frame(emm) %>%
    mutate(
      Outcome = labels[[outcome]],
      EventStructuring = as.character(EventStructuring),
      ExpertInsights = as.character(ExpertInsights)
    ) %>%
    select(Outcome, EventStructuring, ExpertInsights, emmean, SE, df, lower.CL, upper.CL)

  emm_pairs <- as.data.frame(pairs(emm, adjust = "holm")) %>%
    mutate(Outcome = labels[[outcome]]) %>%
    rename(t = t.ratio, p = p.value) %>%
    select(Outcome, contrast, estimate, SE, df, t, p)

  r2_df <- data.frame(Outcome = labels[[outcome]], r2, stringsAsFactors = FALSE)
  icc_df <- data.frame(Outcome = labels[[outcome]], icc, stringsAsFactors = FALSE)

  list(
    fixed = fixed, random = random, emm_means = emm_means,
    emm_pairs = emm_pairs, r2 = r2_df, icc = icc_df, sig = sig
  )
}

fits <- lapply(outcomes, fit_outcome)

fixed_df <- bind_rows(lapply(fits, `[[`, "fixed"))
random_df <- bind_rows(lapply(fits, `[[`, "random"))
emm_means_df <- bind_rows(lapply(fits, `[[`, "emm_means"))
emm_pairs_df <- bind_rows(lapply(fits, `[[`, "emm_pairs"))
r2_df <- bind_rows(lapply(fits, `[[`, "r2"))
icc_df <- bind_rows(lapply(fits, `[[`, "icc"))

outcome_levels <- unname(labels[outcomes])
fixed_effect_levels <- c("Intercept", "Event Structuring", "Expert Insights", "Order", "Interaction")
random_group_levels <- c("Participant", "Match", "Residual")

fixed_df <- fixed_df %>%
  mutate(
    Outcome = factor(Outcome, levels = outcome_levels, ordered = TRUE),
    Effect = factor(Effect, levels = fixed_effect_levels, ordered = TRUE)
  ) %>%
  arrange(Outcome, Effect)

random_df <- random_df %>%
  mutate(
    Outcome = factor(Outcome, levels = outcome_levels, ordered = TRUE),
    Grouping = factor(Grouping, levels = random_group_levels, ordered = TRUE)
  ) %>%
  arrange(Outcome, Grouping, Effect)

emm_means_df <- emm_means_df %>%
  mutate(Outcome = factor(Outcome, levels = outcome_levels, ordered = TRUE)) %>%
  arrange(Outcome, EventStructuring, ExpertInsights)

emm_pairs_df <- emm_pairs_df %>%
  mutate(Outcome = factor(Outcome, levels = outcome_levels, ordered = TRUE)) %>%
  arrange(Outcome, contrast)

r2_df <- r2_df %>%
  mutate(Outcome = factor(Outcome, levels = outcome_levels, ordered = TRUE)) %>%
  arrange(Outcome)

icc_df <- icc_df %>%
  mutate(Outcome = factor(Outcome, levels = outcome_levels, ordered = TRUE)) %>%
  arrange(Outcome)

write.csv(fixed_df, file.path(tables_dir, "fixed_effects.csv"), row.names = FALSE)
write.csv(random_df, file.path(tables_dir, "random_effects.csv"), row.names = FALSE)
write.csv(emm_means_df, file.path(tables_dir, "emmeans_cell_means.csv"), row.names = FALSE)
write.csv(emm_pairs_df, file.path(tables_dir, "emmeans_pairwise_holm.csv"), row.names = FALSE)
write.csv(r2_df, file.path(tables_dir, "r2_nakagawa.csv"), row.names = FALSE)
write.csv(icc_df, file.path(tables_dir, "icc.csv"), row.names = FALSE)

# LaTeX versions of the two main model tables for the write-up.
fixed_effects_latex <- function(df) {
  lines <- c(
    "\\begin{longtable}{l l r r r r r r r}",
    "\\caption{\\label{tab:fixed_effects}Fixed effects from linear mixed-effects models}\\\\",
    "\\toprule",
    "Outcome & Effect & $\\beta$ & SE & df & t & p & CI low & CI high\\\\",
    "\\midrule",
    "\\endfirsthead",
    "\\caption[]{Fixed effects from linear mixed-effects models (continued)}\\\\",
    "\\toprule",
    "Outcome & Effect & $\\beta$ & SE & df & t & p & CI low & CI high\\\\",
    "\\midrule",
    "\\endhead",
    "\\bottomrule",
    "\\endlastfoot"
  )
  for (i in seq_len(nrow(df))) {
    r <- df[i, ]
    lines <- c(lines, sprintf(
      "%s & %s & %.3f & %.3f & %.2f & %.2f & %s & %.2f & %.2f\\\\*",
      r$Outcome, r$Effect, r$beta, r$SE, r$df, r$t, r$p, r$CI_low, r$CI_high
    ))
  }
  c(lines, "\\end{longtable}")
}

random_effects_latex <- function(df) {
  lines <- c(
    "\\begin{longtable}{l l l r r}",
    "\\caption{\\label{tab:random_effects}Random effect variance components (intercepts). No random slopes were included in the model.}\\\\",
    "\\toprule",
    "Outcome & Grouping & Effect & variance & SD\\\\",
    "\\midrule",
    "\\endfirsthead",
    "\\caption[]{Random effect variance component, intercepts (continued)}\\\\",
    "\\toprule",
    "Outcome & Grouping & Effect & variance & SD\\\\",
    "\\midrule",
    "\\endhead",
    "\\bottomrule",
    "\\endlastfoot"
  )
  for (i in seq_len(nrow(df))) {
    r <- df[i, ]
    lines <- c(lines, sprintf(
      "%s & %s & %s & %.3f & %.3f\\\\*",
      r$Outcome, r$Grouping, r$Effect, r$variance, r$SD
    ))
  }
  c(lines, "\\end{longtable}")
}

writeLines(fixed_effects_latex(fixed_df), file.path(tables_dir, "fixed_effects.tex"))
writeLines(random_effects_latex(random_df), file.path(tables_dir, "random_effects.tex"))

# Are scores different from the scale midpoint? Wilcoxon against 4, Holm-adjusted.
wilcox_df <- lapply(outcomes, function(v) {
  x <- dat[[v]]
  x <- x[!is.na(x)]
  test <- suppressWarnings(wilcox.test(x, mu = 4, exact = FALSE))
  data.frame(
    Outcome = labels[[v]],
    Median = median(x),
    IQR = IQR(x),
    W = as.numeric(test$statistic),
    p_raw = as.numeric(test$p.value),
    stringsAsFactors = FALSE
  )
}) %>%
  bind_rows() %>%
  mutate(
    p_holm = p.adjust(p_raw, method = "holm"),
    Significant = p_holm < 0.05,
    Outcome = factor(Outcome, levels = outcome_levels, ordered = TRUE)
  ) %>%
  arrange(Outcome)

write.csv(wilcox_df, file.path(tables_dir, "midpoint_wilcoxon.csv"), row.names = FALSE)

# Quick text digests of the tables above.
sig_df <- bind_rows(lapply(fits, `[[`, "sig"))
focal <- c("Event Structuring", "Expert Insights", "Order", "Interaction")
sig_counts <- sapply(focal, function(e) sum(sig_df$p_value[sig_df$Effect == e] < 0.05, na.rm = TRUE))

writeLines(
  c(
    sprintf("Fixed effects significant at p < .05 (out of %d outcomes):", length(outcomes)),
    sprintf("  %-18s %d", paste0(focal, ":"), sig_counts)
  ),
  file.path(reports_dir, "models_summary.txt")
)

writeLines(
  c(
    sprintf("Nakagawa R^2 across %d outcomes:", nrow(r2_df)),
    sprintf("  marginal:    min %.3f  median %.3f  max %.3f", min(r2_df$R2_marginal), median(r2_df$R2_marginal), max(r2_df$R2_marginal)),
    sprintf("  conditional: min %.3f  median %.3f  max %.3f", min(r2_df$R2_conditional), median(r2_df$R2_conditional), max(r2_df$R2_conditional))
  ),
  file.path(reports_dir, "r2_summary.txt")
)

writeLines(
  c(
    sprintf("ICC across %d outcomes:", nrow(icc_df)),
    sprintf("  participant: min %.3f  median %.3f  max %.3f", min(icc_df$ICC_participant), median(icc_df$ICC_participant), max(icc_df$ICC_participant)),
    sprintf("  text:        min %.3f  median %.3f  max %.3f", min(icc_df$ICC_match), median(icc_df$ICC_match), max(icc_df$ICC_match))
  ),
  file.path(reports_dir, "icc_summary.txt")
)

message("Models and reported tables complete.")
