library(dplyr)
library(tidyr)

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

long <- read.csv(file.path(clean_dir, "eval-long-data.csv"), stringsAsFactors = FALSE)
participants <- read.csv(file.path(clean_dir, "eval-participants.csv"), stringsAsFactors = FALSE)
long$participantId <- as.character(long$participantId)
participants$participantId <- as.character(participants$participantId)

viewing_levels <- c(
  "Several times per week",
  "Once a week",
  "Once a month",
  "Only during some large events",
  "Never"
)

participants <- participants %>%
  mutate(
    SelfAssessment = as.numeric(SelfAssessment),
    Elo = as.numeric(Elo),
    EnglishProficiency = as.numeric(EnglishProficiency),
    ViewingHabits = as.integer(factor(ViewingHabits, levels = viewing_levels, ordered = TRUE)),
    AICount = as.numeric(AICount),
    AISentiment = as.numeric(AISentiment),
    AIUtility = as.numeric(AIUtility)
  ) %>%
  select(participantId, SelfAssessment, Elo, EnglishProficiency, ViewingHabits, AICount, AISentiment, AIUtility)

covariates <- c("Elo", "SelfAssessment", "EnglishProficiency", "ViewingHabits", "AICount", "AISentiment", "AIUtility")

participant_means <- long %>%
  group_by(participantId) %>%
  summarise(across(all_of(outcomes), ~ mean(.x, na.rm = TRUE)), .groups = "drop")

analysis_df <- inner_join(participant_means, participants, by = "participantId") %>%
  arrange(participantId)

spearman <- function(x, y) {
  ok <- complete.cases(x, y)
  x <- x[ok]
  y <- y[ok]
  if (length(x) < 3 || sd(x) == 0 || sd(y) == 0) {
    return(list(n = length(x), rho = NA_real_, p = NA_real_))
  }
  test <- suppressWarnings(cor.test(x, y, method = "spearman", exact = FALSE))
  list(n = length(x), rho = unname(test$estimate), p = unname(test$p.value))
}

rows <- list()
for (outcome in outcomes) {
  for (covar in covariates) {
    res <- spearman(analysis_df[[covar]], analysis_df[[outcome]])
    rows[[length(rows) + 1]] <- data.frame(
      Outcome = unname(labels[[outcome]]),
      OutcomeCode = outcome,
      Covariate = covar,
      n = res$n,
      rho_spearman = res$rho,
      p_value = res$p,
      stringsAsFactors = FALSE
    )
  }
}

results <- bind_rows(rows) %>%
  mutate(
    p_adj_bh_global = p.adjust(p_value, method = "BH"),
    abs_rho = abs(rho_spearman)
  ) %>%
  group_by(Covariate) %>%
  mutate(
    p_adj_bh_within_covar = p.adjust(p_value, method = "BH"),
    p_adj_holm_within_covar = p.adjust(p_value, method = "holm")
  ) %>%
  ungroup() %>%
  arrange(p_adj_bh_global, desc(abs_rho), Outcome, Covariate)

write.csv(results, file.path(tables_dir, "participant_covariate_correlations.csv"), row.names = FALSE)

n_sig <- sum(results$p_adj_bh_global <= 0.05, na.rm = TRUE)
top <- results[1, ]
writeLines(
  c(
    "Exploratory participant-covariate correlations (Spearman, BH-adjusted).",
    sprintf("%d tests (%d outcomes x %d covariates).", nrow(results), length(outcomes), length(covariates)),
    sprintf("Significant at global BH <= .05: %d", n_sig),
    sprintf("Strongest: %s ~ %s, rho = %.3f, p_BH = %.3f", top$Outcome, top$Covariate, top$rho_spearman, top$p_adj_bh_global)
  ),
  file.path(reports_dir, "participant_covariate_correlations_summary.txt")
)

message(sprintf("Participant-covariate correlations complete (%d tests, %d significant at global BH <= .05).", nrow(results), n_sig))
