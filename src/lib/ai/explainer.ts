// AI safety explainer: grounded answers with source references.
//
// Every restaurant-specific sentence is built from an evidence bundle, and each
// fact carries the ID of the source it came from ([S3] etc.). The deterministic
// DEMO EXPLAINER produces these answers without any network call. When Gemini is
// configured, its output must cite only bundle IDs or it is discarded in favour
// of the deterministic answer (see gemini-explainer.ts).

import type { RestaurantProfile } from "@/lib/data/types";
import { CATEGORY_LABELS } from "@/lib/domain";
import { COMPONENT_WEIGHTS } from "@/lib/scoring/transparency";

export type SourceKind = "SCORE" | "INSPECTION" | "FINDING" | "DOCUMENT" | "MISSING" | "METHOD";

export interface EvidenceSourceRef {
  id: string;
  // The database record this source describes (null for platform-level sources).
  refId: string | null;
  kind: SourceKind;
  label: string;
  tier: string;
  detail: string;
  href: string | null;
}

export type ExplainerIntent = "SCORE" | "LATEST" | "UNRESOLVED" | "MISSING" | "COMPARE" | "GUIDANCE" | "GENERAL";

export interface DeterministicAnswer {
  intent: ExplainerIntent;
  answer: string;
  citedSourceIds: string[];
  insufficientEvidence: boolean;
}

export const SAMPLE_QUESTIONS = [
  "Why is this restaurant's evidence confidence lower?",
  "What does its latest inspection report actually say?",
  "Are there unresolved violations?",
  "What information is missing?",
  "How does this restaurant compare with another?",
  "What should I look for when evaluating food safety?",
] as const;

const METHOD_SOURCE: EvidenceSourceRef = {
  id: "S-METHOD",
  refId: null,
  kind: "METHOD",
  label: "SafeBite methodology",
  tier: "PLATFORM",
  detail:
    "Evidence confidence combines category coverage (35%), freshness (25%), source quality (25%) and consistency (15%). It is not a safety rating.",
  href: "/methodology",
};

export function buildEvidenceBundle(profile: RestaurantProfile): EvidenceSourceRef[] {
  const sources: EvidenceSourceRef[] = [];
  const t = profile.transparency;
  let n = 0;
  const next = (prefix: string) => `${prefix}${++n}`;

  sources.push({
    id: next("S"),
    refId: profile.id,
    kind: "SCORE",
    label: `Evidence confidence for ${profile.name}`,
    tier: "PLATFORM",
    detail: `Evidence confidence ${t.score}/100 (${t.label}). ${t.components
      .map((c) => `${c.label} ${c.value}/100 at weight ${Math.round(COMPONENT_WEIGHTS[c.key] * 100)}%`)
      .join("; ")}.`,
    href: `/restaurants/${profile.slug}`,
  });

  for (const inspection of profile.inspections) {
    const findingsSummary = inspection.findings.length
      ? `${inspection.findings.length} finding(s): ${inspection.findings
          .map((f) => `${f.severity.toLowerCase()} ${CATEGORY_LABELS[f.categoryKey] ?? f.categoryKey} (${f.status.toLowerCase()})`)
          .join(", ")}`
      : "no findings recorded";
    sources.push({
      id: next("S"),
      refId: inspection.id,
      kind: "INSPECTION",
      label: `${inspection.inspectedAt} inspection — ${inspection.authorityName}`,
      tier: inspection.tier,
      detail: `Outcome ${inspection.outcome.replace(/_/g, " ").toLowerCase()}. ${inspection.summary} ${findingsSummary}. Source: ${inspection.sourceLabel}${inspection.isSimulated ? " (simulated demo record)" : ""}.`,
      href: `/restaurants/${profile.slug}#inspections`,
    });
  }

  for (const finding of profile.inspections.flatMap((i) => i.findings)) {
    sources.push({
      id: next("S"),
      refId: finding.id,
      kind: "FINDING",
      label: `${finding.severity} finding — ${finding.categoryLabel} (${finding.inspectedAt})`,
      tier: finding.tier,
      detail: `${finding.description}. Status: ${finding.status.toLowerCase()}.${finding.remediation ? ` Remediation recorded: ${finding.remediation}` : " No remediation recorded."}`,
      href: `/restaurants/${profile.slug}#findings`,
    });
  }

  for (const doc of profile.documents) {
    sources.push({
      id: next("S"),
      refId: doc.id,
      kind: "DOCUMENT",
      label: doc.title,
      tier: doc.tier,
      detail: `${doc.kind.replace(/_/g, " ").toLowerCase()} from ${doc.sourceLabel}, processing status ${doc.processingStatus.toLowerCase()}.${doc.isSample ? " Simulated sample document." : ""}`,
      href: doc.href,
    });
  }

  if (profile.missingInformation.length > 0) {
    sources.push({
      id: next("S"),
      refId: null,
      kind: "MISSING",
      label: "Information not on record",
      tier: "PLATFORM",
      detail: profile.missingInformation.join(" "),
      href: `/restaurants/${profile.slug}#coverage`,
    });
  }

  sources.push(METHOD_SOURCE);
  return sources;
}

