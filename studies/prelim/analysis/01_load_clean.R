suppressPackageStartupMessages({
  library(dplyr)
  library(readr)
  library(tidyr)
  library(stringr)
})

raw_path <- file.path("data", "prelim-data.csv")
clean_dir <- file.path("data", "clean")

if (!file.exists(raw_path)) {
  stop("Raw data file not found: ", raw_path)
}

dir.create(clean_dir, recursive = TRUE, showWarnings = FALSE)

raw_df <- read_csv(raw_path, show_col_types = FALSE, na = c("", "NA"))

raw_n <- nrow(raw_df)
raw_cols <- ncol(raw_df)

df <- raw_df %>%
  mutate(across(where(is.character), ~ str_squish(.x)))

c_item_cols <- c(
  "Introduction of map layout - including resource locations and possible wall locations",
  "Introduction of players and related trivia",
  "Introduction of civilizations and their strengths",
  "Early economy decisions (e.g. pushing deer)",
  "Scouting information",
  "Aggressive maneuvers: Not leading to kills, but delaying a player",
  "Aggressive maneuvers: Leading to kills or losses on military units",
  "Aggressive maneuvers: Leading to kills on villagers and other economy units",
  "Technology Status: Age-up timings",
  "Technology Status: Improving unit strength leading up to a fight, e.g. \"+4 knights\"",
  "Uncommon events like: Daut Castles and Siege Tower hops",
  "Breaking through the wall, over-chops and possible defenses.",
  "Overwhelming the opponent's base with a large army",
  "Predictions (e.g. Villese will resign when Imperial Age is reached)",
  "Specific information relevant to the current situation (e.g. You don't want to lose your berries as Franks)"
)

g_item_cols <- c(
  "Watching the video summary gave me a good idea how the game played out.",
  "In general, I think game summaries can help me consume competitive AoE2 content more effectively.",
  "Generally, I prefer watching full games, even if that means that some of the spoken content is not relevant to the game.",
  "I only watch a few competitive games from a tournament because I don't have time to watch all the games I would want to watch.",
  "When watching games I'm generally interested in the large battles.",
  "When watching games I'm generally interested in the strategic choices made by each player.",
  "When watching games I am generally interested in watching the skill level of the players.",
  "It was hard to ignore video cutting issues and casting style as they negatively impacted my watching experience."
)

required_cols <- c(
  "ID",
  "How competent do you think you are in understanding Age of Empires 2: Definitive Edition competitive 1v1 Random Map games?",
  "What is you current ELO on the 1v1 ladder for AoE2: Definitive Edition?",
  "How often do you watch competitive Age of Empires 2 videos or live streams?",
  "Do you see this game before? This can be on any channel or in spectator mode.",
  c_item_cols,
  g_item_cols,
  "Did you feel there was anything missing to follow \"the story\" of this match? If so, please indicate what you were missing below."
)

missing_required <- setdiff(required_cols, names(df))
if (length(missing_required) > 0) {
  stop("Required columns missing from raw dataset:\n", paste(missing_required, collapse = "\n"))
}

recode_c <- c(
  "Not Relevant" = 1,
  "Slightly Relevant" = 2,
  "Relevant" = 3,
  "Very Relevant" = 4,
  "Required" = 5,
  "I don't know" = NA_real_
)

recode_g <- c(
  "Strongly Disagree" = 1,
  "Disagree" = 2,
  "Neutral" = 3,
  "Agree" = 4,
  "Strongly Agree" = 5,
  "Does Not Apply" = NA_real_
)

recode_competence <- c(
  "1" = 1,
  "2" = 2,
  "3" = 3,
  "4" = 4,
  "5" = 5,
  "Not Competent" = 1,
  "Slightly Competent" = 2,
  "Competent" = 3,
  "Very Competent" = 4,
  "Expert" = 5
)

recode_elo <- c(
  "800 or less" = 700,
  "801-1000" = 900,
  "1001-1200" = 1100,
  "1201-1500" = 1350,
  "1501-1700" = 1600,
  "1700 or higher" = 1800,
  "1701-2000" = 1850,
  "I don't have a rating" = NA_real_
)

recode_watch <- c(
  "Never" = 0,
  "Monthly" = 1,
  "Weekly" = 2,
  "Daily" = 3
)

recode_seen <- c(
  "No" = "No",
  "Yes" = "Yes",
  "Unsure" = "Unsure"
)

code_c <- setNames(
  c(
    "IntroLayout", "IntroPlayers", "IntroCivs", "IntroEconomy", "EventScouting",
    "BattleDelay", "BattleMilitary", "BattleEcoKills", "StateAgeUp", "StateMilTech",
    "EventUncommon", "BattleBreakIn", "BattleOverwhelm", "Predictions", "Knowledge"
  ),
  c_item_cols
)

