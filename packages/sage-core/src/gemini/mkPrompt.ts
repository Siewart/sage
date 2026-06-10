import { GoogleGenAI } from "@google/genai";
import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";

const STANDALONE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
dotenv.config({ path: path.join(STANDALONE_ROOT, ".env.local") });
dotenv.config({ path: path.join(STANDALONE_ROOT, ".env"), override: false });

const key = process.env["GEMINI_API_KEY"] ?? "DUMMY_KEY";
const ai = new GoogleGenAI({ apiKey: key });
let lastRequestTime = 0;
const requestInterval = 20000; //20000; // 20 seconds

// Defaults to true (LLM disabled). Set DISABLE_LLM=false in .env.local to enable.
const DISABLE_LLM = process.env["DISABLE_LLM"] !== "false";
export const mkPrompt = (
  systemInstruction: string,
  communicativeGoal: string,
  writingStyle: string,
  additionalNotes: Array<string> = [],
  // shots: Array<string> = [],
  targetLengthInWords: number = 30,
  disableThinking: boolean = true,
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
  // TODO: Use a more expressive template? e.g. {status: "ok", nextUpdate: "..."} | {status: "error", explanation: "..."}
  // if so: instruct and give template

  const thinkingObject = disableThinking
    ? {
        thinkingConfig: {
          thinkingBudget: 0, // Disables thinking
        },
      }
    : {};

  return async (
    data: object,
    echoJsonInstead = false,
    previousResponses: string[] = [], // TODO: Retain user prompts as well?
  ) => {
    if (echoJsonInstead || DISABLE_LLM) {
      return JSON.stringify(data, null, 2);
    }
    lastRequestTime = Date.now();
    if (Date.now() - lastRequestTime < requestInterval) {
      console.warn(
        `Rate limit exceeded. Waiting for ${requestInterval} ms before next request.`,
      );
      await new Promise((resolve) => setTimeout(resolve, requestInterval));
    }
    const contents = [];

    if (previousResponses.length > 0) {
      contents.push({
        role: "model",
        parts: [{ text: previousResponses.join("\n\n") }],
      });
    }

    contents.push({
      role: "user",
      parts: [{ text: JSON.stringify(data, null, 2) }],
    });

    const start = Date.now();
    const response = await ai.models.generateContent({
      model: "models/gemini-2.5-flash",
      contents,
      config: {
        systemInstruction: JSON.stringify(instructions),
        temperature: 1,
        seed: 1,
        ...thinkingObject,
      },
    });

    // console.log(JSON.stringify(instructions));
    const end = Date.now();
    console.log(
      `generateContent took ${end - start} ms and was ${response.text ? "successful" : "unsuccessful"}`,
    );
    return (
      response.text ??
      "<<----- ERROR: No response text returned - likely over loading the requests/minute limit. ----->>"
    );
  };
};

