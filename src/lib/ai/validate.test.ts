import { describe, expect, it } from "vitest";
import { checkModelAnswer } from "./validate";
import { resolveAiConfig } from "./provider";
import { checkGrounding } from "./gemini-extraction";

describe("checkModelAnswer — validation of Gemini output", () => {
  const allowed = ["S1", "S2", "S-METHOD"];

  it("accepts a grounded answer that cites known sources", () => {
    const result = checkModelAnswer({ answer: "Latest record shows a critical finding.", citations: ["S2"], insufficientEvidence: false }, allowed);
    expect(result.ok).toBe(true);
  });

  it("rejects citations that were not supplied", () => {
    const result = checkModelAnswer({ answer: "Invented.", citations: ["S99"], insufficientEvidence: false }, allowed);
    expect(result).toEqual({ ok: false, reason: "UNKNOWN_CITATION" });
  });

  it("rejects ungrounded factual answers with no citations", () => {
    const result = checkModelAnswer({ answer: "It is fine.", citations: [], insufficientEvidence: false }, allowed);
    expect(result).toEqual({ ok: false, reason: "EMPTY_CITATIONS" });
  });

  it("accepts an honest insufficient-evidence answer without citations", () => {
    const result = checkModelAnswer({ answer: "The sources do not say.", citations: [], insufficientEvidence: true }, allowed);
    expect(result.ok).toBe(true);
  });

  it("rejects malformed payloads and certification claims", () => {
    expect(checkModelAnswer({ answer: 42 }, allowed)).toEqual({ ok: false, reason: "SCHEMA" });
    expect(checkModelAnswer({ answer: "This restaurant is officially certified safe.", citations: ["S1"], insufficientEvidence: false }, allowed).ok).toBe(false);
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

describe("resolveAiConfig", () => {
  it("defaults to the demo explainer with no credentials", () => {
    expect(resolveAiConfig({}).effectiveMode).toBe("DEMO");
  });

  it("falls back to DEMO and says why when credentials are missing", () => {
    const config = resolveAiConfig({ SAFEBITE_AI_MODE: "VERTEX", VERTEX_PROJECT_ID: "p" });
    expect(config.requestedMode).toBe("VERTEX");
    expect(config.effectiveMode).toBe("DEMO");
    expect(config.reason).toMatch(/not set/);
  });

  it("selects Gemini only when the key is present", () => {
    expect(resolveAiConfig({ SAFEBITE_AI_MODE: "GEMINI_API", GEMINI_API_KEY: "k" }).effectiveMode).toBe("GEMINI_API");
  });
});