code_g <- setNames(
  c(
    "Understanding", "SummaryOpinion", "PreferFullGames", "LimitedTime",
    "InterestBattles", "InterestStrategy", "InterestSkill", "TechnicalIssues"
  ),
  g_item_cols
)

invalid_before <- list(
  c_invalid = sum(!(df[c_item_cols] %>% unlist(use.names = FALSE) %in% names(recode_c)) &
    !is.na(df[c_item_cols] %>% unlist(use.names = FALSE))),
  g_invalid = sum(!(df[g_item_cols] %>% unlist(use.names = FALSE) %in% names(recode_g)) &
    !is.na(df[g_item_cols] %>% unlist(use.names = FALSE)))
)

clean <- df %>%
  mutate(
    participant_id = sprintf("P%03d", row_number()),
    respondent_id = suppressWarnings(as.integer(ID)),
    competence_self = as.numeric(recode_competence[`How competent do you think you are in understanding Age of Empires 2: Definitive Edition competitive 1v1 Random Map games?`]),
    elo_midpoint = as.numeric(recode_elo[`What is you current ELO on the 1v1 ladder for AoE2: Definitive Edition?`]),
    watch_frequency_level = as.numeric(recode_watch[`How often do you watch competitive Age of Empires 2 videos or live streams?`]),
    watched_before = factor(recode_seen[`Do you see this game before? This can be on any channel or in spectator mode.`], levels = c("No", "Unsure", "Yes"))
  ) %>%
  mutate(across(all_of(c_item_cols), ~ as.numeric(recode_c[.x]))) %>%
  mutate(across(all_of(g_item_cols), ~ as.numeric(recode_g[.x])))

clean_wide <- clean %>%
  transmute(
    participant_id,
    respondent_id,
    competence_self,
    elo_midpoint,
    watch_frequency_level,
    watched_before,
    feedback_open = `Did you feel there was anything missing to follow "the story" of this match? If so, please indicate what you were missing below.`,
    across(all_of(c_item_cols), ~.x, .names = "{code_c[.col]}"),
    across(all_of(g_item_cols), ~.x, .names = "{code_g[.col]}"),
    has_email = !is.na(Email) & Email != "",
    has_name = !is.na(Name) & Name != ""
  )

clean_long_c <- clean_wide %>%
  select(participant_id, competence_self, elo_midpoint, watch_frequency_level, watched_before, starts_with("Intro"), starts_with("Event"), starts_with("Battle"), starts_with("State"), Predictions, Knowledge) %>%
  pivot_longer(
    cols = c(starts_with("Intro"), starts_with("Event"), starts_with("Battle"), starts_with("State"), Predictions, Knowledge),
    names_to = "item_code",
    values_to = "item_score"
  ) %>%
  mutate(dataset = "C")

clean_long_g <- clean_wide %>%
  select(participant_id, competence_self, elo_midpoint, watch_frequency_level, watched_before, Understanding, SummaryOpinion, PreferFullGames, LimitedTime, InterestBattles, InterestStrategy, InterestSkill, TechnicalIssues) %>%
  pivot_longer(
    cols = c(Understanding, SummaryOpinion, PreferFullGames, LimitedTime, InterestBattles, InterestStrategy, InterestSkill, TechnicalIssues),
    names_to = "item_code",
    values_to = "item_score"
  ) %>%
  mutate(dataset = "G")

write_csv(clean_wide, file.path(clean_dir, "prelim_clean_wide.csv"))
write_csv(clean_long_c, file.path(clean_dir, "prelim_clean_long_c.csv"))
write_csv(clean_long_g, file.path(clean_dir, "prelim_clean_long_g.csv"))

cleaning_summary <- c(
  "# Prelim Cleaning Summary",
  "",
  paste0("- Raw rows: ", raw_n),
  paste0("- Raw columns: ", raw_cols),
  paste0("- Output wide rows: ", nrow(clean_wide)),
  paste0("- Output long C rows: ", nrow(clean_long_c)),
  paste0("- Output long G rows: ", nrow(clean_long_g)),
  paste0("- Duplicate respondent IDs: ", sum(duplicated(clean_wide$respondent_id), na.rm = TRUE)),
  paste0("- Invalid C entries before recode: ", invalid_before$c_invalid),
  paste0("- Invalid G entries before recode: ", invalid_before$g_invalid),
  paste0("- Missing C scores after recode: ", sum(is.na(clean_long_c$item_score))),
  paste0("- Missing G scores after recode: ", sum(is.na(clean_long_g$item_score))),
  paste0("- Rows with email present: ", sum(clean_wide$has_email, na.rm = TRUE)),
  paste0("- Rows with name present: ", sum(clean_wide$has_name, na.rm = TRUE)),
  "",
  "## Notes",
  "- The cleaned outputs are anonymized with generated participant IDs.",
  "- Start/end timestamps and direct identifiers are excluded from clean outputs.",
  "- `I don't know` and `Does Not Apply` are set to missing values (NA)."
)

