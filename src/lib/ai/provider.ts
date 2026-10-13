// Server-side model provider. Credentials are read from the environment on the
// server only and are never returned to the browser or written to logs.
//
// Modes:
//   DEMO        – default. No network calls; the deterministic explainer is used.
//   GEMINI_API  – Gemini Developer API (needs GEMINI_API_KEY).
//   VERTEX      – Gemini on Vertex AI (needs VERTEX_PROJECT_ID and VERTEX_ACCESS_TOKEN).
// If the requested mode is missing its credentials, the provider reports DEMO and
// the reason. It never silently pretends to be Gemini.

export type AiMode = "DEMO" | "GEMINI_API" | "VERTEX";

export interface AiConfig {
  requestedMode: AiMode;
  effectiveMode: AiMode;
  reason: string;
  model: string;
  timeoutMs: number;
  vertex: { projectId: string; location: string; accessToken: string } | null;
  geminiApiKey: string | null;
}

export function resolveAiConfig(env: NodeJS.ProcessEnv = process.env): AiConfig {
  const raw = (env.SAFEBITE_AI_MODE ?? "DEMO").trim().toUpperCase();
  const requestedMode: AiMode = raw === "GEMINI_API" || raw === "VERTEX" ? raw : "DEMO";
  const model = (env.GEMINI_MODEL ?? "gemini-2.5-flash").trim() || "gemini-2.5-flash";
  const timeoutMs = Math.min(Math.max(Number(env.AI_TIMEOUT_MS ?? 15000) || 15000, 1000), 60000);

  const base = { requestedMode, model, timeoutMs, vertex: null as AiConfig["vertex"], geminiApiKey: null as string | null };

  if (requestedMode === "DEMO") {
    return { ...base, effectiveMode: "DEMO", reason: "Demo explainer selected. No model credentials are used." };
  }
  if (requestedMode === "GEMINI_API") {
    const key = env.GEMINI_API_KEY?.trim();
    if (!key) return { ...base, effectiveMode: "DEMO", reason: "GEMINI_API_KEY is not set, so the demo explainer is used." };
    return { ...base, effectiveMode: "GEMINI_API", reason: "Gemini Developer API configured.", geminiApiKey: key };
  }
  const projectId = env.VERTEX_PROJECT_ID?.trim();
  const accessToken = env.VERTEX_ACCESS_TOKEN?.trim();
  if (!projectId || !accessToken) {
    return { ...base, effectiveMode: "DEMO", reason: "VERTEX_PROJECT_ID or VERTEX_ACCESS_TOKEN is not set, so the demo explainer is used." };
  }
  const location = (env.VERTEX_LOCATION ?? "us-central1").trim() || "us-central1";
  return {
    ...base,
    effectiveMode: "VERTEX",
    reason: "Gemini on Vertex AI configured.",
    vertex: { projectId, location, accessToken },
  };
}

export function modelLabel(config: AiConfig): string {
  if (config.effectiveMode === "VERTEX") return `Gemini ${config.model} on Vertex AI`;
  if (config.effectiveMode === "GEMINI_API") return `Gemini ${config.model} (Gemini API)`;
  return "DEMO EXPLAINER (deterministic template, not Gemini)";
}

export type ModelCallResult = { ok: true; text: string } | { ok: false; code: "TIMEOUT" | "HTTP_ERROR" | "EMPTY_RESPONSE" };

export async function callGemini(config: AiConfig, system: string, user: string, schema: unknown): Promise<ModelCallResult> {
  if (config.effectiveMode === "DEMO") return { ok: false, code: "HTTP_ERROR" };

  const url =
    config.effectiveMode === "VERTEX" && config.vertex
      ? `https://${config.vertex.location}-aiplatform.googleapis.com/v1/projects/${config.vertex.projectId}/locations/${config.vertex.location}/publishers/google/models/${config.model}:generateContent`
      : `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent`;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.effectiveMode === "VERTEX" && config.vertex) headers.Authorization = `Bearer ${config.vertex.accessToken}`;
  if (config.effectiveMode === "GEMINI_API" && config.geminiApiKey) headers["x-goog-api-key"] = config.geminiApiKey;

  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: user }] }],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json",
      responseSchema: schema,
    },
  };

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(config.timeoutMs),
      cache: "no-store",
    });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return { ok: false, code: timedOut ? "TIMEOUT" : "HTTP_ERROR" };
  }
  if (!response.ok) return { ok: false, code: "HTTP_ERROR" };

  const json = (await response.json().catch(() => null)) as
    | { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
    | null;
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return { ok: false, code: "EMPTY_RESPONSE" };
  return { ok: true, text };
}
