import { describe, expect, it } from "vitest";
import { callVertex, classifyError, redact, type GenerateClient } from "./vertex-client";
import { resolveAiConfig } from "./provider";

const vertexConfig = resolveAiConfig({ SAFEBITE_AI_MODE: "VERTEX", VERTEX_PROJECT_ID: "test-project", AI_TIMEOUT_MS: "5000" });
const request = { systemInstruction: "system", prompt: "prompt", responseSchema: { type: "OBJECT" } };

// A fake SDK client. It never touches the network.
function fakeClient(impl: () => Promise<{ text?: string }>): GenerateClient & { calls: number } {
  const client = {
    calls: 0,
    async generateContent() {
      client.calls += 1;
      return impl();
    },
  };
  return client;
}

describe("callVertex — successful responses", () => {
  it("returns the model text and passes the configured model and timeout", async () => {
    let seen: { model: string; timeoutMs: number } | null = null;
    const client: GenerateClient = {
      async generateContent(req) {
        seen = { model: req.model, timeoutMs: req.timeoutMs };
        return { text: '{"answer":"ok"}' };
      },
    };
    const result = await callVertex(vertexConfig, request, client);
    expect(result).toEqual({ ok: true, text: '{"answer":"ok"}' });
    expect(seen).toEqual({ model: "gemini-2.5-flash", timeoutMs: 5000 });
  });
});

describe("callVertex — failures are explicit", () => {
  it("reports a configuration error without calling the model", async () => {
    const client = fakeClient(async () => ({ text: "should not run" }));
    const config = resolveAiConfig({ SAFEBITE_AI_MODE: "VERTEX" });
    const result = await callVertex(config, request, client);
    expect(result).toMatchObject({ ok: false, code: "CONFIG_ERROR" });
    expect(client.calls).toBe(0);
  });

  it("reports missing credentials (no Application Default Credentials) as AUTH_FAILED", async () => {
    const client = fakeClient(async () => {
      throw new Error("Could not load the default credentials. Browse to https://cloud.google.com/docs/authentication");
    });
    const result = await callVertex(vertexConfig, request, client);
    expect(result).toMatchObject({ ok: false, code: "AUTH_FAILED" });
  });

  it("reports a timeout as TIMEOUT", async () => {
    const client = fakeClient(async () => {
      const error = new Error("The operation was aborted due to timeout");
      error.name = "AbortError";
      throw error;
    });
    const result = await callVertex(vertexConfig, request, client);
    expect(result).toMatchObject({ ok: false, code: "TIMEOUT" });
  });

  it("reports a model-side failure (for example, model not found or quota) as MODEL_ERROR", async () => {
    const client = fakeClient(async () => {
      throw new Error("[429 Too Many Requests] Resource exhausted");
    });
    const result = await callVertex(vertexConfig, request, client);
    expect(result).toMatchObject({ ok: false, code: "MODEL_ERROR" });
  });

  it("reports an empty model response as EMPTY_RESPONSE", async () => {
    const client = fakeClient(async () => ({ text: "   " }));
    const result = await callVertex(vertexConfig, request, client);
    expect(result).toMatchObject({ ok: false, code: "EMPTY_RESPONSE" });
  });
});

describe("classifyError and redact", () => {
  it("classifies by error type and message", () => {
    expect(classifyError(Object.assign(new Error("x"), { name: "TimeoutError" })).code).toBe("TIMEOUT");
    expect(classifyError(new Error("PERMISSION_DENIED: aiplatform.endpoints.predict")).code).toBe("AUTH_FAILED");
    expect(classifyError(new Error("something unexpected")).code).toBe("MODEL_ERROR");
  });

  it("never returns credential-like strings in details", () => {
    const secret = "ya29.a0AfH6SMBx1234567890abcdefghijklmnopqrstuvwxyz";
    const result = classifyError(new Error(`request failed with Bearer ${secret}`));
    expect(result.detail).not.toContain(secret);
    expect(result.detail).toContain("[redacted]");
  });

  it("truncates very long messages", () => {
    expect(redact("a ".repeat(500)).length).toBeLessThanOrEqual(240);
  });
});
