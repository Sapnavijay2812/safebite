// Validation of model output. A model answer is accepted only when it is
// well-formed JSON, matches the schema, cites only sources it was given, and does not
// state dates or certification-style claims that the cited records do not contain.
// Anything else is rejected and the explainer reports the rejection.

import { z } from "zod";

export const modelAnswerSchema = z.object({
  answer: z.string().trim().min(1).max(1500),
  citations: z.array(z.string().min(1).max(40)).max(12),
  insufficientEvidence: z.boolean(),
});

export type ModelAnswer = z.infer<typeof modelAnswerSchema>;

export interface GroundingSource {
  id: string;
  detail: string;
  label: string;
}

export type ModelAnswerCheck =
  | { ok: true; value: ModelAnswer }
  | { ok: false; reason: "SCHEMA" | "UNKNOWN_CITATION" | "EMPTY_CITATIONS" | "UNSUPPORTED_DATE" | "FORBIDDEN_CLAIM" };

// Claims that a model must never make about a restaurant, whatever the records say.
const FORBIDDEN_CLAIMS = [
  /\bcertified\b/i,
  /\bofficially (approved|graded|endorsed)\b/i,
  /\bhealth grade\b/i,
  /\b\d{1,3}% safe\b/i,
  /\bsafe to eat\b/i,
  /\bis safe\b/i,
  /\bno (food )?safety (risks?|violations?|issues?)\b/i,
  /\bpassed (its |the |an )?(official )?(health )?inspection\b/i,
];

const DATE_PATTERN = /\b\d{4}-\d{2}-\d{2}\b/g;

export function checkModelAnswer(raw: unknown, sources: readonly GroundingSource[]): ModelAnswerCheck {
  const parsed = modelAnswerSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: "SCHEMA" };
  const value = parsed.data;
  const cited = sources.filter((s) => value.citations.includes(s.id));
  if (cited.length !== new Set(value.citations).size) {
    return { ok: false, reason: "UNKNOWN_CITATION" };
  }
  if (value.citations.length === 0 && !value.insufficientEvidence) {
    // A factual answer must point at evidence; otherwise it is an ungrounded claim.
    return { ok: false, reason: "EMPTY_CITATIONS" };
  }
  // Every date in the answer must appear in a source the answer cites.
  const citedText = cited.map((s) => `${s.label} ${s.detail}`).join(" ");
  const dates = value.answer.match(DATE_PATTERN) ?? [];
  if (dates.some((d) => !citedText.includes(d))) {
    return { ok: false, reason: "UNSUPPORTED_DATE" };
  }
  if (FORBIDDEN_CLAIMS.some((pattern) => pattern.test(value.answer))) {
    return { ok: false, reason: "FORBIDDEN_CLAIM" };
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
