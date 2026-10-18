import { generateText, type LanguageModel } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogle } from "@ai-sdk/google";
import { createAnthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { execution } from "@sage/contracts/execution";
import { providerSchema, type Provider } from "@sage/contracts";
export const preparedPromptSchema = z.object({
  instructions: z.string(),
  inputJson: z.string(),
  previousResponses: z.array(z.string()),
});
export type PreparedPrompt = z.infer<typeof preparedPromptSchema>;
export function environmentProvider(): Provider {
  return providerSchema.parse({
    kind:
      process.env["SAGE_REALISER"] ??
      (process.env["DISABLE_LLM"] === "false" ? "gemini" : "templates"),
    model: process.env["SAGE_MODEL"] ?? "",
    baseUrl: process.env["SAGE_BASE_URL"] ?? "",
  });
}
export function usesModel() {
  return (
    (execution.getStore()?.provider ?? environmentProvider()).kind !==
    "templates"
  );
}
export function environmentKey(kind: Provider["kind"]) {
  return process.env[
    {
      gemini: "GEMINI_API_KEY",
      anthropic: "ANTHROPIC_API_KEY",
      openai: "OPENAI_API_KEY",
      templates: "",
    }[kind]
  ];
}
export function isLocalProvider(provider: Provider) {
  return Boolean(
    provider.kind === "openai" &&
      provider.baseUrl &&
      ["localhost", "127.0.0.1", "[::1]"].includes(
        new URL(provider.baseUrl).hostname,
      ),
  );
}
export function requestTimeoutMs(provider: Provider) {
  // Local inference includes model loading and prompt evaluation on shared memory.
  return provider.timeoutMs ?? (isLocalProvider(provider) ? 300000 : 60000);
}
export function validateProvider(provider: Provider, apiKey?: string) {
  if (provider.kind === "templates") return;
  if (!provider.model.trim())
    throw new Error("Choose an explicit model identifier");
  if (provider.baseUrl) {
    const url = new URL(provider.baseUrl);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error(
        "Use an HTTP(S) API base URL without credentials, query or fragment",
      );
  }
  const local = isLocalProvider(provider);
  if (!apiKey && !local)
    throw new Error(
      "Set your API key in local settings or the provider environment variable",
    );
}
export async function realizePrompt(
  value: PreparedPrompt,
  options: { timeoutMs?: number; maxRetries?: number } = {},
) {
  const prompt = preparedPromptSchema.parse(value);
  if (Buffer.byteLength(JSON.stringify(prompt)) > 190000)
    throw new Error(
      "Prepared prompt exceeds the 190 KB trace limit; reduce the selected facts",
    );
  const context = execution.getStore();
  const selectedProvider = context?.provider ?? environmentProvider();
  const provider =
    selectedProvider.kind === "gemini"
      ? {
          ...selectedProvider,
          thinkingBudget:
            selectedProvider.thinkingBudget === undefined
              ? 0
              : selectedProvider.thinkingBudget,
        }
      : selectedProvider;
  const key = context?.apiKey ?? environmentKey(provider.kind);
  validateProvider(provider, key);
  if (provider.kind === "templates")
    throw new Error(
      "Use the template realizer for offline template generation",
    );
  let model: LanguageModel;
  const settings = {
    apiKey: key ?? "local",
    ...(provider.baseUrl ? { baseURL: provider.baseUrl } : {}),
  };
  if (provider.kind === "gemini")
    model = createGoogle(settings)(provider.model);
  else if (provider.kind === "anthropic")
    model = createAnthropic(settings)(provider.model);
  else model = createOpenAI(settings).chat(provider.model);
  const timeoutMs = options.timeoutMs ?? requestTimeoutMs(provider);
  const maxOutputTokens =
    2048 + (provider.kind === "gemini" ? (provider.thinkingBudget ?? 0) : 0);
  context?.emit?.("prompt", {
    ...prompt,
    provider,
    timeoutMs,
    maxOutputTokens,
  });
  const start = performance.now();
  try {
    const result = await generateText({
      model,
      instructions: prompt.instructions,
      messages: [
        ...prompt.previousResponses.map((content) => ({
          role: "assistant" as const,
          content,
        })),
        { role: "user", content: prompt.inputJson },
      ],
      ...(provider.kind === "gemini" && provider.thinkingBudget !== null
        ? {
            providerOptions: {
              google: {
                thinkingConfig: {
                  thinkingBudget: provider.thinkingBudget ?? 0,
                },
              },
            },
          }
        : provider.kind === "openai" && provider.reasoningEffort
          ? {
              providerOptions: {
                openai: { reasoningEffort: provider.reasoningEffort },
              },
            }
          : {}),
      maxOutputTokens,
      maxRetries: options.maxRetries ?? 2,
      timeout: timeoutMs,
      ...(context?.signal ? { abortSignal: context.signal } : {}),
    });
    if (!result.text.trim()) {
      context?.emit?.("error", {
        message: "Provider returned no commentary text",
        finishReason: result.finishReason,
        usage: result.totalUsage,
        reasoningCharacters: result.reasoningText?.length ?? 0,
      });
      throw new Error(
        result.finishReason === "length"
          ? "The model used its output limit without returning commentary. Set Thinking to Off for direct commentary, or use a model that needs less reasoning."
          : "Provider returned no commentary text",
      );
    }
    context?.emit?.("response", {
      text: result.text,
      usage: result.totalUsage,
      finishReason: result.finishReason,
      elapsedMs: performance.now() - start,
      provider,
    });
    return result.text;
  } catch (error) {
    let message =
      error instanceof Error ? error.message : "Provider request failed";
    if (
      error instanceof Error &&
      error.name === "TimeoutError" &&
      !context?.signal?.aborted
    )
      message = `Model request timed out after ${timeoutMs / 1000} seconds while waiting for ${provider.model}. Increase Model request timeout in Settings, or try a smaller model.`;
    if (key) message = message.split(key).join("[redacted]");
    context?.emit?.("error", {
      message,
      provider,
      timeoutMs,
      elapsedMs: performance.now() - start,
    });
    throw new Error(message);
  }
}
