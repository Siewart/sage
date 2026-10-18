import * as dotenv from "dotenv";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { realizePrompt, usesModel } from "@sage/llm";
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, ".env"), override: false });
export const mkPrompt = (
  systemInstruction: string,
  communicativeGoal: string,
  writingStyle: string,
  additionalNotes: string[] = [],
  targetLengthInWords = 30,
  _disableThinking = true,
) => {
  const instructions = {
    baseInstructions: systemInstruction,
    outputFormat:
      "plain text, **no markup** (i.e. no HTML, Markdown, etc.), **use real newlines** not escaped/stringified newlines. The timestamp will be added automatically; do not include it in your response.", // Prompt formatting should help LLM Performance 10.48550/arXiv.2411.10541, I do wonder if using markup to tell it to use not use markup interferes - but in my experience LLMs are good at converting between formats (e.g. JSON to plain text or between programming languages)
    outputLength: `Feel free to use any number of words, but your entire response has a **${targetLengthInWords} words limit.**`,
    outputLanguage: "English",
    communicativeGoal,
    writingStyle,
    additionalNotes,
  };
  return async (
    data: object,
    echoJsonInstead = false,
    previousResponses: string[] = [],
  ) => {
    if (echoJsonInstead || !usesModel()) return JSON.stringify(data, null, 2);
    return realizePrompt({
      instructions: JSON.stringify(instructions),
      inputJson: JSON.stringify(data, null, 2),
      previousResponses,
    });
  };
};
