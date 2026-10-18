import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { execution } from "@sage/contracts/execution";
import {
  realizePrompt,
  validateProvider,
  requestTimeoutMs,
} from "../src/index.js";
const prompt = {
  instructions: "Describe only the facts.",
  inputJson: '{"winner":"A"}',
  previousResponses: [],
};
test("provider transports, isolation, usage, errors, deadlines and exact prepared input", async () => {
  const requests: any[] = [];
  const server = http.createServer(async (req, res) => {
    let raw = "";
    for await (const part of req) raw += part;
    const body = JSON.parse(raw);
    requests.push({
      url: req.url,
      body,
      authorization: req.headers.authorization,
      key: req.headers["x-api-key"] ?? req.headers["x-goog-api-key"],
    });
    if (raw.includes("timeout-model")) return;
    if (raw.includes("reasoning-only-model")) {
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          id: "reasoning",
          object: "chat.completion",
          created: 1,
          model: body.model,
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: "",
                reasoning_content: "Working through the facts",
              },
              finish_reason: "length",
            },
          ],
          usage: {
            prompt_tokens: 12,
            completion_tokens: 2048,
            total_tokens: 2060,
          },
        }),
      );
      return;
    }
    res.setHeader("Content-Type", "application/json");
    if (raw.includes("fail-model")) {
      res.statusCode = 401;
      res.end(
        JSON.stringify({
          error: { message: "invalid key", type: "authentication_error" },
        }),
      );
      return;
    }
    if (req.url?.includes("generateContent"))
      res.end(
        JSON.stringify({
          candidates: [
            {
              content: {
                role: "model",
                parts: [{ text: "Google commentary" }],
              },
              finishReason: "STOP",
            },
          ],
          usageMetadata: {
            promptTokenCount: 12,
            candidatesTokenCount: 3,
            totalTokenCount: 15,
          },
        }),
      );
    else if (req.url?.includes("/messages"))
      res.end(
        JSON.stringify({
          id: "msg_mock",
          type: "message",
          role: "assistant",
          model: body.model,
          content: [{ type: "text", text: "Anthropic commentary" }],
          stop_reason: "end_turn",
          stop_sequence: null,
          usage: { input_tokens: 12, output_tokens: 3 },
        }),
      );
    else
      res.end(
        JSON.stringify({
          id: "mock",
          object: "chat.completion",
          created: 1,
          model: body.model,
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: "OpenAI commentary" },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 12, completion_tokens: 3, total_tokens: 15 },
        }),
      );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${(server.address() as any).port}/v1`;
  try {
    const traces: any[][] = [[], [], []];
    const result = await Promise.all(
      (["gemini", "anthropic", "openai"] as const).map((kind, i) =>
        execution.run(
          {
            provider: { kind, model: `mock-${i}`, baseUrl },
            apiKey: `key-${i}`,
            emit: (stage, data) => traces[i]!.push({ stage, data }),
          },
          () => realizePrompt(prompt),
        ),
      ),
    );
    assert.deepEqual(result, [
      "Google commentary",
      "Anthropic commentary",
      "OpenAI commentary",
    ]);
    for (let i = 0; i < 3; i++) {
      assert.equal(traces[i]![0].data.inputJson, prompt.inputJson);
      assert.equal(traces[i]![1].data.usage.totalTokens, 15);
      const req = requests.find((x) => JSON.stringify(x).includes(`mock-${i}`));
      assert.ok(JSON.stringify(req).includes(`key-${i}`));
      assert.ok(!JSON.stringify(req).includes(`key-${(i + 1) % 3}`));
    }
    const googleRequest = requests.find((x) =>
      x.url.includes("generateContent"),
    );
    assert.equal(
      googleRequest.body.generationConfig.thinkingConfig.thinkingBudget,
      0,
    );
    assert.equal(traces[0]![0].data.provider.thinkingBudget, 0);
    for (const budget of [4096, null]) {
      const budgetTrace: any[] = [];
      await execution.run(
        {
          provider: {
            kind: "gemini",
            model: "mock-budget",
            baseUrl,
            thinkingBudget: budget,
          },
          apiKey: "test-budget-key",
          emit: (stage, data) => budgetTrace.push({ stage, data }),
        },
        () => realizePrompt(prompt),
      );
      assert.equal(
        requests.at(-1).body.generationConfig.thinkingConfig?.thinkingBudget,
        budget === null ? undefined : budget,
      );
      assert.equal(budgetTrace[0].data.provider.thinkingBudget, budget);
      assert.equal(
        requests.at(-1).body.generationConfig.maxOutputTokens,
        2048 + (budget ?? 0),
      );
    }
    await assert.rejects(
      execution.run(
        { provider: { kind: "openai", model: "fail-model", baseUrl } },
        () => realizePrompt(prompt, { maxRetries: 0 }),
      ),
      /invalid key/,
    );
    await assert.rejects(
      execution.run(
        { provider: { kind: "openai", model: "timeout-model", baseUrl } },
        () => realizePrompt(prompt, { timeoutMs: 30, maxRetries: 0 }),
      ),
      /Model request timed out after 0.03 seconds/,
    );
    await execution.run(
      {
        provider: {
          kind: "openai",
          model: "thinking-off-model",
          baseUrl,
          reasoningEffort: "none",
          timeoutMs: 1000,
        },
      },
      () => realizePrompt(prompt),
    );
    assert.equal(requests.at(-1).body.reasoning_effort, "none");
    assert.equal(requests[0].body.reasoning_effort, undefined);
    await assert.rejects(
      execution.run(
        {
          provider: { kind: "openai", model: "reasoning-only-model", baseUrl },
        },
        () => realizePrompt(prompt),
      ),
      /output limit without returning commentary/,
    );
    assert.throws(() =>
      validateProvider({ kind: "gemini", model: "", baseUrl: "" }),
    );
    assert.throws(() =>
      validateProvider({
        kind: "openai",
        model: "remote",
        baseUrl: "https://example.org/v1",
      }),
    );
    validateProvider({ kind: "openai", model: "local", baseUrl });
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

// Preserve hosted deadlines while allowing cold/slow loopback inference to finish.
test("local inference has a five-minute deadline without extending hosted calls", () => {
  for (const host of ["127.0.0.1", "localhost", "[::1]"])
    assert.equal(
      requestTimeoutMs({
        kind: "openai",
        model: "local",
        baseUrl: `http://${host}:11434/v1`,
      }),
      300000,
    );
  assert.equal(
    requestTimeoutMs({
      kind: "openai",
      model: "hosted",
      baseUrl: "https://example.com/v1",
    }),
    60000,
  );
  assert.equal(
    requestTimeoutMs({ kind: "openai", model: "hosted", baseUrl: "" }),
    60000,
  );
  assert.equal(
    requestTimeoutMs({
      kind: "gemini",
      model: "hosted",
      baseUrl: "http://localhost:1234",
    }),
    60000,
  );
});

test("saved model timeout overrides the transport default", () => {
  assert.equal(
    requestTimeoutMs({
      kind: "openai",
      model: "local",
      baseUrl: "http://127.0.0.1:11434/v1",
      timeoutMs: 600000,
    }),
    600000,
  );
});
