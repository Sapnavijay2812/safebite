import { describe, expect, it } from "vitest";
import type { RestaurantProfile } from "@/lib/data/types";
import { computeTransparency } from "@/lib/scoring/transparency";
import { answerDeterministically, buildEvidenceBundle } from "./explainer";
import { sanitizeForModel } from "./sanitize";

const ASOF = Date.UTC(2026, 9, 12);

function profile(overrides: Partial<RestaurantProfile> = {}): RestaurantProfile {
  const transparency = computeTransparency({
    asOfMs: ASOF,
    items: [{ id: "i1", kind: "INSPECTION", tier: "OFFICIAL_VERIFIED", categoryKeys: ["FOOD_STORAGE"], dateMs: ASOF - 40 * 86_400_000 }],
    findings: [],
    complianceClaims: [],
  });
  return {
    id: "r1",
    slug: "copperleaf-kitchen",
    name: "Copperleaf Kitchen",
    cuisine: "Modern American",
    priceTier: 3,
    description: "Fictional test restaurant.",
    accentColor: "#2F6B4F",
    isFictional: true,
    location: { addressLine: "1 Test St", neighborhood: "Old Mill", city: "Harbor Bay", latitude: 0, longitude: 0 },
    inspections: [],
    latestInspection: null,
    openOfficialFindings: [],
    documents: [],
    communityReports: [],
    communityCounts: { PENDING: 0, UNDER_REVIEW: 0, CORROBORATED: 0, REJECTED: 0 },
    transparency,
    missingInformation: [],
    ...overrides,
  };
}

const openFinding = {
  id: "f-open",
  inspectionId: "insp-1",
  inspectedAt: "2026-07-08",
  categoryKey: "TEMPERATURE_CONTROL",
  categoryLabel: "Temperature controls",
  severity: "CRITICAL" as const,
  description: "Walk-in cooler above 5 C",
  status: "UNRESOLVED" as const,
  remediation: null,
  resolvedAt: null,
  tier: "OFFICIAL_VERIFIED" as const,
  sourceLabel: "Official record (simulated sample)",
};

const latestInspection = {
  id: "insp-1",
  inspectedAt: "2026-07-08",
  authorityName: "Harbor Bay Demo Health Department",
  sourceKey: "OFFICIAL_SAMPLE",
  sourceLabel: "Official record (simulated sample)",
  tier: "OFFICIAL_VERIFIED" as const,
  outcome: "FAIL",
  summary: "Cooler temperature outside the permitted range.",
  isSimulated: true,
  categories: ["TEMPERATURE_CONTROL"],
  findings: [openFinding],
};

describe("buildEvidenceBundle", () => {
  it("gives every source a unique ID and always includes the score and methodology", () => {
    const sources = buildEvidenceBundle(profile({ inspections: [latestInspection], openOfficialFindings: [openFinding] }));
    const ids = sources.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(sources.find((s) => s.kind === "SCORE")).toBeTruthy();
    expect(sources.find((s) => s.kind === "METHOD")?.id).toBe("S-METHOD");
  });

  it("links each finding source back to its database record", () => {
    const sources = buildEvidenceBundle(profile({ inspections: [latestInspection], openOfficialFindings: [openFinding] }));
    expect(sources.find((s) => s.kind === "FINDING")?.refId).toBe("f-open");
  });
});

describe("answerDeterministically — grounding", () => {
  it("cites the finding source for an unresolved-violation question", () => {
    const p = profile({ inspections: [latestInspection], openOfficialFindings: [openFinding] });
    const sources = buildEvidenceBundle(p);
    const answer = answerDeterministically("Are there unresolved violations?", p, sources);
    expect(answer.intent).toBe("UNRESOLVED");
    const findingSource = sources.find((s) => s.kind === "FINDING");
    expect(answer.citedSourceIds).toContain(findingSource?.id);
    expect(answer.answer).toContain("Walk-in cooler above 5 C");
  });

  it("says no inspection is on record instead of inventing one", () => {
    const p = profile();
    const answer = answerDeterministically("What does its latest inspection report actually say?", p, buildEvidenceBundle(p));
    expect(answer.insufficientEvidence).toBe(true);
    expect(answer.citedSourceIds).toEqual([]);
    expect(answer.answer).toMatch(/no official inspection on record/i);
  });

  it("explains the score using only the recorded components", () => {
    const p = profile({ inspections: [latestInspection] });
    const sources = buildEvidenceBundle(p);
    const answer = answerDeterministically("Why is this restaurant's evidence confidence lower?", p, sources);
    expect(answer.answer).toContain(`${p.transparency.score}/100`);
    expect(answer.citedSourceIds).toEqual([sources.find((s) => s.kind === "SCORE")?.id]);
  });

  it("lists missing categories and never calls missing information unsafe", () => {
    const p = profile({ inspections: [latestInspection] });
    const answer = answerDeterministically("What information is missing?", p, buildEvidenceBundle(p));
    expect(answer.answer).toMatch(/No evidence is on record for/);
    expect(answer.answer).toMatch(/unknown, not as unsafe/);
  });

  it("gives general guidance without restaurant-specific facts", () => {
    const p = profile({ inspections: [latestInspection] });
    const answer = answerDeterministically("What should I look for when evaluating food safety?", p, buildEvidenceBundle(p));
    expect(answer.intent).toBe("GUIDANCE");
    expect(answer.citedSourceIds).toEqual(["S-METHOD"]);
    expect(answer.answer).not.toContain("Copperleaf");
  });

  it("asks for a second restaurant when a comparison has no counterpart", () => {
    const p = profile();
    const answer = answerDeterministically("How does this restaurant compare with another?", p, buildEvidenceBundle(p));
    expect(answer.intent).toBe("COMPARE");
    expect(answer.answer).toMatch(/Choose a second restaurant/);
  });

  it("compares two restaurants using both recorded scores", () => {
    const a = profile({ inspections: [latestInspection], openOfficialFindings: [openFinding] });
    const b = profile({ id: "r2", slug: "other", name: "Other Kitchen" });
    const answer = answerDeterministically("Compare this with Other Kitchen", a, buildEvidenceBundle(a), b);
    expect(answer.intent).toBe("COMPARE");
    expect(answer.answer).toContain(`${b.transparency.score}/100`);
    expect(answer.answer).toMatch(/not a ranking/);
  });

  it("never contains a certification or safety verdict", () => {
    const p = profile({ inspections: [latestInspection], openOfficialFindings: [openFinding] });
    const sources = buildEvidenceBundle(p);
    for (const q of ["lower score", "latest report", "unresolved", "missing", "compare", "look for", "hello"]) {
      expect(answerDeterministically(q, p, sources).answer).not.toMatch(/certified|safe to eat|100% safe/i);
    }
  });
});

describe("sanitizeForModel", () => {
  it("strips control characters and caps length", () => {
    expect(sanitizeForModel("ab\u0000c", 10)).toBe("abc");
    expect(sanitizeForModel("x".repeat(1000), 50)).toHaveLength(50);
  });
});
