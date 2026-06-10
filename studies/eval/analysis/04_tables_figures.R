library(dplyr)

clean_dir <- file.path("data", "clean")
tables_dir <- file.path("output", "tables")
reports_dir <- file.path("output", "reports")
dir.create(tables_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(reports_dir, recursive = TRUE, showWarnings = FALSE)

participants <- read.csv(file.path(clean_dir, "eval-participants.csv"), stringsAsFactors = FALSE) %>%
  mutate(
    participantId = as.character(participantId),
    SelfAssessment = as.numeric(SelfAssessment),
    Elo = as.numeric(Elo),
    EnglishProficiency = as.numeric(EnglishProficiency),
    AICount = as.numeric(AICount),
    AISentiment = as.numeric(AISentiment),
    AIUtility = as.numeric(AIUtility),
    ViewingHabits = as.character(ViewingHabits)
  )

dat <- read.csv(file.path(clean_dir, "eval-long-data.csv"), stringsAsFactors = FALSE)

elo_centre <- mean(c(200, 600, 1000, 1400, 1800, 2200))
elo_centered <- participants$Elo - elo_centre

demographics <- data.frame(
  N = nrow(participants),
  SelfAssessment_M = mean(participants$SelfAssessment, na.rm = TRUE),
  SelfAssessment_SD = sd(participants$SelfAssessment, na.rm = TRUE),
  Elo_M = mean(participants$Elo, na.rm = TRUE),
  Elo_SD = sd(participants$Elo, na.rm = TRUE),
  Elo_Centered_M = mean(elo_centered, na.rm = TRUE),
  Elo_Centered_SD = sd(elo_centered, na.rm = TRUE),
  Elo_NoElo_Count = sum(is.na(participants$Elo)),
  NativeLikeEnglish_Count = sum(participants$EnglishProficiency == 7, na.rm = TRUE),
  stringsAsFactors = FALSE
)
write.csv(demographics, file.path(tables_dir, "demographics_summary.csv"), row.names = FALSE)

viewing_counts <- participants %>%
  filter(!is.na(ViewingHabits), nzchar(trimws(ViewingHabits))) %>%
  count(ViewingHabits, name = "Count") %>%
  arrange(desc(Count), ViewingHabits)
write.csv(viewing_counts, file.path(tables_dir, "viewing_habits_counts.csv"), row.names = FALSE)

ai_summary <- data.frame(
  AICount_M = mean(participants$AICount, na.rm = TRUE),
  AICount_SD = sd(participants$AICount, na.rm = TRUE),
  AISentiment_M = mean(participants$AISentiment, na.rm = TRUE),
  AISentiment_SD = sd(participants$AISentiment, na.rm = TRUE),
  AIUtility_M = mean(participants$AIUtility, na.rm = TRUE),
  AIUtility_SD = sd(participants$AIUtility, na.rm = TRUE),
  GuessAllFour_Count = sum(participants$AICount == 4, na.rm = TRUE),
  GuessNotAllFour_Count = sum(participants$AICount < 4, na.rm = TRUE),
  stringsAsFactors = FALSE
)
write.csv(ai_summary, file.path(tables_dir, "ai_perception_summary.csv"), row.names = FALSE)

open_text <- dat %>%
  filter(!is.na(OpenText), nzchar(trimws(OpenText))) %>%
  mutate(
    participantId = as.character(participantId),
    TextId = as.integer(TextId),
    Order = as.integer(Order)
  ) %>%
  arrange(participantId, TextId, Order, EventStructuring, ExpertInsights)

write.csv(
  data.frame(TotalEvaluations = nrow(dat), OpenTextCount = nrow(open_text)),
  file.path(tables_dir, "qualitative_feedback_summary.csv"),
  row.names = FALSE
)
write.csv(open_text, file.path(tables_dir, "qualitative_feedback_rows.csv"), row.names = FALSE)

writeLines(
  c(
    sprintf("Participants: %d", nrow(participants)),
    sprintf("Evaluations: %d", nrow(dat)),
    sprintf("Open-text evaluations: %d", nrow(open_text)),
    sprintf("Game knowledge M(SD): %.2f (%.2f)", demographics$SelfAssessment_M, demographics$SelfAssessment_SD),
    sprintf("ELO M(SD): %.2f (%.2f)", demographics$Elo_M, demographics$Elo_SD),
    sprintf("ELO centered M(SD): %.2f (%.2f)", demographics$Elo_Centered_M, demographics$Elo_Centered_SD),
    sprintf("ELO no-rating count: %d", demographics$Elo_NoElo_Count),
    sprintf("Native-like English count: %d", demographics$NativeLikeEnglish_Count),
    sprintf("AI count guess M(SD): %.2f (%.2f)", ai_summary$AICount_M, ai_summary$AICount_SD),
    sprintf("AI sentiment M(SD): %.2f (%.2f)", ai_summary$AISentiment_M, ai_summary$AISentiment_SD),
    sprintf("AI utility M(SD): %.2f (%.2f)", ai_summary$AIUtility_M, ai_summary$AIUtility_SD)
  ),
  file.path(reports_dir, "descriptive_summary.txt")
)

message("Descriptive tables complete.")
