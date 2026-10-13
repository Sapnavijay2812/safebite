// Restaurant discovery: search, filter, sort and paginate. Pure functions so the
// same logic is used by the API routes, the pages and the unit tests.

import { DAY_MS } from "@/lib/domain";

export interface DiscoveryRecord {
  slug: string;
  name: string;
  cuisine: string;
  neighborhood: string;
  priceTier: number;
  evidenceScore: number;
  evidenceLabel: string;
  latestInspectionMs: number | null;
  unresolvedCritical: number;
  unresolvedMajor: number;
  documentCount: number;
}

export type CoverageFilter = "ANY" | "STRONG" | "GOOD" | "PARTIAL" | "LIMITED";
export type InspectionFilter = "ANY" | "CURRENT" | "AGING" | "STALE" | "NONE";
export type IndicatorFilter = "ANY" | "NO_OPEN_VIOLATIONS" | "OPEN_CRITICAL" | "HAS_DOCUMENTS";
export type SortKey = "EVIDENCE" | "LATEST_INSPECTION" | "OPEN_VIOLATIONS" | "NAME";

export interface DiscoveryParams {
  q?: string;
  cuisine?: string;
  neighborhood?: string;
  coverage?: CoverageFilter;
  inspection?: InspectionFilter;
  indicator?: IndicatorFilter;
  sort?: SortKey;
  page?: number;
  pageSize?: number;
  asOfMs: number;
}

export interface DiscoveryResult {
  items: DiscoveryRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  facets: { cuisines: string[]; neighborhoods: string[] };
}

export const DEFAULT_PAGE_SIZE = 9;
export const MAX_PAGE_SIZE = 50;

export function inspectionAgeDays(record: DiscoveryRecord, asOfMs: number): number | null {
  if (record.latestInspectionMs === null) return null;
  return Math.max(0, Math.floor((asOfMs - record.latestInspectionMs) / DAY_MS));
}

function matchesCoverage(score: number, filter: CoverageFilter): boolean {
  switch (filter) {
    case "STRONG":
      return score >= 80;
    case "GOOD":
      return score >= 60 && score < 80;
    case "PARTIAL":
      return score >= 40 && score < 60;
    case "LIMITED":
      return score < 40;
    default:
      return true;
  }
}

function matchesInspection(record: DiscoveryRecord, filter: InspectionFilter, asOfMs: number): boolean {
  if (filter === "ANY") return true;
  const age = inspectionAgeDays(record, asOfMs);
  if (filter === "NONE") return age === null;
  if (age === null) return false;
  if (filter === "CURRENT") return age <= 180;
  if (filter === "AGING") return age > 180 && age <= 365;
  return age > 365;
}

function matchesIndicator(record: DiscoveryRecord, filter: IndicatorFilter): boolean {
  switch (filter) {
    case "NO_OPEN_VIOLATIONS":
      return record.unresolvedCritical === 0 && record.unresolvedMajor === 0;
    case "OPEN_CRITICAL":
      return record.unresolvedCritical > 0;
    case "HAS_DOCUMENTS":
      return record.documentCount > 0;
    default:
      return true;
  }
}

export function matchesQuery(record: DiscoveryRecord, q: string | undefined): boolean {
  const needle = q?.trim().toLowerCase();
  if (!needle) return true;
  return [record.name, record.cuisine, record.neighborhood].some((value) =>
    value.toLowerCase().includes(needle),
  );
}

function compareRecords(a: DiscoveryRecord, b: DiscoveryRecord, sort: SortKey): number {
  const byName = a.name.localeCompare(b.name);
  switch (sort) {
    case "EVIDENCE":
      return b.evidenceScore - a.evidenceScore || byName;
    case "LATEST_INSPECTION": {
      // Restaurants with no inspection sort last, never first.
      const aMs = a.latestInspectionMs;
      const bMs = b.latestInspectionMs;
      if (aMs === null && bMs === null) return byName;
      if (aMs === null) return 1;
      if (bMs === null) return -1;
      return bMs - aMs || byName;
    }
    case "OPEN_VIOLATIONS": {
      const aOpen = a.unresolvedCritical * 10 + a.unresolvedMajor;
      const bOpen = b.unresolvedCritical * 10 + b.unresolvedMajor;
      return aOpen - bOpen || byName;
    }
    default:
      return byName;
  }
}

export function discoverRestaurants(records: DiscoveryRecord[], params: DiscoveryParams): DiscoveryResult {
  const sort = params.sort ?? "EVIDENCE";
  const pageSize = Math.min(Math.max(params.pageSize ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const cuisineNeedle = params.cuisine?.toLowerCase();
  const neighborhoodNeedle = params.neighborhood?.toLowerCase();

  const filtered = records
    .filter((r) => matchesQuery(r, params.q))
    .filter((r) => !cuisineNeedle || cuisineNeedle === "all" || r.cuisine.toLowerCase() === cuisineNeedle)
    .filter((r) => !neighborhoodNeedle || neighborhoodNeedle === "all" || r.neighborhood.toLowerCase() === neighborhoodNeedle)
    .filter((r) => matchesCoverage(r.evidenceScore, params.coverage ?? "ANY"))
    .filter((r) => matchesInspection(r, params.inspection ?? "ANY", params.asOfMs))
    .filter((r) => matchesIndicator(r, params.indicator ?? "ANY"))
    .sort((a, b) => compareRecords(a, b, sort));

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(params.page ?? 1, 1), totalPages);
  const start = (page - 1) * pageSize;

  return {
    items: filtered.slice(start, start + pageSize),
    total,
    page,
    pageSize,
    totalPages,
    facets: {
      cuisines: Array.from(new Set(records.map((r) => r.cuisine))).sort(),
      neighborhoods: Array.from(new Set(records.map((r) => r.neighborhood))).sort(),
    },
  };
}
