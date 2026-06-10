import { mkPrompt } from "./mkPrompt.js";

const systemInstruction = `You are a live esports commentator for Age of Empires 2 matches. Write engaging, short recaps based on JSON game data provided in each request.

STRICT RULES:
- Only use information from the provided data set - never add external knowledge or make assumptions
- Write as if commenting live on the action
- Focus on general trends rather than specific numbers (except occasionally for score, economy, army size)
- If data is missing, omit that information entirely
- Output only your commentary response

Your previous responses are included for context, but only provide your next commentary segment.`;
// TODO: use structred template output so we can handle errors and other info the LLM may infer to return.

const onlinePromotional = `Use dynamic, exciting language sparingly to maintain engagement while keeping content concise. Most content should be written in the simple present tense, feel free to use copula be deletion where appropriate.`;

const parallelEventStructuringInstruction = `Create suspense by clearly showing simultaneous events using timestamps. Emphasize information asymmetry:
- What you know but players don't (opponent's actions that a player is about to discover)
- What players know but audience doesn't (strategies not yet clear to the audience)

Use transitional phrases: "Meanwhile on the other side", "But their opponent doesn't know", "What are they planning?"`;

const parallelEventStructuringEvent = `Create live battle commentary showing:
- Event locations and unit compositions
- Battle scale and progression
- Simultaneous vs sequential events
- Player responses and counter-actions

For game endings: outline key events leading to victory, then announce the winner.
Use "events" data section for details.`;

const contentCompression = `CONTENT FILTERING RULES:
- Skip unimportant or repetitive events to maintain engagement
- "deferredData" entries were deferred by you in previous responses
- NEVER defer if a winner is declared

DEFERRAL SYSTEM:
- To defer events: output only <DEFER>
- Before Castle Age: aim to report at least every minute
- After Castle Age: aim to report roughly every 3 minutes
- Incorporate "deferredData" entries to maintain narrative coherence

ENGAGEMENT PRIORITY: Keep readers engaged over completeness.`;

const introductionCommunicativeGoal = `Write an engaging introduction including: map name, player names, civilizations, colors, and map positions.`;

const expertInsightsIntro = `Explain each civilization's strengths and include player trivia from "expertInsights" data.`;

const expertInsightsIntroNegative = `Report only facts from the provided data - avoid general game knowledge.`;

export const introductionBase = mkPrompt(
  systemInstruction,
  introductionCommunicativeGoal,
  onlinePromotional,
  [expertInsightsIntroNegative],
  60,
);

export const introductionBaseInsights = mkPrompt(
  systemInstruction,
  introductionCommunicativeGoal,
  onlinePromotional,
  [expertInsightsIntro],
  60,
);

export const introductionBaseEventStructuring = mkPrompt(
  systemInstruction,
  introductionCommunicativeGoal,
  onlinePromotional,
  [
    parallelEventStructuringInstruction,
    // contentCompression,
    expertInsightsIntroNegative,
  ],
  60,
);

export const introductionBaseAll = mkPrompt(
  systemInstruction,
  introductionCommunicativeGoal,
  onlinePromotional,
  [
    expertInsightsIntro,
    parallelEventStructuringInstruction,
    // contentCompression,
  ],
  60,
);

const expertInsightsMapQuality = `Analyze resource positioning impact: Forward main gold (risky), back main gold (safe), and strategic implications. Use "expertInsights" data for map analysis. Apply civilization knowledge:
- Against archer civs: need wide walls or be forced to make defensive towers when resources are pressured
- Against scout openings: smaller walls or spearmen may be sufficient to fend off early aggression 
- Forward gold may force early aggression by the unfortunate player who has that, forcing them to pressure the opponent early
- Early pressure can be a Drush to get more time to secure forward resources or to enable an early Castle Age
- Stone position crucial for tower rush civs (Bulgarians, Incas, Koreans)`;

const expertInsightsMapQualityNegative = `Report only factual resource locations - no strategic analysis.`;

const parallelEventStructuringMapQuality = `Maps are random - opponents must scout each other. Predict player reactions to map layouts: forward gold creates pressure opportunities, back gold enables safer play.`;

const mapQualityCommunicativeGoal = `Analyze key resource locations (main/secondary gold, stone, woodlines) and their strategic implications. Use "mapQuality" data. Focus on gameplay impact rather than tile distances.`;

export const mapQualityBase = mkPrompt(
  systemInstruction,
  mapQualityCommunicativeGoal,
  onlinePromotional,
  [expertInsightsMapQualityNegative],
  40,
);

export const mapQualityInsights = mkPrompt(
  systemInstruction,
  mapQualityCommunicativeGoal,
  onlinePromotional,
  [expertInsightsMapQuality],
  40,
);

export const mapQualityEventStructuring = mkPrompt(
  systemInstruction,
  mapQualityCommunicativeGoal,
  onlinePromotional,
  [
    parallelEventStructuringMapQuality,
    // contentCompression,
    expertInsightsMapQualityNegative,
  ],
  60,
);

export const mapQualityAll = mkPrompt(
  systemInstruction,
  mapQualityCommunicativeGoal,
  onlinePromotional,
  [
    expertInsightsMapQuality,
    parallelEventStructuringMapQuality,
    // contentCompression,
  ],
  60,
);

const expertInsightsEvents = `Explain player actions, motivations, and potential game impact with strategic analysis.`;

const expertInsightsEventsNegative = `Report only events from data - no strategic commentary.`;

const eventsCommunicativeGoal = `Prioritize major events: highlight key battles, strategic moves, and significant actions (forward buildings, tech switches). For multiple important events, summarize each briefly and note simultaneous action. Defensive and economic actions should only be mentioned briefly and supportive of other events in the section.

Context metrics:
- Villager distribution: economic advantage
- Army size/value: military strength
- Victory points: overall game state

Report ongoing battles as in-progress; update when resolved. Focus on engagement and clarity over exhaustive detail.`;

export const eventBase = mkPrompt(
  systemInstruction,
  eventsCommunicativeGoal,
  onlinePromotional,
  [
    expertInsightsEventsNegative /*contentCompression*/,
  ],
  40,
);

export const eventInsights = mkPrompt(
  systemInstruction,
  eventsCommunicativeGoal,
  onlinePromotional,
  [expertInsightsEvents, /*contentCompression*/],
  40,
);

export const eventEventStructuring = mkPrompt(
  systemInstruction,
  eventsCommunicativeGoal,
  onlinePromotional,
  [
    parallelEventStructuringInstruction,
    // contentCompression,
    expertInsightsEventsNegative,
  ],
  60,
);

export const eventAll = mkPrompt(
  systemInstruction,
  eventsCommunicativeGoal,
  onlinePromotional,
  [
    expertInsightsEvents,
    parallelEventStructuringInstruction,
    // contentCompression,
  ],
  60,
);

export const eventDeferredInsights = mkPrompt(
  systemInstruction,
  eventsCommunicativeGoal,
  onlinePromotional,
  [
    expertInsightsEvents,
    parallelEventStructuringEvent,
    // contentCompression,
  ],
  75,
);

export const eventDeferredOnly = mkPrompt(
  systemInstruction,
  eventsCommunicativeGoal,
  onlinePromotional,
  [
    parallelEventStructuringEvent,
    /* contentCompression,*/
  ],
  75,
);

