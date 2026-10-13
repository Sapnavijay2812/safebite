// Analytics computed from persisted records. Nothing on the dashboard is a
// hardcoded number: every value is derived from the same profiles and tables the
// public pages use.

import { db } from "@/lib/data/db";
import type { RestaurantProfile } from "@/lib/data/types";
import { CATEGORY_LABELS, REPORT_STATUSES } from "@/lib/domain";
import { FRESHNESS_BANDS } from "@/lib/scoring/transparency";

export interface AnalyticsSnapshot {
  generatedAt: string;
  totals: { restaurants: number; inspections: number; findings: number; documents: number; reports: number };
  evidenceCoverage: Array<{ slug: string; name: string; score: number; coveredCategories: number; missingCategories: number }>;
  freshnessDistribution: Array<{ band: string; count: number }>;
  violationFrequency: Array<{ category: string; critical: number; major: number; minor: number; observation: number; unresolved: number }>;
  documentStatus: Array<{ status: string; count: number }>;
  extractionStatus: Array<{ status: string; count: number }>;
  inspectionTrend: Array<{ month: string; inspections: number; findings: number }>;
  moderationQueue: Array<{ status: string; count: number }>;
  reportsRequiringModeration: Array<{ id: string; restaurant: string; category: string; status: string; incidentDate: string }>;
  dataCompleteness: Array<{ key: string; label: string; percent: number }>;
}

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

function lastTwelveMonths(asOfMs: number): string[] {
  const d = new Date(asOfMs);
  const months: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1));
    months.push(m.toISOString().slice(0, 7));
  }
  return months;
}

function freshnessBand(profile: RestaurantProfile): string {
  const age = profile.transparency.latestOfficialAgeDays;
  if (age === null) return "No official inspection";
  for (const band of FRESHNESS_BANDS) {
    if (age <= band.maxDays) return `≤ ${Math.round(band.maxDays / 30)} months`;
  }
  return "> 24 months";
}

export async function buildAnalytics(profiles: RestaurantProfile[], asOfMs: number = Date.now()): Promise<AnalyticsSnapshot> {
  const [docGroups, extractionGroups, reportGroups, reportRows] = await Promise.all([
    db.evidenceDocument.groupBy({ by: ["processingStatus"], _count: { _all: true } }),
    db.documentExtraction.groupBy({ by: ["status"], _count: { _all: true } }),
    db.communityReport.groupBy({ by: ["status"], _count: { _all: true } }),
    db.communityReport.findMany({
      where: { status: { in: ["PENDING", "UNDER_REVIEW"] } },
      orderBy: { createdAt: "asc" },
      include: { restaurant: { select: { name: true } } },
      take: 50,
    }),
  ]);

  const allInspections = profiles.flatMap((p) => p.inspections);
  const allFindings = allInspections.flatMap((i) => i.findings);
  const documentCount = profiles.reduce((sum, p) => sum + p.documents.length, 0);
  const reportCount = profiles.reduce((sum, p) => sum + Object.values(p.communityCounts).reduce((a, b) => a + b, 0), 0);

  const freshnessOrder = [
    ...FRESHNESS_BANDS.map((b) => `≤ ${Math.round(b.maxDays / 30)} months`),
    "> 24 months",
    "No official inspection",
  ];
  const freshnessCounts = new Map<string, number>(freshnessOrder.map((b) => [b, 0]));
  for (const profile of profiles) {
    const band = freshnessBand(profile);
    freshnessCounts.set(band, (freshnessCounts.get(band) ?? 0) + 1);
  }

  const violationFrequency = Object.keys(CATEGORY_LABELS).map((category) => {
    const findings = allFindings.filter((f) => f.categoryKey === category);
    const bySeverity = (s: string) => findings.filter((f) => f.severity === s).length;
    return {
      category: CATEGORY_LABELS[category],
      critical: bySeverity("CRITICAL"),
      major: bySeverity("MAJOR"),
      minor: bySeverity("MINOR"),
      observation: bySeverity("OBSERVATION"),
      unresolved: findings.filter((f) => f.status === "UNRESOLVED").length,
    };
  });

  const months = lastTwelveMonths(asOfMs);
  const inspectionTrend = months.map((month) => {
    const inspections = allInspections.filter((i) => monthKey(i.inspectedAt) === month);
    return {
      month,
      inspections: inspections.length,
      findings: inspections.reduce((sum, i) => sum + i.findings.length, 0),
    };
  });

  const completenessDenominator = Math.max(profiles.length, 1);
  const pct = (count: number) => Math.round((count / completenessDenominator) * 100);
  const dataCompleteness = [
    { key: "location", label: "Location recorded", percent: pct(profiles.filter((p) => p.location.addressLine !== "Address not on record").length) },
    { key: "inspection", label: "Official inspection on record", percent: pct(profiles.filter((p) => p.latestInspection && p.transparency.latestOfficialInspectionMs !== null).length) },
    { key: "documents", label: "At least one document", percent: pct(profiles.filter((p) => p.documents.length > 0).length) },
    { key: "allCategories", label: "All six categories covered", percent: pct(profiles.filter((p) => p.transparency.missingCategories.length === 0).length) },
    { key: "fresh", label: "Official record within 12 months", percent: pct(profiles.filter((p) => (p.transparency.latestOfficialAgeDays ?? Infinity) <= 365).length) },
  ];

  return {
    generatedAt: new Date(asOfMs).toISOString(),
    totals: { restaurants: profiles.length, inspections: allInspections.length, findings: allFindings.length, documents: documentCount, reports: reportCount },
    evidenceCoverage: profiles
      .map((p) => ({
        slug: p.slug,
        name: p.name,
        score: p.transparency.score,
        coveredCategories: p.transparency.categories.filter((c) => c.covered).length,
        missingCategories: p.transparency.missingCategories.length,
      }))
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)),
    freshnessDistribution: freshnessOrder.map((band) => ({ band, count: freshnessCounts.get(band) ?? 0 })),
    violationFrequency,
    documentStatus: docGroups.map((g) => ({ status: g.processingStatus, count: g._count._all })),
    extractionStatus: extractionGroups.map((g) => ({ status: g.status, count: g._count._all })),
    inspectionTrend,
    moderationQueue: REPORT_STATUSES.map((status) => ({
      status,
      count: reportGroups.find((g) => g.status === status)?._count._all ?? 0,
    })),
    reportsRequiringModeration: reportRows.map((r) => ({
      id: r.id,
      restaurant: r.restaurant.name,
      category: r.category,
      status: r.status,
      incidentDate: r.incidentDate.toISOString().slice(0, 10),
    })),
    dataCompleteness,
  };
}
