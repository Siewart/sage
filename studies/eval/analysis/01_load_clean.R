library(dplyr)
library(tidyr)
library(stringr)

clean_dir <- file.path("data", "clean")
tables_dir <- file.path("output", "tables")
reports_dir <- file.path("output", "reports")
diagnostics_dir <- file.path("output", "diagnostics")

for (d in c(clean_dir, tables_dir, reports_dir, diagnostics_dir)) {
  dir.create(d, recursive = TRUE, showWarnings = FALSE)
}

raw <- read.csv("data/eval-data.csv", stringsAsFactors = FALSE, check.names = FALSE)
raw_total_rows <- nrow(raw)

# Rows 1-2 are Qualtrics header rows; 3 and 7 were dropped after manual review
# (one straightlined response, one with junk open-text answers).
header_rows <- c(1, 2)
fake_rows <- c(3, 7)
rows_to_drop <- sort(unique(c(header_rows, fake_rows)))
rows_to_drop <- rows_to_drop[rows_to_drop <= raw_total_rows]

dropped <- data.frame(
  row = rows_to_drop,
  reason = ifelse(rows_to_drop %in% header_rows, "header", "fake_response"),
  ResponseId = if ("ResponseId" %in% names(raw)) as.character(raw$ResponseId[rows_to_drop]) else NA_character_,
  stringsAsFactors = FALSE
)
write.csv(dropped, file.path(tables_dir, "raw_rows_dropped.csv"), row.names = FALSE)

raw <- raw[-rows_to_drop, , drop = FALSE]

# Q2.3 Elo: option 1 means "no rating", the rest map to rating-band midpoints.
elo_midpoint <- function(x) c(NA, 200, 600, 1000, 1400, 1800, 2200)[as.integer(x)]

# Q2.4 viewing frequency, as an ordered factor.
viewing_habits <- function(x) {
  levels <- c(
    "Several times per week",
    "Once a week",
    "Once a month",
    "Only during some large events",
    "Never"
  )
  factor(levels[as.integer(x)], levels = levels, ordered = TRUE)
}

# Each text's position in the survey is encoded in the FL_*_DO display-order
# columns as tokens like "T2M3". Pull out where each of the 4 texts landed.
text_order <- function(row_values, fl_columns) {
  vals <- unlist(row_values[fl_columns], use.names = FALSE)
  vals <- vals[!is.na(vals) & nzchar(vals)]
  vals <- vals[grepl("T[0-9]+M[0-9]+", vals)]
  if (length(vals) == 0) {
    return(rep(NA_integer_, 4))
  }

  tokens <- strsplit(vals[[1]], "\\|")[[1]]
  text_ids <- as.integer(sub(".*T([0-9]+)M[0-9]+.*", "\\1", tokens))

  order_map <- rep(NA_integer_, 4)
  for (i in seq_along(text_ids)) {
    id <- text_ids[[i]]
    if (!is.na(id) && id >= 1 && id <= 4) order_map[[id]] <- i
  }
  order_map
}

normalize_single_line <- function(x) {
  val <- ifelse(is.na(x), "", as.character(x))
  val <- gsub("[\r\n]+", " ", val)
  val <- gsub("[[:space:]]+", " ", val)
  trimws(val)
}

# The survey shows each participant 4 texts, 23 columns per text starting at
# column 15. text_pairs / module_pairs say which TextId and module config each
# block belongs to; module_to_enable says which modules were on for each config.
condition_indices <- seq(from = 15, by = 23, length.out = 16)
question_offsets <- c(0:13, 15:21)
comment_offset <- 22

text_pairs <- list(c(1, 11, 15, 16), c(2, 7, 10, 12), c(3, 5, 8, 13), c(4, 6, 9, 14))
module_pairs <- list(c(1, 12, 13, 14), c(2, 8, 9, 11), c(3, 6, 7, 15), c(4, 5, 10, 16))
module_to_enable <- list(c(TRUE, TRUE), c(FALSE, FALSE), c(TRUE, FALSE), c(FALSE, TRUE))

condition_id <- function(col_index, pairs) {
  block <- floor((col_index - 15) / 23) + 1
  hit <- which(vapply(pairs, function(p) block %in% p, logical(1)))
  if (length(hit) == 0) NA_integer_ else hit[[1]]
}

fl_columns <- grep("^FL_[0-9]+_DO$", names(raw), value = TRUE)

eval_rows <- list()
participant_rows <- list()

