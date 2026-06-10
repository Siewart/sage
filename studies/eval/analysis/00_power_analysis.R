library(dplyr)
library(tidyr)
library(lme4)
library(lmerTest)
library(simr)

tables_dir <- file.path("output", "tables")
reports_dir <- file.path("output", "reports")
diagnostics_dir <- file.path("output", "diagnostics")
for (d in c(tables_dir, reports_dir, diagnostics_dir)) {
  dir.create(d, recursive = TRUE, showWarnings = FALSE)
}

args <- commandArgs(trailingOnly = TRUE)
run_sim <- "--with-power" %in% args

if ("--random-seed" %in% args) {
  message("Using a non-deterministic random seed.")
  set.seed(NULL)
} else {
  message("Using a fixed random seed (11) for reproducibility.")
  set.seed(11)
}

normalize_text <- function(x) trimws(gsub("[[:space:]]+", " ", as.character(x)))

# SD of participant mean ratings from the prelim study, used to scale the
# simulated effects below. Precalculated value is used if prelim data is absent.
fallback_sd_prev_7pt <- 0.5717992

sd_from_prelim <- function(path = "../prelim/data/prelim-data.csv") {
  if (!file.exists(path)) {
    message("Prelim data not found at ", path, "; using precalculated sd = ", fallback_sd_prev_7pt)
    return(fallback_sd_prev_7pt)
  }

  raw <- read.csv(path, stringsAsFactors = FALSE, check.names = FALSE)

  recode_c <- c(
    "Not Relevant" = 1, "Slightly Relevant" = 2, "Relevant" = 3,
    "Very Relevant" = 4, "Required" = 5, "I don't know" = NA_real_
  )
  recode_g <- c(
    "Strongly Disagree" = 1, "Disagree" = 2, "Neutral" = 3,
    "Agree" = 4, "Strongly Agree" = 5, "Does Not Apply" = NA_real_
  )
  names(recode_c) <- normalize_text(names(recode_c))
  names(recode_g) <- normalize_text(names(recode_g))

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

  c_num <- sapply(raw[c_item_cols], function(x) as.numeric(recode_c[normalize_text(x)]))
  g_num <- sapply(raw[g_item_cols], function(x) as.numeric(recode_g[normalize_text(x)]))

  means_5pt <- rowMeans(cbind(c_num, g_num), na.rm = TRUE)
  means_5pt <- means_5pt[is.finite(means_5pt)]

  sd_5pt <- sd(means_5pt)
  sd_5pt * ((7 - 1) / (5 - 1)) # rescale 5-point SD to the 7-point scale
}

sd_prev_7pt <- sd_from_prelim()

alpha <- 0.05
nsim <- 2000

# Target effect of 0.5 points on the 7-point scale.
beta_target <- 0.5
base_frac <- beta_target / sd_prev_7pt

beta_ES <- base_frac * sd_prev_7pt
beta_EI <- base_frac * sd_prev_7pt
beta_INT <- (base_frac * 0.50) * sd_prev_7pt
beta_Order <- -0.05 * sd_prev_7pt

sd_subj_intercept <- sd_prev_7pt
sd_text_intercept <- 0.30 * sd_prev_7pt
sd_ES_slope <- 0.40 * sd_prev_7pt
sd_EI_slope <- 0.40 * sd_prev_7pt
sd_residual <- sd_prev_7pt

make_design <- function(N) {
  subjects <- factor(seq_len(N))
  texts <- c("A", "B", "C", "D")

  design <- do.call(rbind, lapply(subjects, function(s) {
    text_order <- sample(texts, 4)
    es_ei <- data.frame(ES = c(0, 1, 0, 1), EI = c(0, 0, 1, 1))
    es_ei <- es_ei[sample(1:4), ]
    data.frame(participant = s, TextId = text_order, Order = 1:4, ES = es_ei$ES, EI = es_ei$EI)
  }))

  design$TextId <- factor(design$TextId, levels = texts)
  design$Order_c <- scale(design$Order, center = TRUE, scale = FALSE)[, 1]
  design$EventStructuring <- factor(design$ES, labels = c("off", "on"))
  design$ExpertInsights <- factor(design$EI, labels = c("off", "on"))
  contrasts(design$EventStructuring) <- contr.sum(2)
  contrasts(design$ExpertInsights) <- contr.sum(2)
  design
}

