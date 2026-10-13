import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CATEGORY_KEYS } from "@/lib/domain";
import { DEMO_QUESTIONS, SEED_RESTAURANTS, SEED_SOURCES } from "./seed-data";

const sourceKeys = new Set(SEED_SOURCES.map((s) => s.key));

describe("demo seed dataset", () => {
  it("contains at least 12 uniquely named, fictional restaurants", () => {
    expect(SEED_RESTAURANTS.length).toBeGreaterThanOrEqual(12);
    expect(new Set(SEED_RESTAURANTS.map((r) => r.slug)).size).toBe(SEED_RESTAURANTS.length);
  });

  it("uses only known evidence sources and hygiene categories", () => {
    for (const r of SEED_RESTAURANTS) {
      for (const insp of r.inspections) {
        expect(sourceKeys.has(insp.sourceKey)).toBe(true);
        for (const c of insp.categories) expect(CATEGORY_KEYS).toContain(c);
        for (const f of insp.findings) expect(CATEGORY_KEYS).toContain(f.categoryKey);
      }
      for (const d of r.documents) expect(sourceKeys.has(d.sourceKey)).toBe(true);
    }
  });

  it("only attributes official-tier records to the simulated authority source", () => {
    for (const r of SEED_RESTAURANTS) {
      for (const insp of r.inspections) {
        if (insp.sourceKey === "OFFICIAL_SAMPLE") expect(insp.authority).toMatch(/simulated/);
      }
    }
  });

  it("covers every evidence state the demo needs to show", () => {
    const all = SEED_RESTAURANTS;
    // Unresolved critical violation
    expect(all.some((r) => r.inspections.some((i) => i.findings.some((f) => f.severity === "CRITICAL" && f.status === "UNRESOLVED")))).toBe(true);
    // Resolved critical violation with a verifying follow-up inspection
    expect(all.some((r) => r.inspections.some((i) => i.findings.some((f) => f.severity === "CRITICAL" && f.status === "RESOLVED" && f.resolvedByKey)))).toBe(true);
    // Missing evidence: no inspection at all
    expect(all.some((r) => r.inspections.length === 0)).toBe(true);
    // Stale official inspection
    expect(all.some((r) => r.inspections.some((i) => i.sourceKey === "OFFICIAL_SAMPLE" && i.date < "2025-01-01"))).toBe(true);
    // Self-reported claim
    expect(all.some((r) => r.documents.some((d) => d.sourceKey === "RESTAURANT_SUBMITTED"))).toBe(true);
    // Community reports in every moderation status
    const statuses = new Set(all.flatMap((r) => r.reports.map((rep) => rep.status)));
    expect([...statuses].sort()).toEqual(["CORROBORATED", "PENDING", "REJECTED", "UNDER_REVIEW"]);
  });

  it("links every resolved finding to a real later inspection", () => {
    for (const r of SEED_RESTAURANTS) {
      const keys = new Set(r.inspections.map((i) => i.key));
      for (const insp of r.inspections) {
        for (const f of insp.findings) {
          if (f.resolvedByKey) expect(keys.has(f.resolvedByKey)).toBe(true);
        }
      }
    }
  });

  it("points every seeded document at a sample file that exists in public/", () => {
    const root = path.resolve(__dirname, "..", "..", "..");
    for (const r of SEED_RESTAURANTS) {
      for (const d of r.documents) {
        expect(existsSync(path.join(root, "public", d.file)), d.file).toBe(true);
      }
    }
  });

  it("references only restaurants that exist in the seed for demo questions", () => {
    const slugs = new Set(SEED_RESTAURANTS.map((r) => r.slug));
    for (const q of DEMO_QUESTIONS) expect(slugs.has(q.slug)).toBe(true);
  });
});
