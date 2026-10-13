// Repository: loads restaurants from SQLite and maps them to view models. All
// transparency values are computed here from stored records, never stored as
// authoritative numbers, so they always reflect the current evidence.

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/data/db";
import type {
  CommunityReportView,
  DocumentView,
  FindingView,
  InspectionView,
  RestaurantProfile,
} from "@/lib/data/types";
import { CATEGORY_LABELS, DAY_MS, REPORT_STATUSES, SEVERITIES, type EvidenceTier, type ReportStatus } from "@/lib/domain";
import type { DiscoveryRecord } from "@/lib/discovery/discovery";
import { computeTransparency, type EvidenceItemInput, type FindingInput, type ComplianceClaimInput } from "@/lib/scoring/transparency";

const restaurantInclude = {
  location: true,
  inspections: {
    orderBy: { inspectedAt: "desc" },
    include: {
      source: true,
      categories: true,
      findings: { include: { category: true }, orderBy: { createdAt: "asc" } },
    },
  },
  documents: {
    orderBy: { uploadedAt: "desc" },
    include: { source: true, claims: true },
  },
  communityReports: {
    orderBy: { createdAt: "desc" },
    select: { id: true, category: true, status: true, incidentDate: true, description: true },
  },
} satisfies Prisma.RestaurantInclude;

type RestaurantRow = Prisma.RestaurantGetPayload<{ include: typeof restaurantInclude }>;

const SEVERITY_ORDER: Record<string, number> = Object.fromEntries(SEVERITIES.map((s, i) => [s, i]));

export function isoDate(ms: number | Date): string {
  const d = ms instanceof Date ? ms : new Date(ms);
  return d.toISOString().slice(0, 10);
}

function mapRestaurant(row: RestaurantRow, asOfMs: number): RestaurantProfile {
  const inspections: InspectionView[] = row.inspections.map((insp) => {
    const tier = insp.source.tier as EvidenceTier;
    const findings: FindingView[] = insp.findings.map((f) => ({
      id: f.id,
      inspectionId: insp.id,
      inspectedAt: isoDate(insp.inspectedAt),
      categoryKey: f.categoryKey,
      categoryLabel: f.category.label,
      severity: f.severity as FindingView["severity"],
      description: f.description,
      status: f.status as FindingView["status"],
      remediation: f.remediation,
      resolvedAt: f.resolvedAt ? isoDate(f.resolvedAt) : null,
      tier,
      sourceLabel: insp.source.label,
    }));
    return {
      id: insp.id,
      inspectedAt: isoDate(insp.inspectedAt),
      authorityName: insp.authorityName,
      sourceKey: insp.sourceKey,
      sourceLabel: insp.source.label,
      tier,
      outcome: insp.outcome,
      summary: insp.summary,
      isSimulated: insp.isSimulated,
      categories: insp.categories.map((c) => c.categoryKey),
      findings,
    };
  });

  const documents: DocumentView[] = row.documents.map((doc) => ({
    id: doc.id,
    title: doc.title,
    kind: doc.kind,
    sourceKey: doc.sourceKey,
    sourceLabel: doc.source.label,
    tier: doc.source.tier as EvidenceTier,
    issuedAt: doc.issuedAt ? isoDate(doc.issuedAt) : null,
    uploadedAt: isoDate(doc.uploadedAt),
    isSample: doc.isSample,
    processingStatus: doc.processingStatus,
    originalFilename: doc.originalFilename,
    sizeBytes: doc.sizeBytes,
    href: `/api/documents/${doc.id}/file`,
    claims: doc.claims.map((c) => ({ categoryKey: c.categoryKey, claimsCompliant: c.claimsCompliant })),
  }));

  // ---- Transparency inputs ------------------------------------------------
  const items: EvidenceItemInput[] = [];
  const findings: FindingInput[] = [];
  for (const insp of row.inspections) {
    const tier = insp.source.tier as EvidenceTier;
    items.push({
      id: insp.id,
      kind: "INSPECTION",
      tier,
      categoryKeys: insp.categories.map((c) => c.categoryKey),
      dateMs: insp.inspectedAt.getTime(),
    });
    for (const f of insp.findings) {
      findings.push({
        id: f.id,
        tier,
        categoryKey: f.categoryKey,
        severity: f.severity as FindingInput["severity"],
        status: f.status as FindingInput["status"],
      });
    }
  }
  const complianceClaims: ComplianceClaimInput[] = [];
  for (const doc of row.documents) {
    if (doc.processingStatus !== "PUBLISHED" || doc.kind === "INSPECTION_REPORT") continue;
    const tier = doc.source.tier as EvidenceTier;
    const dateMs = (doc.issuedAt ?? doc.uploadedAt).getTime();
    items.push({ id: doc.id, kind: "DOCUMENT", tier, categoryKeys: doc.claims.map((c) => c.categoryKey), dateMs });
    for (const claim of doc.claims.filter((c) => c.claimsCompliant)) {
      complianceClaims.push({ id: `${doc.id}:${claim.categoryKey}`, tier, categoryKey: claim.categoryKey });
    }
  }

  const transparency = computeTransparency({ asOfMs, items, findings, complianceClaims });

  const communityCounts = Object.fromEntries(REPORT_STATUSES.map((s) => [s, 0])) as Record<ReportStatus, number>;
  for (const report of row.communityReports) {
    communityCounts[report.status as ReportStatus] += 1;
  }
  const communityReports: CommunityReportView[] = row.communityReports
    .filter((r) => r.status === "CORROBORATED")
    .map((r) => ({
      id: r.id,
      category: r.category,
      status: r.status as ReportStatus,
      incidentDate: isoDate(r.incidentDate),
      description: r.description,
    }));

  const latestInspection = inspections[0] ?? null;
  const openOfficialFindings = inspections
    .filter((i) => i.tier === "OFFICIAL_VERIFIED")
    .flatMap((i) => i.findings)
    .filter((f) => f.status === "UNRESOLVED")
    .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9));

  const missingInformation: string[] = [];
  if (transparency.missingCategories.length) {
    missingInformation.push(
      `No evidence is on record for ${transparency.missingCategories.map((c) => CATEGORY_LABELS[c] ?? c).join(", ")}.`,
    );
  }
  if (transparency.latestOfficialInspectionMs === null) {
    missingInformation.push("No official inspection is on record.");
  } else if ((transparency.latestOfficialAgeDays ?? 0) > 365) {
    missingInformation.push(`The latest official inspection is ${transparency.latestOfficialAgeDays} days old.`);
  }
  if (documents.length === 0) missingInformation.push("No supporting documents are on file.");
  if (!row.location) missingInformation.push("Location details are missing.");

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    cuisine: row.cuisine,
    priceTier: row.priceTier,
    description: row.description,
    accentColor: row.accentColor,
    isFictional: row.isFictional,
    location: {
      addressLine: row.location?.addressLine ?? "Address not on record",
      neighborhood: row.location?.neighborhood ?? "Unknown",
      city: row.location?.city ?? "Harbor Bay",
      latitude: row.location?.latitude ?? 0,
      longitude: row.location?.longitude ?? 0,
    },
    inspections,
    latestInspection,
    openOfficialFindings,
    documents,
    communityReports,
    communityCounts,
    transparency,
    missingInformation,
  };
}

