import { describe, expect, it } from "vitest";
import {
  COMPONENT_WEIGHTS,
  COVERAGE_WINDOW_DAYS,
  DAY_MS_LOCAL,
  computeTransparency,
  freshnessForAge,
  labelForScore,
  type EvidenceItemInput,
  type TransparencyInput,
} from "./transparency";

const ASOF = Date.UTC(2026, 9, 12);
const daysAgo = (days: number) => ASOF - days * DAY_MS_LOCAL;
const ALL = ["FOOD_STORAGE", "TEMPERATURE_CONTROL", "CLEANLINESS", "PEST_MANAGEMENT", "STAFF_HYGIENE", "CROSS_CONTAMINATION"];

function fullOfficial(ageDays: number): EvidenceItemInput {
  return { id: "insp-1", kind: "INSPECTION", tier: "OFFICIAL_VERIFIED", categoryKeys: ALL, dateMs: daysAgo(ageDays) };
}

function base(overrides: Partial<TransparencyInput> = {}): TransparencyInput {
  return { asOfMs: ASOF, categoryKeys: ALL, items: [], findings: [], complianceClaims: [], ...overrides };
}

describe("computeTransparency", () => {
  it("is deterministic: identical inputs give identical outputs", () => {
    const input = base({ items: [fullOfficial(30)] });
    expect(computeTransparency(input)).toEqual(computeTransparency(input));
  });

  it("returns zero confidence and unknown freshness when there is no evidence at all", () => {
    const result = computeTransparency(base());
    expect(result.score).toBe(0);
    expect(result.label).toBe("Limited evidence coverage");
    expect(result.missingCategories).toHaveLength(6);
    expect(result.latestOfficialAgeDays).toBeNull();
    expect(result.components.find((c) => c.key === "freshness")?.explanation).toMatch(/unknown, not unsafe/);
  });

  it("gives a full-marks score for six categories, official and within six months, with no findings", () => {
    const result = computeTransparency(base({ items: [fullOfficial(30)] }));
    expect(result.score).toBe(100);
    expect(result.label).toBe("Strong evidence coverage");
    expect(result.missingCategories).toEqual([]);
  });

  it("weights components exactly as documented", () => {
    const sum = COMPONENT_WEIGHTS.coverage + COMPONENT_WEIGHTS.freshness + COMPONENT_WEIGHTS.sourceQuality + COMPONENT_WEIGHTS.consistency;
    expect(sum).toBeCloseTo(1, 10);
  });

  it("never lets an unresolved critical official violation disappear from the counts", () => {
    const result = computeTransparency(
      base({
        items: [fullOfficial(30)],
        findings: [
          { id: "f1", tier: "OFFICIAL_VERIFIED", categoryKey: "CROSS_CONTAMINATION", severity: "CRITICAL", status: "UNRESOLVED" },
          { id: "f2", tier: "OFFICIAL_VERIFIED", categoryKey: "CLEANLINESS", severity: "MAJOR", status: "RESOLVED" },
        ],
      }),
    );
    expect(result.unresolvedOfficial).toEqual({ critical: 1, major: 0, minor: 0, observation: 0 });
    // Confidence reflects evidence, not the violation: resolved findings do not reduce it.
    expect(result.score).toBe(100);
  });

  it("does not count resolved findings as unresolved", () => {
    const result = computeTransparency(
      base({
        items: [fullOfficial(30)],
        findings: [{ id: "f1", tier: "OFFICIAL_VERIFIED", categoryKey: "PEST_MANAGEMENT", severity: "CRITICAL", status: "RESOLVED" }],
      }),
    );
    expect(result.unresolvedOfficial.critical).toBe(0);
  });

  it("ignores unverified and AI-inferred items for coverage and quality", () => {
    const result = computeTransparency(
      base({
        items: [
          { id: "u1", kind: "DOCUMENT", tier: "UNVERIFIED_ALLEGATION", categoryKeys: ALL, dateMs: daysAgo(5) },
          { id: "a1", kind: "DOCUMENT", tier: "AI_INFERRED", categoryKeys: ALL, dateMs: daysAgo(5) },
        ],
      }),
    );
    expect(result.score).toBe(0);
    expect(result.categories.every((c) => !c.covered)).toBe(true);
  });

  it("only lets self-reported evidence cover categories with a reduced source-quality weight", () => {
    const result = computeTransparency(
      base({
        items: [{ id: "s1", kind: "DOCUMENT", tier: "SELF_REPORTED", categoryKeys: ["FOOD_STORAGE"], dateMs: daysAgo(20) }],
      }),
    );
    const coverage = result.components.find((c) => c.key === "coverage");
    const quality = result.components.find((c) => c.key === "sourceQuality");
    expect(coverage?.value).toBe(Math.round((1 / 6) * 100));
    expect(quality?.value).toBe(40);
    expect(result.missingCategories).not.toContain("FOOD_STORAGE");
  });

  it("drops evidence outside the coverage window from coverage", () => {
    const result = computeTransparency(
      base({
        items: [{ id: "old", kind: "INSPECTION", tier: "OFFICIAL_VERIFIED", categoryKeys: ALL, dateMs: daysAgo(COVERAGE_WINDOW_DAYS + 10) }],
      }),
    );
    expect(result.missingCategories).toHaveLength(6);
  });

  it("keeps the label at Limited when no category has in-window evidence, even if older records lift the number", () => {
    const result = computeTransparency(
      base({
        items: [{ id: "old", kind: "INSPECTION", tier: "OFFICIAL_VERIFIED", categoryKeys: ALL, dateMs: daysAgo(846) }],
      }),
    );
    expect(result.score).toBeGreaterThan(0);
    expect(result.label).toBe("Limited evidence coverage");
  });

  it("penalises consistency when a self-reported compliance claim conflicts with an unresolved official finding", () => {
    const result = computeTransparency(
      base({
        items: [fullOfficial(60)],
        findings: [{ id: "f1", tier: "OFFICIAL_VERIFIED", categoryKey: "TEMPERATURE_CONTROL", severity: "MINOR", status: "UNRESOLVED" }],
        complianceClaims: [{ id: "c1", tier: "SELF_REPORTED", categoryKey: "TEMPERATURE_CONTROL" }],
      }),
    );
    expect(result.contradictionCategories).toEqual(["TEMPERATURE_CONTROL"]);
    expect(result.components.find((c) => c.key === "consistency")?.value).toBe(75);
    // coverage 100 x 0.35 + freshness 100 x 0.25 + quality 100 x 0.25 + consistency 75 x 0.15 = 96.25
    expect(result.score).toBe(96);
  });

  it("reports freshness by age band and labels missing inspections as unknown", () => {
    expect(freshnessForAge(null).score).toBe(0);
    expect(freshnessForAge(90).score).toBe(100);
    expect(freshnessForAge(200).score).toBe(75);
    expect(freshnessForAge(400).score).toBe(50);
    expect(freshnessForAge(700).score).toBe(25);
    expect(freshnessForAge(1000).score).toBe(0);
  });

  it("maps scores onto evidence labels", () => {
    expect(labelForScore(95)).toBe("Strong evidence coverage");
    expect(labelForScore(65)).toBe("Good evidence coverage");
    expect(labelForScore(45)).toBe("Partial evidence coverage");
    expect(labelForScore(10)).toBe("Limited evidence coverage");
  });
});
