// Gemini on Vertex AI through the official @google/genai SDK.
//
// Authentication uses Google Cloud Application Default Credentials (ADC). The SDK
// reads them automatically from `gcloud auth application-default login`, from
// GOOGLE_APPLICATION_CREDENTIALS, or from the attached service account on Cloud Run.
// No access token is stored in the environment.
//
// Every failure is turned into an explicit error code. Nothing here returns demo text.

import type { Schema } from "@google/genai";
import type { AiConfig } from "./provider";

export type VertexErrorCode = "CONFIG_ERROR" | "AUTH_FAILED" | "TIMEOUT" | "MODEL_ERROR" | "EMPTY_RESPONSE";

export type VertexResult = { ok: true; text: string } | { ok: false; code: VertexErrorCode; detail: string };

export interface GenerateRequest {
  model: string;
  systemInstruction: string;
  prompt: string;
  responseSchema: unknown;
  timeoutMs: number;
  temperature?: number;
}

// The only surface the rest of the app depends on. Tests substitute a fake.
export interface GenerateClient {
  generateContent(request: GenerateRequest): Promise<{ text?: string }>;
}

// Removes anything that looks like a credential before a message is shown or logged.
export function redact(message: string): string {
  return message
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [redacted]")
    .replace(/[A-Za-z0-9_\-.]{32,}/g, "[redacted]")
    .slice(0, 240);
}

export function classifyError(error: unknown): { code: VertexErrorCode; detail: string } {
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : String(error);
  const detail = redact(message);
  if (name === "AbortError" || name === "TimeoutError" || /timed? ?out|deadline exceeded|aborted/i.test(message)) {
    return { code: "TIMEOUT", detail };
  }
  if (/default credentials|could not load|application default|unauthenticated|invalid_grant|reauth|permission[_ ]denied|\b40[13]\b/i.test(message)) {
    return { code: "AUTH_FAILED", detail };
  }
  return { code: "MODEL_ERROR", detail };
}

// Real client. The SDK is imported lazily so that code paths that never call Vertex
// (DEMO mode, tests) do not load it.
export function createVertexClient(config: AiConfig): GenerateClient {
  return {
    async generateContent(request) {
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({
        vertexai: true,
        project: config.projectId ?? undefined,
        location: config.location,
        httpOptions: { timeout: request.timeoutMs },
      });
      const response = await ai.models.generateContent({
        model: request.model,
        contents: request.prompt,
        config: {
          systemInstruction: request.systemInstruction,
          responseMimeType: "application/json",
          responseSchema: request.responseSchema as Schema,
          temperature: request.temperature ?? 0.1,
          abortSignal: AbortSignal.timeout(request.timeoutMs),
        },
      });
      return { text: response.text };
    },
  };
}

export async function callVertex(
  config: AiConfig,
  request: { systemInstruction: string; prompt: string; responseSchema: unknown },
  client: GenerateClient = createVertexClient(config),
): Promise<VertexResult> {
  if (config.configError) return { ok: false, code: "CONFIG_ERROR", detail: config.configError };
  if (config.mode !== "VERTEX") return { ok: false, code: "CONFIG_ERROR", detail: "Vertex AI is not the selected mode." };
  try {
    const response = await client.generateContent({
      model: config.model,
      systemInstruction: request.systemInstruction,
      prompt: request.prompt,
      responseSchema: request.responseSchema,
      timeoutMs: config.timeoutMs,
    });
    if (!response.text || response.text.trim() === "") {
      return { ok: false, code: "EMPTY_RESPONSE", detail: "Vertex AI returned no text." };
    }
    return { ok: true, text: response.text };
  } catch (error) {
    return { ok: false, ...classifyError(error) };
  }
}
