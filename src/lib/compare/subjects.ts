// Builds comparison subjects from full restaurant profiles.

import type { RestaurantProfile } from "@/lib/data/types";
import type { CompareSubject } from "./compare";

export function toCompareSubject(profile: RestaurantProfile, asOfMs: number): CompareSubject {
  const t = profile.transparency;
  const latest = profile.latestInspection;
  const latestFindings = latest?.findings ?? [];
  const missingInformation = [...profile.missingInformation];
  return {
    slug: profile.slug,
    name: profile.name,
    evidenceScore: t.score,
    evidenceLabel: t.label,
    latestInspectionDate: latest ? latest.inspectedAt : null,
    latestInspectionAgeDays: latest
      ? Math.floor((asOfMs - new Date(latest.inspectedAt + "T00:00:00Z").getTime()) / 86_400_000)
      : null,
    latestOutcome: latest ? latest.outcome.replace(/_/g, " ").toLowerCase() : null,
    officialFindingsLatest: latestFindings.length,
    unresolvedCritical: t.unresolvedOfficial.critical,
    unresolvedMajor: t.unresolvedOfficial.major,
    unresolvedMinor: t.unresolvedOfficial.minor,
    coveredCategories: t.categories.filter((c) => c.covered).map((c) => c.key),
    missingCategories: t.missingCategories,
    documentTitles: profile.documents.map((d) => d.title),
    missingInformation,
  };
}
