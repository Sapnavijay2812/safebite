// Transparency model: a deterministic evidence-confidence calculation.
//
// IMPORTANT: this is NOT a safety score. It measures how much verifiable
// evidence is available. Missing evidence lowers confidence; it is never
// treated as proof of an unsafe establishment. Unresolved official violations
// are reported separately and are never averaged into the confidence number.
// See docs/METHODOLOGY.md for the full specification.

import type { EvidenceTier, Severity } from "@/lib/domain";
import { CATEGORY_KEYS, CATEGORY_LABELS } from "@/lib/domain";

export const DAY_MS_LOCAL = 86_400_000;
export const COVERAGE_WINDOW_DAYS = 540;
export const CONTRADICTION_PENALTY = 25;

export const COMPONENT_WEIGHTS = {
  coverage: 0.35,
  freshness: 0.25,
  sourceQuality: 0.25,
  consistency: 0.15,
} as const;

// Weight of each evidence tier when judging source quality (0..1).
// Unverified allegations and AI-inferred signals carry no weight.
export const TIER_WEIGHTS: Record<EvidenceTier, number> = {
  OFFICIAL_VERIFIED: 1,
  INDEPENDENT_CHECK: 0.8,
  SELF_REPORTED: 0.4,
  UNVERIFIED_ALLEGATION: 0,
  AI_INFERRED: 0,
};

// Freshness of the latest official inspection, by age in days.
export const FRESHNESS_BANDS: ReadonlyArray<{ maxDays: number; score: number; label: string }> = [
  { maxDays: 180, score: 100, label: "within 6 months" },
  { maxDays: 365, score: 75, label: "6–12 months ago" },
  { maxDays: 540, score: 50, label: "12–18 months ago" },
  { maxDays: 730, score: 25, label: "18–24 months ago" },
];

export type EvidenceLabel = "Strong evidence coverage" | "Good evidence coverage" | "Partial evidence coverage" | "Limited evidence coverage";

export interface EvidenceItemInput {
  id: string;
  kind: "INSPECTION" | "DOCUMENT";
  tier: EvidenceTier;
  categoryKeys: string[];
  dateMs: number;
}

export interface FindingInput {
  id: string;
  tier: EvidenceTier;
  categoryKey: string;
  severity: Severity;
  status: "UNRESOLVED" | "RESOLVED";
}

export interface ComplianceClaimInput {
  id: string;
  tier: EvidenceTier;
  categoryKey: string;
}

export interface TransparencyInput {
  asOfMs: number;
  categoryKeys?: readonly string[];
  items: EvidenceItemInput[];
  findings: FindingInput[];
  complianceClaims: ComplianceClaimInput[];
}

export interface ComponentResult {
  key: "coverage" | "freshness" | "sourceQuality" | "consistency";
  label: string;
  value: number;
  weight: number;
  contribution: number;
  explanation: string;
}

export interface CategoryCoverage {
  key: string;
  label: string;
  covered: boolean;
  sourceCount: number;
  latestDateMs: number | null;
}

export interface UnresolvedOfficialCounts {
  critical: number;
  major: number;
  minor: number;
  observation: number;
}

export interface TransparencyResult {
  score: number;
  label: EvidenceLabel;
  components: ComponentResult[];
  categories: CategoryCoverage[];
  missingCategories: string[];
  latestOfficialInspectionMs: number | null;
  latestOfficialAgeDays: number | null;
  unresolvedOfficial: UnresolvedOfficialCounts;
  contradictionCategories: string[];
  disclaimer: string;
}

export const TRANSPARENCY_DISCLAIMER =
  "Evidence confidence describes how much verifiable information is available. It is not a safety rating, and missing evidence is treated as unknown, not as unsafe.";

export function labelForScore(score: number): EvidenceLabel {
  if (score >= 80) return "Strong evidence coverage";
  if (score >= 60) return "Good evidence coverage";
  if (score >= 40) return "Partial evidence coverage";
  return "Limited evidence coverage";
}

export function freshnessForAge(ageDays: number | null): { score: number; band: string } {
  if (ageDays === null) return { score: 0, band: "no official inspection on record" };
  const days = Math.max(0, ageDays);
  for (const band of FRESHNESS_BANDS) {
    if (days <= band.maxDays) return { score: band.score, band: band.label };
  }
  return { score: 0, band: "older than 24 months" };
}

function round(n: number): number {
  return Math.round(n);
}