function cite(sources: EvidenceSourceRef[], kind: SourceKind, index = 0): string | null {
  const matches = sources.filter((s) => s.kind === kind);
  return matches[index]?.id ?? null;
}

function tag(id: string | null): string {
  return id ? ` [${id}]` : "";
}

export function answerDeterministically(
  question: string,
  profile: RestaurantProfile,
  sources: EvidenceSourceRef[],
  compareProfile?: RestaurantProfile,
): DeterministicAnswer {
  const q = question.toLowerCase();
  const t = profile.transparency;
  const scoreId = cite(sources, "SCORE");

  if (compareProfile && /compar|versus|\bvs\b|differ|better|worse|than/.test(q)) {
    const other = compareProfile.transparency;
    const openA = profile.openOfficialFindings.length;
    const openB = compareProfile.openOfficialFindings.length;
    const answer = [
      `${profile.name} has evidence confidence ${t.score}/100 (${t.label.toLowerCase()}) with ${openA} open official finding(s); ${compareProfile.name} has ${other.score}/100 with ${openB} open official finding(s).${tag(scoreId)}`,
      `Both values describe available evidence, not safety. Evidence confidence is not a ranking, so use the side-by-side view for the full picture.`,
      `Categories with no evidence: ${profile.name} — ${t.missingCategories.length ? t.missingCategories.map((c) => CATEGORY_LABELS[c] ?? c).join(", ") : "none"}; ${compareProfile.name} — ${other.missingCategories.length ? other.missingCategories.map((c) => CATEGORY_LABELS[c] ?? c).join(", ") : "none"}.`,
    ].join(" ");
    return { intent: "COMPARE", answer, citedSourceIds: scoreId ? [scoreId] : [], insufficientEvidence: false };
  }
  if (/compar|versus|\bvs\b/.test(q)) {
    return {
      intent: "COMPARE",
      answer:
        "Choose a second restaurant in the comparison picker, then ask again. The comparison lists recorded evidence side by side and does not rank establishments.",
      citedSourceIds: [],
      insufficientEvidence: false,
    };
  }

  if (/lower|why|score|confidence|transparen|rating/.test(q)) {
    const parts = t.components.map((c) => `${c.label.toLowerCase()} is ${c.value}/100 — ${c.explanation}`);
    const answer = `Evidence confidence is ${t.score}/100 (${t.label.toLowerCase()}). ${parts.join(" ")}${tag(scoreId)} This number measures available evidence. It does not mean the kitchen is unsafe, and missing evidence is treated as unknown.`;
    return { intent: "SCORE", answer, citedSourceIds: scoreId ? [scoreId] : [], insufficientEvidence: t.latestOfficialInspectionMs === null };
  }

  if (/latest|recent|last inspection|report (says|shows)|what does|inspection report|actually say/.test(q)) {
    const inspectionId = cite(sources, "INSPECTION", 0);
    const latest = profile.latestInspection;
    if (!latest) {
      return {
        intent: "LATEST",
        answer: "There is no official inspection on record for this restaurant, so no inspection report can be summarised. Uploaded or self-reported documents are listed separately and are not treated as official findings.",
        citedSourceIds: [],
        insufficientEvidence: true,
      };
    }
    const findings = latest.findings.length
      ? latest.findings.map((f) => `${f.severity.toLowerCase()} — ${f.categoryLabel}: ${f.description} (${f.status.toLowerCase()})`).join("; ")
      : "No findings were recorded";
    const answer = `The latest record is dated ${latest.inspectedAt}, from ${latest.authorityName}, with outcome ${latest.outcome.replace(/_/g, " ").toLowerCase()}.${tag(inspectionId)} ${latest.summary} Findings: ${findings}.${latest.isSimulated ? " This is a simulated demo record, not a genuine authority record." : ""}`;
    return { intent: "LATEST", answer, citedSourceIds: inspectionId ? [inspectionId] : [], insufficientEvidence: false };
  }

  if (/unresolved|open|outstanding|still|violation|critical/.test(q)) {
    const open = profile.openOfficialFindings;
    if (open.length === 0) {
      return {
        intent: "UNRESOLVED",
        answer: "No unresolved official findings are recorded for this restaurant. Resolved findings remain visible in the inspection history.",
        citedSourceIds: [],
        insufficientEvidence: t.latestOfficialInspectionMs === null,
      };
    }
    const citedFor = (findingId: string) => sources.find((s) => s.kind === "FINDING" && s.refId === findingId)?.id ?? null;
    const lines = open.map((f) => `${f.severity} — ${f.categoryLabel}: ${f.description} (recorded ${f.inspectedAt}).${tag(citedFor(f.id))}`);
    const cited = open.map((f) => citedFor(f.id)).filter((id): id is string => id !== null);
    const answer = `Yes. ${open.length} unresolved official finding(s) are recorded. ${lines.join(" ")}${open.some((f) => f.severity === "CRITICAL") ? " Unresolved critical findings are shown prominently on the profile and are never averaged into the evidence score." : ""}`;
    return { intent: "UNRESOLVED", answer, citedSourceIds: cited, insufficientEvidence: false };
  }

  if (/missing|unknown|gap|lack|no evidence|don'?t know|what information/.test(q)) {
    const missingId = cite(sources, "MISSING");
    const categories = t.missingCategories.map((c) => CATEGORY_LABELS[c] ?? c);
    const docs = profile.documents.length === 0 ? "No supporting documents are on file." : null;
    const parts = [
      categories.length ? `No evidence is on record for: ${categories.join(", ")}.` : "Every hygiene category has at least one evidence item within the coverage window.",
      docs ?? `${profile.documents.length} supporting document(s) are on file.`,
      t.latestOfficialInspectionMs === null ? "No official inspection is on record." : "",
    ].filter(Boolean);
    return {
      intent: "MISSING",
      answer: `${parts.join(" ")}${tag(missingId)} Missing information is treated as unknown, not as unsafe.`,
      citedSourceIds: missingId ? [missingId] : [],
      insufficientEvidence: categories.length > 0,
    };
  }

  if (/look for|should i|what to|how do i|evaluat|tips|red flag|check/.test(q)) {
    return {
      intent: "GUIDANCE",
      answer:
        "When evaluating food safety, look for: a recent official inspection and its outcome; whether earlier findings were resolved and re-inspected; evidence across storage, temperature control, cleaning, pest management, staff hygiene and cross-contamination; and documents you can open and check. Treat a missing record as an open question, not proof of a problem.",
      citedSourceIds: [METHOD_SOURCE.id],
      insufficientEvidence: false,
    };
  }

  return {
    intent: "GENERAL",
    answer: `I can explain the evidence confidence score, the latest inspection record, unresolved official findings, missing information, or a comparison with another restaurant. Try one of the sample questions below. Current evidence confidence: ${t.score}/100.${tag(scoreId)}`,
    citedSourceIds: scoreId ? [scoreId] : [],
    insufficientEvidence: false,
  };
}