output_dir <- file.path("output")
reports_dir <- file.path(output_dir, "reports")
tables_dir <- file.path(output_dir, "tables")

dir.create(reports_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(tables_dir, recursive = TRUE, showWarnings = FALSE)

writeLines(cleaning_summary, con = file.path(reports_dir, "load_clean_summary.txt"))

participants_n <- nrow(clean_wide)

competence_mean <- mean(clean_wide$competence_self, na.rm = TRUE)
competence_sd <- stats::sd(clean_wide$competence_self, na.rm = TRUE)

elo_vals <- clean_wide$elo_midpoint
elo_n <- sum(is.finite(elo_vals))
elo_mean <- mean(elo_vals, na.rm = TRUE)
elo_sd <- stats::sd(elo_vals, na.rm = TRUE)

watched_counts <- table(clean_wide$watched_before, useNA = "ifany")
watched_no <- if ("No" %in% names(watched_counts)) as.integer(watched_counts[["No"]]) else 0L
watched_unsure <- if ("Unsure" %in% names(watched_counts)) as.integer(watched_counts[["Unsure"]]) else 0L
watched_yes <- if ("Yes" %in% names(watched_counts)) as.integer(watched_counts[["Yes"]]) else 0L

watch_labels <- dplyr::case_when(
  clean_wide$watch_frequency_level == 3 ~ "Daily",
  clean_wide$watch_frequency_level == 2 ~ "Weekly",
  clean_wide$watch_frequency_level == 1 ~ "Monthly",
  clean_wide$watch_frequency_level == 0 ~ "Never",
  TRUE ~ NA_character_
)

watch_labels <- factor(watch_labels, levels = c("Daily", "Weekly", "Monthly", "Never"), ordered = TRUE)
watch_counts <- table(watch_labels, useNA = "ifany")
watch_daily <- if ("Daily" %in% names(watch_counts)) as.integer(watch_counts[["Daily"]]) else 0L
watch_weekly <- if ("Weekly" %in% names(watch_counts)) as.integer(watch_counts[["Weekly"]]) else 0L
watch_monthly <- if ("Monthly" %in% names(watch_counts)) as.integer(watch_counts[["Monthly"]]) else 0L
watch_never <- if ("Never" %in% names(watch_counts)) as.integer(watch_counts[["Never"]]) else 0L

demographics_summary <- data.frame(
  participants_n = participants_n,
  competence_mean = competence_mean,
  competence_sd = competence_sd,
  elo_n = elo_n,
  elo_mean = elo_mean,
  elo_sd = elo_sd,
  stringsAsFactors = FALSE
)

write_csv(demographics_summary, file.path(tables_dir, "prelim_demographics_summary.csv"))

prelim_watched_before_counts <- data.frame(
  watched_before = c("No", "Unsure", "Yes"),
  count = c(watched_no, watched_unsure, watched_yes),
  stringsAsFactors = FALSE
)
write_csv(prelim_watched_before_counts, file.path(tables_dir, "prelim_watched_before_counts.csv"))

prelim_watch_frequency_counts <- data.frame(
  watch_frequency = c("Daily", "Weekly", "Monthly", "Never"),
  count = c(watch_daily, watch_weekly, watch_monthly, watch_never),
  stringsAsFactors = FALSE
)
write_csv(prelim_watch_frequency_counts, file.path(tables_dir, "prelim_watch_frequency_counts.csv"))

descriptive_lines <- c(
  sprintf("Participants (raw): %d", raw_n),
  sprintf("Participants (post-clean): %d", participants_n),
  sprintf("ELO available: %d", elo_n),
  if (elo_n > 0) sprintf("ELO M(SD): %.2f (%.2f)", elo_mean, elo_sd) else "ELO M(SD): NA (NA)",
  sprintf("Game knowledge M(SD): %.2f (%.2f)", competence_mean, competence_sd),
  sprintf("Watched before counts (No/Unsure/Yes): %d/%d/%d", watched_no, watched_unsure, watched_yes),
  sprintf("Watch frequency counts (Daily/Weekly/Monthly/Never): %d/%d/%d/%d", watch_daily, watch_weekly, watch_monthly, watch_never)
)

writeLines(descriptive_lines, con = file.path(reports_dir, "descriptive_summary.txt"))

message("Load/clean complete.")
