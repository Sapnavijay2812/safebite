import { describe, expect, it } from "vitest";
import type { RestaurantProfile } from "@/lib/data/types";
import { computeTransparency } from "@/lib/scoring/transparency";
import { explainQuestion } from "./explain-service";
import { resolveAiConfig } from "./provider";
import type { GenerateClient } from "./vertex-client";

const ASOF = Date.UTC(2026, 9, 12);

const finding = {
  id: "f-open",
  inspectionId: "insp-1",
  inspectedAt: "2026-07-08",
  categoryKey: "TEMPERATURE_CONTROL",
  categoryLabel: "Temperature controls",
  severity: "MAJOR" as const,
  description: "Reach-in cooler recorded 8.5 C",
  status: "UNRESOLVED" as const,
  remediation: null,
  resolvedAt: null,
  tier: "OFFICIAL_VERIFIED" as const,
  sourceLabel: "Official record (simulated sample)",
};

const inspection = {
  id: "insp-1",
  inspectedAt: "2026-07-08",
  authorityName: "Harbor Bay Demo Health Department (simulated)",
  sourceKey: "OFFICIAL_SAMPLE",
  sourceLabel: "Official record (simulated sample)",
  tier: "OFFICIAL_VERIFIED" as const,
  outcome: "PASS_WITH_CONDITIONS",
  summary: "Cooler temperature needs service.",
  isSimulated: true,
  categories: ["TEMPERATURE_CONTROL"],
  findings: [finding],
};

function profile(): RestaurantProfile {
  const transparency = computeTransparency({
    asOfMs: ASOF,
    items: [{ id: "insp-1", kind: "INSPECTION", tier: "OFFICIAL_VERIFIED", categoryKeys: ["TEMPERATURE_CONTROL"], dateMs: Date.UTC(2026, 6, 8) }],
    findings: [{ id: "f-open", tier: "OFFICIAL_VERIFIED", categoryKey: "TEMPERATURE_CONTROL", severity: "MAJOR", status: "UNRESOLVED" }],
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
    inspections: [inspection],
    latestInspection: inspection,
    openOfficialFindings: [finding],
    documents: [],
    communityReports: [],
    communityCounts: { PENDING: 0, UNDER_REVIEW: 0, CORROBORATED: 0, REJECTED: 0 },
    transparency,
    missingInformation: [],
  };
}

const vertexConfig = resolveAiConfig({ SAFEBITE_AI_MODE: "VERTEX", VERTEX_PROJECT_ID: "test-project" });

// The sources that the explainer sends to the model. S-METHOD is always present.
// Only the ids are needed here; the content is checked by validate.test.ts.
function replyWith(payload: unknown): GenerateClient {
  return {
    async generateContent() {
      return { text: typeof payload === "string" ? payload : JSON.stringify(payload) };
    },
  };
}

const failing = (error: Error): GenerateClient => ({
  async generateContent() {
    throw error;
  },
});

const question = "Are there unresolved violations?";

describe("explainQuestion — real Vertex AI answers", () => {
  it("returns the Gemini answer with its citations when the response is grounded", async () => {
    const response = await explainQuestion({
      question,
      profile: profile(),
      config: vertexConfig,
      client: replyWith({ answer: "One unresolved major finding is recorded.", citations: ["S2"], insufficientEvidence: false }),
    });
    expect(response.source).toBe("VERTEX_AI");
    expect(response.modelLabel).toBe("Gemini gemini-2.5-flash on Vertex AI");
    expect(response.errorCode).toBeNull();
    expect(response.answer).toBe("One unresolved major finding is recorded.");
    expect(response.citations.map((c) => c.id)).toEqual(["S2"]);
  });
});

describe("explainQuestion — rejected or failed model output shows a labelled template, never a Gemini label", () => {
  it("rejects an answer that cites a source that was not supplied", async () => {
    const response = await explainQuestion({
      question,
      profile: profile(),
      config: vertexConfig,
      client: replyWith({ answer: "Invented.", citations: ["S99"], insufficientEvidence: false }),
    });
    expect(response.source).toBe("TEMPLATE_AFTER_VERTEX_ERROR");
    expect(response.errorCode).toBe("UNKNOWN_CITATION");
    expect(response.modelLabel).toMatch(/DEMO EXPLAINER/);
    expect(response.notice).toMatch(/not from Gemini/);
  });

  it("rejects an answer that invents an inspection date", async () => {
    const response = await explainQuestion({
      question,
      profile: profile(),
      config: vertexConfig,
      client: replyWith({ answer: "An inspection on 2024-02-29 found nothing.", citations: ["S2"], insufficientEvidence: false }),
    });
    expect(response.source).toBe("TEMPLATE_AFTER_VERTEX_ERROR");
    expect(response.errorCode).toBe("UNSUPPORTED_DATE");
  });

  it("rejects non-JSON model text", async () => {
    const response = await explainQuestion({ question, profile: profile(), config: vertexConfig, client: replyWith("Sure! Here you go.") });
    expect(response.source).toBe("TEMPLATE_AFTER_VERTEX_ERROR");
    expect(response.errorCode).toBe("UNREADABLE_RESPONSE");
  });
});

describe("explainQuestion — Vertex failures are shown, not hidden", () => {
  it("reports a timeout with its error code", async () => {
    const error = new Error("The operation was aborted");
    error.name = "AbortError";
    const response = await explainQuestion({ question, profile: profile(), config: vertexConfig, client: failing(error) });
    expect(response.source).toBe("TEMPLATE_AFTER_VERTEX_ERROR");
    expect(response.errorCode).toBe("TIMEOUT");
    expect(response.notice).toMatch(/TIMEOUT/);
  });

  it("reports missing Application Default Credentials", async () => {
    const response = await explainQuestion({
      question,
      profile: profile(),
      config: vertexConfig,
      client: failing(new Error("Could not load the default credentials.")),
    });
    expect(response.source).toBe("TEMPLATE_AFTER_VERTEX_ERROR");
    expect(response.errorCode).toBe("AUTH_FAILED");
  });

  it("reports a model failure", async () => {
    const response = await explainQuestion({
      question,
      profile: profile(),
      config: vertexConfig,
      client: failing(new Error("404 Model not found")),
    });
    expect(response.errorCode).toBe("MODEL_ERROR");
  });

  it("reports a missing project as a configuration error before any call is made", async () => {
    let called = false;
    const client: GenerateClient = {
      async generateContent() {
        called = true;
        return { text: "{}" };
      },
    };
    const response = await explainQuestion({
      question,
      profile: profile(),
      config: resolveAiConfig({ SAFEBITE_AI_MODE: "VERTEX" }),
      client,
    });
    expect(called).toBe(false);
    expect(response.errorCode).toBe("CONFIG_ERROR");
    expect(response.source).toBe("TEMPLATE_AFTER_VERTEX_ERROR");
  });
});

describe("explainQuestion — demo mode", () => {
  it("answers from the template and never calls a model", async () => {
    let called = false;
    const client: GenerateClient = {
      async generateContent() {
        called = true;
        return { text: "{}" };
      },
    };
    const response = await explainQuestion({ question, profile: profile(), config: resolveAiConfig({}), client });
    expect(called).toBe(false);
    expect(response.source).toBe("DEMO_TEMPLATE");
    expect(response.modelLabel).toBe("DEMO EXPLAINER (deterministic template, not Gemini)");
    expect(response.errorCode).toBeNull();
  });
});