for (r in seq_len(nrow(raw))) {
  row_values <- raw[r, , drop = FALSE]
  pid <- as.character(row_values$ResponseId)

  participant_rows[[r]] <- data.frame(
    participantId = pid,
    SelfAssessment = suppressWarnings(as.integer(row_values$Q2.1)),
    Elo = elo_midpoint(row_values$Q2.3),
    ViewingHabits = as.character(viewing_habits(row_values$Q2.4)),
    EnglishProficiency = as.integer(row_values$Q2.2) - 6,
    AICount = as.integer(row_values$Q20.2) - 1,
    AISentiment = as.integer(row_values$Q20.3),
    AIUtility = as.integer(row_values$Q20.4),
    HasWithdrawalEmail = {
      v <- trimws(as.character(row_values$Q20.6))
      !is.na(v) && nzchar(v)
    },
    stringsAsFactors = FALSE
  )

  order_map <- text_order(row_values, fl_columns)

  for (idx in condition_indices) {
    factor_cols <- idx + question_offsets
    comment_col <- idx + comment_offset
    if (max(factor_cols) > ncol(raw) || comment_col > ncol(raw)) next

    responses <- as.character(unlist(row_values[factor_cols], use.names = FALSE))
    if (any(is.na(responses) | !nzchar(responses))) next

    module_id <- condition_id(idx, module_pairs)
    text_id <- condition_id(idx, text_pairs)
    if (is.na(module_id) || is.na(text_id)) next

    flags <- module_to_enable[[module_id]]

    eval_rows[[length(eval_rows) + 1]] <- data.frame(
      participantId = pid,
      TextId = as.integer(text_id),
      Order = as.integer(order_map[[text_id]]),
      EventStructuring = flags[[1]],
      ExpertInsights = flags[[2]],
      OpenText = normalize_single_line(row_values[[comment_col]]),
      matrix(as.integer(responses), nrow = 1, dimnames = list(NULL, paste0("col", 1:21))),
      stringsAsFactors = FALSE
    )
  }
}

if (length(eval_rows) == 0) {
  stop("No evaluation rows were built from eval-data.csv. Check the column indexing.")
}

texts <- bind_rows(eval_rows) %>%
  group_by(participantId) %>%
  mutate(Order_c = scale(Order, center = TRUE, scale = FALSE)[, 1]) %>%
  ungroup()

participants <- bind_rows(participant_rows) %>%
  distinct(participantId, .keep_all = TRUE) %>%
  arrange(participantId)

# Item-level file (raw col1..col21), used for reliability and re-deriving outcomes.
texts_export <- texts %>%
  select(
    participantId, TextId, Order, Order_c,
    EventStructuring, ExpertInsights, OpenText, starts_with("col")
  ) %>%
  arrange(participantId, TextId, Order, EventStructuring, ExpertInsights)

# Analysis file: the 14 averaged construct scores.
long_export <- texts %>%
  mutate(
    col20_r = 8 - col20, # skip/skim amount reversed so higher = more thorough
    cons1_competitive_enjoy = (col1 + col2) / 2,
    cons2_learning = (col3 + col4) / 2,
    cons3_expertise_enjoy = (col5 + col6) / 2,
    cons4_awe_novelty = (col7 + col8) / 2,
    cons5_fun = (col9 + col10) / 2,
    cons6_excitement = (col11 + col12) / 2,
    cons7_immersion = (col13 + col14) / 2,
    cons8_quality = col15,
    cons9_word_choice = col16,
    cons10_ease_reading = col17,
    cons11_orderliness = col18,
    cons12_detail_level = col19,
    cons13_thoroughness = col20_r,
    cons14_understanding = col21
  ) %>%
  select(
    participantId, TextId, Order, Order_c,
    EventStructuring, ExpertInsights, OpenText,
    cons1_competitive_enjoy, cons2_learning, cons3_expertise_enjoy,
    cons4_awe_novelty, cons5_fun, cons6_excitement, cons7_immersion,
    cons8_quality, cons9_word_choice, cons10_ease_reading,
    cons11_orderliness, cons12_detail_level, cons13_thoroughness,
    cons14_understanding
  ) %>%
  arrange(participantId, TextId, Order, EventStructuring, ExpertInsights)

write.csv(texts_export, file.path(clean_dir, "eval-texts-data.csv"), row.names = FALSE)
write.csv(long_export, file.path(clean_dir, "eval-long-data.csv"), row.names = FALSE)
write.csv(participants, file.path(clean_dir, "eval-participants.csv"), row.names = FALSE)

coverage <- long_export %>%
  count(participantId, name = "n_texts") %>%
  arrange(participantId)
write.csv(coverage, file.path(tables_dir, "participant_text_coverage.csv"), row.names = FALSE)

writeLines(
  c(
    sprintf("Raw rows: %d", raw_total_rows),
    sprintf("Dropped (header): %d", length(header_rows)),
    sprintf("Dropped (fake/test): %d", length(fake_rows)),
    sprintf("Evaluations: %d", nrow(long_export)),
    sprintf("Participants: %d", nrow(participants)),
    sprintf("Rows missing Order: %d", sum(is.na(texts_export$Order))),
    sprintf("Withdrawal emails provided: %d", sum(participants$HasWithdrawalEmail, na.rm = TRUE))
  ),
  file.path(reports_dir, "load_clean_summary.txt")
)

message("Load/clean complete.")
