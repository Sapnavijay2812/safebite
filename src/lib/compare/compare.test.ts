import { describe, expect, it } from "vitest";
import { buildComparison, parseCompareSlugs, type CompareSubject } from "./compare";

function subject(overrides: Partial<CompareSubject> & { slug: string; name: string }): CompareSubject {
  return {
    evidenceScore: 60,
    evidenceLabel: "Good evidence coverage",
    latestInspectionDate: "2026-06-01",
    latestInspectionAgeDays: 133,
    latestOutcome: "PASS",
    officialFindingsLatest: 0,
    unresolvedCritical: 0,
    unresolvedMajor: 0,
    unresolvedMinor: 0,
    coveredCategories: ["FOOD_STORAGE", "CLEANLINESS"],
    missingCategories: ["TEMPERATURE_CONTROL", "PEST_MANAGEMENT", "STAFF_HYGIENE", "CROSS_CONTAMINATION"],
    documentTitles: [],
    missingInformation: [],
    ...overrides,
  };
}

describe("buildComparison", () => {
  const a = subject({ slug: "a", name: "Alpha", unresolvedCritical: 1, evidenceScore: 80 });
  const b = subject({ slug: "b", name: "Beta", latestInspectionDate: null, latestInspectionAgeDays: null, latestOutcome: null, coveredCategories: [], missingCategories: ["FOOD_STORAGE"] });

  it("produces one row per metric with a value for every subject", () => {
    const result = buildComparison([a, b]);
    expect(result.rows.length).toBeGreaterThanOrEqual(8);
    for (const row of result.rows) {
      expect(Object.keys(row.values).sort()).toEqual(["a", "b"]);
    }
  });

  it("flags unresolved critical violations in the observations", () => {
    const result = buildComparison([a, b]);
    expect(result.observations).toContain("Alpha has 1 unresolved critical official violation(s).");
  });

  it("treats a missing inspection as unknown rather than unsafe", () => {
    const result = buildComparison([a, b]);
    expect(result.observations.join(" ")).toMatch(/Beta has no official inspection on record\. Its status is unknown, not unsafe\./);
    expect(result.rows.find((r) => r.key === "latestInspection")?.values.b).toBe("None on record");
  });

  it("never produces a ranking or 'safer' verdict", () => {
    const result = buildComparison([a, b]);
    // Check the observations and table values; the disclaimer itself says "does not rank".
    const text = JSON.stringify([result.observations, result.rows]).toLowerCase();
    expect(text).not.toMatch(/\bsafer\b/);
    expect(text).not.toMatch(/\brank(ed|ing)?\b/);
    expect(result.disclaimer).toMatch(/does not rank/);
  });

  it("reports when subjects have no material differences", () => {
    const c = subject({ slug: "c", name: "Gamma" });
    const d = subject({ slug: "d", name: "Delta" });
    expect(buildComparison([c, d]).observations).toEqual([
      "No material differences in the recorded evidence were found between these restaurants.",
    ]);
  });
});

describe("parseCompareSlugs", () => {
  it("accepts two or three distinct slugs", () => {
    expect(parseCompareSlugs("a-b,c")).toEqual({ ok: true, slugs: ["a-b", "c"] });
    expect(parseCompareSlugs("a,b,c")).toEqual({ ok: true, slugs: ["a", "b", "c"] });
  });

  it("rejects one, four or duplicated-only selections", () => {
    expect(parseCompareSlugs("a").ok).toBe(false);
    expect(parseCompareSlugs("a,a").ok).toBe(false);
    expect(parseCompareSlugs("a,b,c,d").ok).toBe(false);
    expect(parseCompareSlugs(null).ok).toBe(false);
  });

  it("rejects identifiers with unexpected characters", () => {
    const result = parseCompareSlugs("a,<script>");
    expect(result.ok).toBe(false);
  });
});
