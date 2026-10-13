import { describe, expect, it } from "vitest";
import { DAY_MS } from "@/lib/domain";
import { discoverRestaurants, type DiscoveryRecord } from "./discovery";

const ASOF = Date.UTC(2026, 9, 12);

function rec(overrides: Partial<DiscoveryRecord> & { slug: string; name: string }): DiscoveryRecord {
  return {
    cuisine: "Italian",
    neighborhood: "Old Mill",
    priceTier: 2,
    evidenceScore: 50,
    evidenceLabel: "Partial evidence coverage",
    latestInspectionMs: ASOF - 30 * DAY_MS,
    unresolvedCritical: 0,
    unresolvedMajor: 0,
    documentCount: 0,
    ...overrides,
  };
}

const RECORDS: DiscoveryRecord[] = [
  rec({ slug: "a", name: "Alder Kitchen", cuisine: "Modern American", evidenceScore: 90, latestInspectionMs: ASOF - 20 * DAY_MS, documentCount: 2 }),
  rec({ slug: "b", name: "Bluefin House", cuisine: "Japanese", neighborhood: "Harbor Row", evidenceScore: 70, unresolvedMajor: 1, latestInspectionMs: ASOF - 200 * DAY_MS }),
  rec({ slug: "c", name: "Cedar Taqueria", cuisine: "Mexican", evidenceScore: 35, unresolvedCritical: 1, latestInspectionMs: ASOF - 800 * DAY_MS }),
  rec({ slug: "d", name: "Dune Noodles", cuisine: "Noodles", evidenceScore: 10, latestInspectionMs: null }),
  rec({ slug: "e", name: "Ember Oak", cuisine: "BBQ", evidenceScore: 55, latestInspectionMs: ASOF - 300 * DAY_MS }),
  rec({ slug: "f", name: "Fern & Fig", cuisine: "Vegan", evidenceScore: 65, latestInspectionMs: ASOF - 120 * DAY_MS, documentCount: 1 }),
];

const base = { asOfMs: ASOF };

describe("discoverRestaurants — search", () => {
  it("matches name, cuisine and neighbourhood case-insensitively", () => {
    expect(discoverRestaurants(RECORDS, { ...base, q: "BLUEFIN" }).items.map((r) => r.slug)).toEqual(["b"]);
    expect(discoverRestaurants(RECORDS, { ...base, q: "taqueria" }).items.map((r) => r.slug)).toEqual(["c"]);
    expect(discoverRestaurants(RECORDS, { ...base, q: "harbor row" }).items.map((r) => r.slug)).toEqual(["b"]);
  });

  it("returns everything for an empty or whitespace query", () => {
    expect(discoverRestaurants(RECORDS, { ...base, q: "   " }).total).toBe(RECORDS.length);
  });

  it("returns an empty, well-formed result for no matches", () => {
    const result = discoverRestaurants(RECORDS, { ...base, q: "nonexistent-zzz" });
    expect(result).toMatchObject({ items: [], total: 0, totalPages: 1, page: 1 });
  });
});

describe("discoverRestaurants — filters", () => {
  it("filters by exact cuisine and treats 'all' as no filter", () => {
    expect(discoverRestaurants(RECORDS, { ...base, cuisine: "Vegan" }).items.map((r) => r.slug)).toEqual(["f"]);
    expect(discoverRestaurants(RECORDS, { ...base, cuisine: "all" }).total).toBe(RECORDS.length);
  });

  it("filters by evidence coverage bands", () => {
    expect(discoverRestaurants(RECORDS, { ...base, coverage: "STRONG" }).items.map((r) => r.slug)).toEqual(["a"]);
    expect(discoverRestaurants(RECORDS, { ...base, coverage: "GOOD" }).items.map((r) => r.slug).sort()).toEqual(["b", "f"]);
    expect(discoverRestaurants(RECORDS, { ...base, coverage: "LIMITED" }).items.map((r) => r.slug).sort()).toEqual(["c", "d"]);
  });

  it("filters by inspection age, including restaurants with no inspection", () => {
    expect(discoverRestaurants(RECORDS, { ...base, inspection: "CURRENT" }).items.map((r) => r.slug).sort()).toEqual(["a", "f"]);
    expect(discoverRestaurants(RECORDS, { ...base, inspection: "STALE" }).items.map((r) => r.slug)).toEqual(["c"]);
    expect(discoverRestaurants(RECORDS, { ...base, inspection: "NONE" }).items.map((r) => r.slug)).toEqual(["d"]);
  });

  it("filters by safety indicators", () => {
    expect(discoverRestaurants(RECORDS, { ...base, indicator: "OPEN_CRITICAL" }).items.map((r) => r.slug)).toEqual(["c"]);
    expect(discoverRestaurants(RECORDS, { ...base, indicator: "HAS_DOCUMENTS" }).items.map((r) => r.slug).sort()).toEqual(["a", "f"]);
    expect(discoverRestaurants(RECORDS, { ...base, indicator: "NO_OPEN_VIOLATIONS" }).items.map((r) => r.slug)).not.toContain("b");
  });

  it("combines filters with AND semantics", () => {
    const result = discoverRestaurants(RECORDS, { ...base, coverage: "GOOD", indicator: "NO_OPEN_VIOLATIONS" });
    expect(result.items.map((r) => r.slug)).toEqual(["f"]);
  });
});

describe("discoverRestaurants — sorting", () => {
  it("sorts by evidence completeness, highest first", () => {
    const slugs = discoverRestaurants(RECORDS, { ...base, sort: "EVIDENCE", pageSize: 50 }).items.map((r) => r.slug);
    expect(slugs).toEqual(["a", "b", "f", "e", "c", "d"]);
  });

  it("sorts by latest inspection, newest first, with missing inspections last", () => {
    const slugs = discoverRestaurants(RECORDS, { ...base, sort: "LATEST_INSPECTION", pageSize: 50 }).items.map((r) => r.slug);
    expect(slugs[0]).toBe("a");
    expect(slugs[slugs.length - 1]).toBe("d");
  });

  it("sorts by open violations, fewest first, with critical weighted above major", () => {
    const slugs = discoverRestaurants(RECORDS, { ...base, sort: "OPEN_VIOLATIONS", pageSize: 50 }).items.map((r) => r.slug);
    expect(slugs.indexOf("b")).toBeLessThan(slugs.indexOf("c"));
    expect(slugs.indexOf("a")).toBeLessThan(slugs.indexOf("b"));
  });
});

describe("discoverRestaurants — pagination and facets", () => {
  it("paginates and clamps out-of-range pages", () => {
    const page1 = discoverRestaurants(RECORDS, { ...base, pageSize: 4, page: 1 });
    expect(page1.items).toHaveLength(4);
    expect(page1.totalPages).toBe(2);
    const page99 = discoverRestaurants(RECORDS, { ...base, pageSize: 4, page: 99 });
    expect(page99.page).toBe(2);
    expect(page99.items).toHaveLength(2);
  });

  it("caps page size at the maximum", () => {
    expect(discoverRestaurants(RECORDS, { ...base, pageSize: 10_000 }).pageSize).toBe(50);
  });

  it("returns cuisine and neighbourhood facets from the full dataset", () => {
    const result = discoverRestaurants(RECORDS, { ...base, cuisine: "Vegan" });
    expect(result.facets.cuisines).toContain("BBQ");
    expect(result.facets.neighborhoods).toContain("Harbor Row");
  });
});
