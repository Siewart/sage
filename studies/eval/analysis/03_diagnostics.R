library(dplyr)
library(lme4)
library(lmerTest)
library(ggplot2)
library(e1071)
library(psych)

clean_dir <- file.path("data", "clean")
tables_dir <- file.path("output", "tables")
diagnostics_dir <- file.path("output", "diagnostics")
dir.create(tables_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(diagnostics_dir, recursive = TRUE, showWarnings = FALSE)

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

long <- read.csv(file.path(clean_dir, "eval-long-data.csv"), stringsAsFactors = FALSE) %>%
  arrange(participantId, TextId, Order, EventStructuring, ExpertInsights)

long$participantId <- factor(long$participantId)
long$TextId <- factor(long$TextId)
long$EventStructuring <- factor(long$EventStructuring, levels = c(TRUE, FALSE))
long$ExpertInsights <- factor(long$ExpertInsights, levels = c(TRUE, FALSE))
contrasts(long$EventStructuring) <- contr.sum(2)
contrasts(long$ExpertInsights) <- contr.sum(2)

diag_rows <- list()
linearity_rows <- list()

for (outcome in outcomes) {
  label <- labels[[outcome]]
  fml <- as.formula(
    paste0(outcome, " ~ EventStructuring * ExpertInsights + Order_c + (1 | TextId) + (1 | participantId)")
  )
  m <- lmer(fml, data = long, REML = TRUE)

  resid_vals <- resid(m)
  fitted_vals <- fitted(m)

  diag_rows[[outcome]] <- data.frame(
    Outcome = label,
    Skewness = e1071::skewness(resid_vals, na.rm = TRUE, type = 2),
    Kurtosis = e1071::kurtosis(resid_vals, na.rm = TRUE, type = 2),
    stringsAsFactors = FALSE
  )

  png(file.path(diagnostics_dir, paste0("qq_", outcome, ".png")), width = 1000, height = 700, res = 120)
  qqnorm(resid_vals, main = paste("Q-Q plot:", label))
  qqline(resid_vals, col = "red")
  dev.off()

  rvf <- data.frame(fitted = fitted_vals, resid = resid_vals)
  rvf <- rvf[order(rvf$fitted, rvf$resid), , drop = FALSE]
  ggsave(
    file.path(diagnostics_dir, paste0("rvf_", outcome, ".png")),
    ggplot(rvf, aes(fitted, resid)) +
      geom_point(alpha = 0.4) +
      geom_smooth(method = "loess", se = FALSE) +
      geom_hline(yintercept = 0, linetype = "dashed") +
      labs(title = paste("Residuals vs Fitted:", label)),
    width = 8, height = 5, dpi = 140
  )

  resid_by_order <- data.frame(Order_c = long$Order_c, resid = resid_vals)
  resid_by_order <- resid_by_order[order(resid_by_order$Order_c, resid_by_order$resid), , drop = FALSE]
  ggsave(
    file.path(diagnostics_dir, paste0("rvo_", outcome, ".png")),
    ggplot(resid_by_order, aes(Order_c, resid)) +
      geom_point(alpha = 0.4) +
      geom_smooth(method = "loess", se = FALSE) +
      geom_hline(yintercept = 0, linetype = "dashed") +
      labs(title = paste("Residuals vs Order:", label)),
    width = 8, height = 5, dpi = 140
  )

  ggsave(
    file.path(diagnostics_dir, paste0("box_es_", outcome, ".png")),
    ggplot(data.frame(EventStructuring = long$EventStructuring, resid = resid_vals), aes(EventStructuring, resid)) +
      geom_boxplot(outlier.alpha = 0.5) +
      geom_hline(yintercept = 0, linetype = "dashed") +
      labs(title = paste("Residuals by Event Structuring:", label)),
    width = 7, height = 5, dpi = 140
  )

  ggsave(
    file.path(diagnostics_dir, paste0("box_ei_", outcome, ".png")),
    ggplot(data.frame(ExpertInsights = long$ExpertInsights, resid = resid_vals), aes(ExpertInsights, resid)) +
      geom_boxplot(outlier.alpha = 0.5) +
      geom_hline(yintercept = 0, linetype = "dashed") +
      labs(title = paste("Residuals by Expert Insights:", label)),
    width = 7, height = 5, dpi = 140
  )

  lin <- lm(resid ~ Order_c, data = resid_by_order)
  lin_sum <- summary(lin)
  linearity_rows[[outcome]] <- data.frame(
    Outcome = label,
    Slope = unname(coef(lin)[["Order_c"]]),
    Slope_p = unname(coef(lin_sum)["Order_c", "Pr(>|t|)"]),
    R_squared = lin_sum$r.squared,
    stringsAsFactors = FALSE
  )
}

diag_table <- bind_rows(diag_rows) %>%
  mutate(Outcome = factor(Outcome, levels = outcome_levels, ordered = TRUE)) %>%
  arrange(Outcome)
write.csv(diag_table, file.path(tables_dir, "residual_shape.csv"), row.names = FALSE)

linearity_table <- bind_rows(linearity_rows) %>%
  mutate(Outcome = factor(Outcome, levels = outcome_levels, ordered = TRUE)) %>%
  arrange(Outcome)
write.csv(linearity_table, file.path(tables_dir, "linearity_checks.csv"), row.names = FALSE)

# Two-item construct reliability from the item-level file.
texts <- read.csv(file.path(clean_dir, "eval-texts-data.csv"), stringsAsFactors = FALSE)

construct_pairs <- list(
  "Competitive Nature" = c("col1", "col2"),
  "Skill Improvement" = c("col3", "col4"),
  "Game Knowledge" = c("col5", "col6"),
  "Skill Appreciation" = c("col7", "col8"),
  "Entertaining Nature" = c("col9", "col10"),
  "Dramatic Nature" = c("col11", "col12"),
  "Vicarious Sensation" = c("col13", "col14")
)

reliability <- lapply(names(construct_pairs), function(name) {
  cols <- construct_pairs[[name]]
  data.frame(
    Construct = name,
    Items = 2,
    Alpha = as.numeric(psych::alpha(texts[, cols])$total$raw_alpha),
    InterItemR = cor(texts[[cols[[1]]]], texts[[cols[[2]]]], use = "pairwise.complete.obs"),
    stringsAsFactors = FALSE
  )
}) %>%
  bind_rows() %>%
  mutate(Construct = factor(Construct, levels = names(construct_pairs), ordered = TRUE)) %>%
  arrange(Construct)
write.csv(reliability, file.path(tables_dir, "reliability.csv"), row.names = FALSE)

construct_data <- data.frame(
  CompetitiveNature = long$cons1_competitive_enjoy,
  SkillImprovement = long$cons2_learning,
  GameKnowledge = long$cons3_expertise_enjoy,
  SkillAppreciation = long$cons4_awe_novelty,
  EntertainingNature = long$cons5_fun,
  DramaticNature = long$cons6_excitement,
  VicariousSensation = long$cons7_immersion
)
construct_cor <- round(cor(construct_data, use = "pairwise.complete.obs"), 2)
write.csv(construct_cor, file.path(tables_dir, "construct_correlations.csv"), row.names = TRUE)

message("Diagnostics complete.")
