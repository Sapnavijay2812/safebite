// Validation of model output. A model answer is accepted only when it is
// well-formed JSON, matches the schema, and cites nothing outside the evidence
// bundle it was given. Anything else falls back to the deterministic explainer.

import { z } from "zod";

export const modelAnswerSchema = z.object({
  answer: z.string().trim().min(1).max(1500),
  citations: z.array(z.string().min(1).max(40)).max(12),
  insufficientEvidence: z.boolean(),
});

export type ModelAnswer = z.infer<typeof modelAnswerSchema>;

export type ModelAnswerCheck =
  | { ok: true; value: ModelAnswer }
  | { ok: false; reason: "SCHEMA" | "UNKNOWN_CITATION" | "EMPTY_CITATIONS" };

// Sentences that claim official certification or a safety verdict are never
// acceptable from the model, whatever the evidence says.
const FORBIDDEN_CLAIMS = [/\bcertified (as )?safe\b/i, /\bofficially (certified|approved|graded)\b/i, /\bhealth grade [A-C]\b/i, /\b100% safe\b/i];

export function checkModelAnswer(raw: unknown, allowedSourceIds: readonly string[]): ModelAnswerCheck {
  const parsed = modelAnswerSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: "SCHEMA" };
  const value = parsed.data;
  if (value.citations.some((id) => !allowedSourceIds.includes(id))) {
    return { ok: false, reason: "UNKNOWN_CITATION" };
  }
  if (value.citations.length === 0 && !value.insufficientEvidence) {
    // A factual answer must point at evidence; otherwise it is an ungrounded claim.
    return { ok: false, reason: "EMPTY_CITATIONS" };
  }
  if (FORBIDDEN_CLAIMS.some((pattern) => pattern.test(value.answer))) {
    return { ok: false, reason: "SCHEMA" };
  }
  return { ok: true, value };
}

// JSON Schema subset understood by the Gemini responseSchema field.
export const GEMINI_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    answer: { type: "STRING", description: "Plain-language answer. Cite only supplied source IDs." },
    citations: { type: "ARRAY", items: { type: "STRING" }, description: "Source IDs such as S2 that support the answer." },
    insufficientEvidence: { type: "BOOLEAN", description: "True when the sources cannot answer the question." },
  },
  required: ["answer", "citations", "insufficientEvidence"],
} as const;
