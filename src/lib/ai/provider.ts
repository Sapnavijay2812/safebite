// AI configuration. Read on the server only; nothing here is sent to the browser.
//
// Modes:
//   DEMO   – default. No network calls. Answers come from the deterministic template.
//   VERTEX – Gemini on Vertex AI through the official @google/genai SDK. Authentication
//            uses Google Cloud Application Default Credentials (ADC), not a pasted token.
//
// There is no silent fallback. If VERTEX is selected but misconfigured, `configError`
// is set and the explainer shows that error next to the template answer. The
// response is never labelled as Gemini in that case.

export type AiMode = "DEMO" | "VERTEX";

export interface AiConfig {
  mode: AiMode;
  model: string;
  timeoutMs: number;
  projectId: string | null;
  location: string;
  // Set when the requested mode cannot run (for example, VERTEX_PROJECT_ID is missing).
  configError: string | null;
}

export const DEFAULT_MODEL = "gemini-2.5-flash";
export const DEFAULT_LOCATION = "us-central1";

export function resolveAiConfig(env: NodeJS.ProcessEnv = process.env): AiConfig {
  const raw = (env.SAFEBITE_AI_MODE ?? "DEMO").trim().toUpperCase();
  const model = (env.GEMINI_MODEL ?? "").trim() || DEFAULT_MODEL;
  const timeoutMs = Math.min(Math.max(Number(env.AI_TIMEOUT_MS ?? 15000) || 15000, 1000), 60000);
  const location = (env.VERTEX_LOCATION ?? "").trim() || DEFAULT_LOCATION;
  const projectId = (env.VERTEX_PROJECT_ID ?? "").trim() || null;

  if (raw === "DEMO" || raw === "") {
    return { mode: "DEMO", model, timeoutMs, projectId, location, configError: null };
  }
  if (raw === "GEMINI_API") {
    return {
      mode: "VERTEX",
      model,
      timeoutMs,
      projectId,
      location,
      configError: "SAFEBITE_AI_MODE=GEMINI_API is no longer supported. Use VERTEX with VERTEX_PROJECT_ID, or DEMO.",
    };
  }
  if (raw !== "VERTEX") {
    return { mode: "DEMO", model, timeoutMs, projectId, location, configError: `Unknown SAFEBITE_AI_MODE "${raw}". Use DEMO or VERTEX.` };
  }
  if (!projectId) {
    return { mode: "VERTEX", model, timeoutMs, projectId, location, configError: "VERTEX_PROJECT_ID is not set." };
  }
  return { mode: "VERTEX", model, timeoutMs, projectId, location, configError: null };
}

export function demoLabel(): string {
  return "DEMO EXPLAINER (deterministic template, not Gemini)";
}

export function vertexLabel(config: AiConfig): string {
  return `Gemini ${config.model} on Vertex AI`;
}
