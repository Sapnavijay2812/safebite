import { describe, expect, it } from "vitest";
import { checkModelAnswer, type GroundingSource } from "./validate";
import { resolveAiConfig } from "./provider";
import { checkGrounding } from "./gemini-extraction";

const sources: GroundingSource[] = [
  { id: "S1", label: "Evidence confidence", detail: "Evidence confidence 72/100 (Good evidence coverage)." },
  { id: "S2", label: "2026-07-08 inspection — Harbor Bay Demo Health Department", detail: "Outcome pass with conditions. Findings: major temperature controls (unresolved)." },
];

describe("checkModelAnswer — citations and grounding", () => {
  it("accepts a grounded answer that cites known sources", () => {
    const result = checkModelAnswer({ answer: "The latest record shows a major temperature finding.", citations: ["S2"], insufficientEvidence: false }, sources);
    expect(result.ok).toBe(true);
  });

  it("rejects citations that were not supplied", () => {
    const result = checkModelAnswer({ answer: "Invented.", citations: ["S99"], insufficientEvidence: false }, sources);
    expect(result).toEqual({ ok: false, reason: "UNKNOWN_CITATION" });
  });

  it("rejects a mix of known and unknown citations", () => {
    const result = checkModelAnswer({ answer: "Mixed.", citations: ["S1", "S42"], insufficientEvidence: false }, sources);
    expect(result).toEqual({ ok: false, reason: "UNKNOWN_CITATION" });
  });

  it("rejects ungrounded factual answers with no citations", () => {
    const result = checkModelAnswer({ answer: "It is fine.", citations: [], insufficientEvidence: false }, sources);
    expect(result).toEqual({ ok: false, reason: "EMPTY_CITATIONS" });
  });

  it("accepts an honest insufficient-evidence answer without citations", () => {
    const result = checkModelAnswer({ answer: "The sources do not say.", citations: [], insufficientEvidence: true }, sources);
    expect(result.ok).toBe(true);
  });

  it("rejects malformed payloads", () => {
    expect(checkModelAnswer({ answer: 42 }, sources)).toEqual({ ok: false, reason: "SCHEMA" });
    expect(checkModelAnswer({ answer: "x", citations: "S1", insufficientEvidence: false }, sources)).toEqual({ ok: false, reason: "SCHEMA" });
  });
});

describe("checkModelAnswer — invented dates and claims", () => {
  it("rejects a date that no cited source contains (invented inspection)", () => {
    const result = checkModelAnswer({ answer: "The inspection on 2025-01-03 found no issues.", citations: ["S2"], insufficientEvidence: false }, sources);
    expect(result).toEqual({ ok: false, reason: "UNSUPPORTED_DATE" });
  });

  it("accepts a date that the cited source contains", () => {
    const result = checkModelAnswer({ answer: "The inspection dated 2026-07-08 recorded a major finding.", citations: ["S2"], insufficientEvidence: false }, sources);
    expect(result.ok).toBe(true);
  });

  it("rejects certification and safety verdicts", () => {
    for (const answer of [
      "This restaurant is officially certified safe.",
      "The kitchen is safe to eat.",
      "There are no food safety risks here.",
      "It passed its official health inspection.",
    ]) {
      expect(checkModelAnswer({ answer, citations: ["S1"], insufficientEvidence: false }, sources).ok, answer).toBe(false);
    }
  });
});

describe("resolveAiConfig", () => {
  it("defaults to DEMO with no configuration", () => {
    const config = resolveAiConfig({});
    expect(config.mode).toBe("DEMO");
    expect(config.configError).toBeNull();
    expect(config.model).toBe("gemini-2.5-flash");
    expect(config.location).toBe("us-central1");
  });

  it("selects VERTEX from the environment without needing an access token", () => {
    const config = resolveAiConfig({ SAFEBITE_AI_MODE: "VERTEX", VERTEX_PROJECT_ID: "my-project", VERTEX_LOCATION: "europe-west4" });
    expect(config).toMatchObject({ mode: "VERTEX", projectId: "my-project", location: "europe-west4", configError: null });
  });

  it("reports a missing project as an explicit configuration error instead of silently using DEMO", () => {
    const config = resolveAiConfig({ SAFEBITE_AI_MODE: "VERTEX" });
    expect(config.mode).toBe("VERTEX");
    expect(config.configError).toMatch(/VERTEX_PROJECT_ID/);
  });

  it("rejects the removed GEMINI_API mode explicitly", () => {
    const config = resolveAiConfig({ SAFEBITE_AI_MODE: "GEMINI_API", GEMINI_API_KEY: "k" });
    expect(config.configError).toMatch(/no longer supported/);
  });

  it("uses GEMINI_MODEL when set, and clamps the timeout", () => {
    expect(resolveAiConfig({ GEMINI_MODEL: "gemini-2.5-pro" }).model).toBe("gemini-2.5-pro");
    expect(resolveAiConfig({ AI_TIMEOUT_MS: "999999" }).timeoutMs).toBe(60000);
  });
});

describe("checkGrounding — extraction proposals must appear in the document", () => {
  const text = "Inspection Date: 2026-07-08\nFinding 1 | MAJOR | TEMPERATURE_CONTROL | Cooler at 8.5 C | Status: OPEN";
  const base = {
    establishmentName: null,
    inspectionAuthority: null,
    inspectionDate: "2026-07-08",
    overallOutcome: null,
    referenceNumber: null,
    categoriesAssessed: [] as string[],
    findings: [{ severity: "MAJOR" as const, categoryKey: "TEMPERATURE_CONTROL", description: "Cooler at 8.5 C", status: "UNRESOLVED" as const, remediation: null }],
  };

  it("accepts values that appear in the source text", () => {
    expect(checkGrounding(base, text).ok).toBe(true);
  });

  it("rejects a date the document does not contain", () => {
    expect(checkGrounding({ ...base, inspectionDate: "2025-01-01" }, text).ok).toBe(false);
  });

  it("rejects a finding description the document does not contain", () => {
    const invented = { ...base, findings: [{ ...base.findings[0], description: "Rodents in the walk-in" }] };
    expect(checkGrounding(invented, text).ok).toBe(false);
  });
});