simulate_y <- function(design) {
  S <- nlevels(design$participant)
  T <- nlevels(design$TextId)

  b0_subj <- rnorm(S, 0, sd_subj_intercept)
  bES_subj <- rnorm(S, 0, sd_ES_slope)
  bEI_subj <- rnorm(S, 0, sd_EI_slope)
  b0_text <- rnorm(T, 0, sd_text_intercept)

  linpred <- with(
    design,
    beta_ES * ES + beta_EI * EI + beta_INT * ES * EI + beta_Order * Order_c +
      b0_subj[as.integer(participant)] +
      bES_subj[as.integer(participant)] * ES +
      bEI_subj[as.integer(participant)] * EI +
      b0_text[as.integer(TextId)]
  )

  design$y <- linpred + rnorm(nrow(design), 0, sd_residual)
  design
}

fit_model <- function(dat) {
  lmer(
    y ~ EventStructuring * ExpertInsights + Order_c +
      (1 | TextId) + (1 + EventStructuring + ExpertInsights || participant),
    data = dat, REML = TRUE
  )
}

run_power <- function(N_start = 8, N_max = 12, by = 1, nsim = 2000, alpha = 0.05, seed = 11) {
  set.seed(seed)

  model <- fit_model(simulate_y(make_design(N_start)))
  m_ext <- extend(model, along = "participant", n = N_max)
  breaks_seq <- seq(N_start, N_max, by = by)

  curve <- function(term) {
    powerCurve(m_ext,
      test = fixed(term, "t"), along = "participant",
      breaks = breaks_seq, nsim = nsim, alpha = alpha, seed = seed
    )
  }

  list(
    pc_ES = curve("EventStructuring1"),
    pc_EI = curve("ExpertInsights1"),
    pc_INT = curve("EventStructuring1:ExpertInsights1")
  )
}

if (!run_sim) {
  writeLines(
    c(
      "Power analysis was not executed.",
      "Run with --with-power to run the Monte Carlo power estimation."
    ),
    file.path(reports_dir, "power_summary.txt")
  )
  message("Power analysis skipped (pass --with-power to run it).")
} else {
  pw <- run_power(nsim = nsim, alpha = alpha)

  s_es <- summary(pw$pc_ES)
  s_ei <- summary(pw$pc_EI)
  s_int <- summary(pw$pc_INT)

  extract_curve <- function(s, label) {
    s <- s[!is.na(s$nlevels), ]
    data.frame(effect = label, n_participants = s$nlevels, power = s$mean, lower = s$lower, upper = s$upper)
  }

  power_table <- bind_rows(
    extract_curve(s_es, "EventStructuring"),
    extract_curve(s_ei, "ExpertInsights"),
    extract_curve(s_int, "Interaction")
  )
  write.csv(power_table, file.path(tables_dir, "power_curve.csv"), row.names = FALSE)

  n80 <- power_table %>%
    group_by(effect) %>%
    summarise(n80 = ifelse(any(power >= 0.80), min(n_participants[power >= 0.80]), NA_integer_), .groups = "drop")
  write.csv(n80, file.path(tables_dir, "power_n80.csv"), row.names = FALSE)

  png(file.path(diagnostics_dir, "power_curve.png"), width = 1200, height = 800, res = 140)
  plot(s_es$nlevels, s_es$mean,
    type = "l", col = "blue", lwd = 2,
    ylim = c(0, 1), xlab = "Number of participants", ylab = "Power",
    main = "Power curves (2x2 within-subject LMM)"
  )
  lines(s_ei$nlevels, s_ei$mean, col = "darkgreen", lwd = 2)
  lines(s_int$nlevels, s_int$mean, col = "red", lwd = 2)
  abline(h = 0.80, lty = 2)
  legend("bottomright",
    legend = c("EventStructuring", "ExpertInsights", "Interaction"),
    col = c("blue", "darkgreen", "red"), lwd = 2
  )
  dev.off()

  writeLines(
    c(
      sprintf("alpha = %.2f, nsim = %d", alpha, nsim),
      sprintf("Target effect: %.2f points on the 7-point scale", beta_target),
      sprintf("sd_prev_7pt used: %.7f", sd_prev_7pt),
      "Participants needed for >= 80% power:",
      sprintf("  %s: %s", n80$effect, ifelse(is.na(n80$n80), "not reached", as.character(n80$n80)))
    ),
    file.path(reports_dir, "power_summary.txt")
  )
  message("Power analysis complete.")
}