export async function loadRestaurantProfiles(asOfMs: number = Date.now()): Promise<RestaurantProfile[]> {
  const rows = await db.restaurant.findMany({ include: restaurantInclude, orderBy: { name: "asc" } });
  return rows.map((row) => mapRestaurant(row, asOfMs));
}

export async function loadRestaurantProfile(slug: string, asOfMs: number = Date.now()): Promise<RestaurantProfile | null> {
  const row = await db.restaurant.findUnique({ where: { slug }, include: restaurantInclude });
  return row ? mapRestaurant(row, asOfMs) : null;
}

export function toDiscoveryRecord(profile: RestaurantProfile): DiscoveryRecord {
  const counts = { critical: 0, major: 0 };
  for (const f of profile.openOfficialFindings) {
    if (f.severity === "CRITICAL") counts.critical += 1;
    if (f.severity === "MAJOR") counts.major += 1;
  }
  return {
    slug: profile.slug,
    name: profile.name,
    cuisine: profile.cuisine,
    neighborhood: profile.location.neighborhood,
    priceTier: profile.priceTier,
    evidenceScore: profile.transparency.score,
    evidenceLabel: profile.transparency.label,
    latestInspectionMs: profile.latestInspection
      ? new Date(profile.latestInspection.inspectedAt + "T00:00:00Z").getTime()
      : null,
    unresolvedCritical: counts.critical,
    unresolvedMajor: counts.major,
    documentCount: profile.documents.length,
  };
}

export function ageInDays(isoOrMs: string | number, asOfMs: number): number {
  const ms = typeof isoOrMs === "number" ? isoOrMs : new Date(isoOrMs + "T00:00:00Z").getTime();
  return Math.floor((asOfMs - ms) / DAY_MS);
}
