// Side-by-side comparison of 2–3 restaurants. Deliberately produces no overall
// ranking: the platform does not support declaring one establishment "safer".
// Instead it lists observable differences that are backed by the records.

import { CATEGORY_KEYS, CATEGORY_LABELS } from "@/lib/domain";

export interface CompareSubject {
  slug: string;
  name: string;
  evidenceScore: number;
  evidenceLabel: string;
  latestInspectionDate: string | null;
  latestInspectionAgeDays: number | null;
  latestOutcome: string | null;
  officialFindingsLatest: number;
  unresolvedCritical: number;
  unresolvedMajor: number;
  unresolvedMinor: number;
  coveredCategories: string[];
  missingCategories: string[];
  documentTitles: string[];
  missingInformation: string[];
}

export interface CompareRow {
  key: string;
  label: string;
  values: Record<string, string>;
}

export interface ComparisonResult {
  subjects: CompareSubject[];
  rows: CompareRow[];
  observations: string[];
  disclaimer: string;
}

export const MIN_COMPARE = 2;
export const MAX_COMPARE = 3;

export function buildComparison(subjects: CompareSubject[]): ComparisonResult {
  const rows: CompareRow[] = [];
  const valueFor = (fn: (s: CompareSubject) => string) =>
    Object.fromEntries(subjects.map((s) => [s.slug, fn(s)]));

  rows.push({ key: "evidence", label: "Evidence confidence (0–100)", values: valueFor((s) => String(s.evidenceScore)) });
  rows.push({ key: "evidenceLabel", label: "Evidence label", values: valueFor((s) => s.evidenceLabel) });
  rows.push({
    key: "latestInspection",
    label: "Latest official inspection",
    values: valueFor((s) => (s.latestInspectionDate ? `${s.latestInspectionDate} (${s.latestInspectionAgeDays} days ago)` : "None on record")),
  });
  rows.push({ key: "outcome", label: "Latest official outcome", values: valueFor((s) => s.latestOutcome ?? "Not available") });
  rows.push({
    key: "unresolved",
    label: "Unresolved official violations",
    values: valueFor((s) => `${s.unresolvedCritical} critical · ${s.unresolvedMajor} major · ${s.unresolvedMinor} minor`),
  });
  rows.push({
    key: "coverage",
    label: "Hygiene categories with evidence",
    values: valueFor((s) => `${s.coveredCategories.length} of ${CATEGORY_KEYS.length}`),
  });
  rows.push({
    key: "missing",
    label: "Categories with no evidence",
    values: valueFor((s) => (s.missingCategories.length ? s.missingCategories.map((k) => CATEGORY_LABELS[k] ?? k).join(", ") : "None")),
  });
  rows.push({
    key: "documents",
    label: "Documents available",
    values: valueFor((s) => (s.documentTitles.length ? s.documentTitles.join("; ") : "No documents on file")),
  });
  rows.push({
    key: "missingInfo",
    label: "Missing information",
    values: valueFor((s) => (s.missingInformation.length ? s.missingInformation.join("; ") : "Nothing flagged as missing")),
  });

  const observations: string[] = [];
  const withInspection = subjects.filter((s) => s.latestInspectionDate);
  const withoutInspection = subjects.filter((s) => !s.latestInspectionDate);
  for (const s of withoutInspection) {
    observations.push(`${s.name} has no official inspection on record. Its status is unknown, not unsafe.`);
  }
  for (const s of subjects.filter((x) => x.unresolvedCritical > 0)) {
    observations.push(`${s.name} has ${s.unresolvedCritical} unresolved critical official violation(s).`);
  }
  const coverageCounts = subjects.map((s) => s.coveredCategories.length);
  if (new Set(coverageCounts).size > 1) {
    const most = subjects.reduce((a, b) => (b.coveredCategories.length > a.coveredCategories.length ? b : a));
    const least = subjects.reduce((a, b) => (b.coveredCategories.length < a.coveredCategories.length ? b : a));
    observations.push(
      `${most.name} has evidence for ${most.coveredCategories.length} of 6 hygiene categories; ${least.name} has evidence for ${least.coveredCategories.length}.`,
    );
  }
  if (withInspection.length >= 2) {
    const dates = withInspection.map((s) => s.latestInspectionDate as string).sort();
    if (dates[0] !== dates[dates.length - 1]) {
      observations.push(
        `Latest official inspections fall on different dates (${dates[0]} to ${dates[dates.length - 1]}), so older records may not reflect current conditions.`,
      );
    }
  }
  if (observations.length === 0) {
    observations.push("No material differences in the recorded evidence were found between these restaurants.");
  }

  return {
    subjects,
    rows,
    observations,
    disclaimer:
      "This comparison lists recorded evidence side by side. It does not rank restaurants or declare any of them safer, and missing evidence is treated as unknown.",
  };
}

export function parseCompareSlugs(raw: string | null | undefined): { ok: true; slugs: string[] } | { ok: false; reason: string } {
  if (!raw) return { ok: false, reason: "Choose between 2 and 3 restaurants to compare." };
  const slugs = Array.from(new Set(raw.split(",").map((s) => s.trim()).filter(Boolean)));
  if (slugs.length < MIN_COMPARE || slugs.length > MAX_COMPARE) {
    return { ok: false, reason: "Choose between 2 and 3 distinct restaurants to compare." };
  }
  if (slugs.some((s) => !/^[a-z0-9-]{1,80}$/.test(s))) {
    return { ok: false, reason: "Restaurant identifiers contain invalid characters." };
  }
  return { ok: true, slugs };
}