export function computeTransparency(input: TransparencyInput): TransparencyResult {
  const categoryKeys = input.categoryKeys ?? CATEGORY_KEYS;
  const asOf = input.asOfMs;

  // Only items with a non-zero tier weight can count toward coverage.
  const scorable = input.items.filter((item) => TIER_WEIGHTS[item.tier] > 0 && item.dateMs <= asOf);
  const windowStart = asOf - COVERAGE_WINDOW_DAYS * DAY_MS_LOCAL;
  const inWindow = scorable.filter((item) => item.dateMs >= windowStart);

  // --- Coverage -------------------------------------------------------------
  const categories: CategoryCoverage[] = categoryKeys.map((key) => {
    const matching = inWindow.filter((item) => item.categoryKeys.includes(key));
    const latest = matching.reduce<number | null>(
      (acc, item) => (acc === null || item.dateMs > acc ? item.dateMs : acc),
      null,
    );
    return {
      key,
      label: CATEGORY_LABELS[key] ?? key,
      covered: matching.length > 0,
      sourceCount: matching.length,
      latestDateMs: latest,
    };
  });
  const coveredCount = categories.filter((c) => c.covered).length;
  const coverageValue = categoryKeys.length === 0 ? 0 : round((coveredCount / categoryKeys.length) * 100);
  const missingCategories = categories.filter((c) => !c.covered).map((c) => c.key);

  // --- Freshness ------------------------------------------------------------
  const officialInspections = input.items.filter(
    (item) => item.kind === "INSPECTION" && item.tier === "OFFICIAL_VERIFIED" && item.dateMs <= asOf,
  );
  const latestOfficial = officialInspections.reduce<number | null>(
    (acc, item) => (acc === null || item.dateMs > acc ? item.dateMs : acc),
    null,
  );
  const latestAgeDays = latestOfficial === null ? null : Math.floor((asOf - latestOfficial) / DAY_MS_LOCAL);
  const fresh = freshnessForAge(latestAgeDays);

  // --- Source quality -------------------------------------------------------
  const sourceQualityValue =
    scorable.length === 0
      ? 0
      : round((scorable.reduce((sum, item) => sum + TIER_WEIGHTS[item.tier], 0) / scorable.length) * 100);

  // --- Consistency ----------------------------------------------------------
  const unresolvedOfficialFindings = input.findings.filter(
    (f) => f.tier === "OFFICIAL_VERIFIED" && f.status === "UNRESOLVED",
  );
  const contradictionCategories = Array.from(
    new Set(
      input.complianceClaims
        .filter((claim) => TIER_WEIGHTS[claim.tier] > 0)
        .filter((claim) => unresolvedOfficialFindings.some((f) => f.categoryKey === claim.categoryKey))
        .map((claim) => claim.categoryKey),
    ),
  ).sort();
  const consistencyValue =
    scorable.length === 0 ? 0 : Math.max(0, 100 - CONTRADICTION_PENALTY * contradictionCategories.length);

  // --- Composite --------------------------------------------------------------
  const components: ComponentResult[] = [
    {
      key: "coverage",
      label: "Hygiene category coverage",
      value: coverageValue,
      weight: COMPONENT_WEIGHTS.coverage,
      contribution: 0,
      explanation: `${coveredCount} of ${categoryKeys.length} hygiene categories have usable evidence within the last ${COVERAGE_WINDOW_DAYS} days.`,
    },
    {
      key: "freshness",
      label: "Evidence freshness",
      value: fresh.score,
      weight: COMPONENT_WEIGHTS.freshness,
      contribution: 0,
      explanation:
        latestAgeDays === null
          ? "No official inspection is on record, so freshness is 0 (unknown, not unsafe)."
          : `Latest official inspection is ${latestAgeDays} days old (${fresh.band}).`,
    },
    {
      key: "sourceQuality",
      label: "Source quality",
      value: sourceQualityValue,
      weight: COMPONENT_WEIGHTS.sourceQuality,
      contribution: 0,
      explanation:
        scorable.length === 0
          ? "No verifiable evidence items are available."
          : `Average source-tier weight across ${scorable.length} evidence item(s): official 1.0, independent 0.8, self-reported 0.4.`,
    },
    {
      key: "consistency",
      label: "Consistency across sources",
      value: consistencyValue,
      weight: COMPONENT_WEIGHTS.consistency,
      contribution: 0,
      explanation:
        contradictionCategories.length === 0
          ? "No self-reported compliance claim conflicts with an unresolved official finding."
          : `${contradictionCategories.length} category(ies) have a compliance claim that conflicts with an unresolved official finding (−${CONTRADICTION_PENALTY} each).`,
    },
  ];

  for (const component of components) {
    component.contribution = component.value * component.weight;
  }
  const score = round(components.reduce((sum, c) => sum + c.contribution, 0));

  const unresolvedOfficial: UnresolvedOfficialCounts = { critical: 0, major: 0, minor: 0, observation: 0 };
  for (const finding of unresolvedOfficialFindings) {
    if (finding.severity === "CRITICAL") unresolvedOfficial.critical += 1;
    else if (finding.severity === "MAJOR") unresolvedOfficial.major += 1;
    else if (finding.severity === "MINOR") unresolvedOfficial.minor += 1;
    else unresolvedOfficial.observation += 1;
  }

  return {
    score,
    // A numeric score can be lifted by quality and consistency alone. If no category has
    // in-window evidence, the label stays "Limited" so old records are not presented as coverage.
    label: coverageValue === 0 ? "Limited evidence coverage" : labelForScore(score),
    components,
    categories,
    missingCategories,
    latestOfficialInspectionMs: latestOfficial,
    latestOfficialAgeDays: latestAgeDays,
    unresolvedOfficial,
    contradictionCategories,
    disclaimer: TRANSPARENCY_DISCLAIMER,
  };
}
