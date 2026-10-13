import { describe, expect, it } from "vitest";
import { explainSchema, moderationSchema, publishReviewSchema, reportCreateSchema, restaurantListQuerySchema } from "./schemas";

const validReport = {
  restaurantSlug: "tidewater-taqueria",
  category: "CLEANLINESS",
  description: "Prep boards looked unwashed during the lunch rush.",
  incidentDate: "2026-08-02",
};

describe("reportCreateSchema — community report validation", () => {
  it("accepts a well-formed report", () => {
    expect(reportCreateSchema.safeParse(validReport).success).toBe(true);
  });

  it("rejects descriptions that are too short to be useful", () => {
    expect(reportCreateSchema.safeParse({ ...validReport, description: "dirty" }).success).toBe(false);
  });

  it("rejects unknown categories and malformed dates", () => {
    expect(reportCreateSchema.safeParse({ ...validReport, category: "VIBES" }).success).toBe(false);
    expect(reportCreateSchema.safeParse({ ...validReport, incidentDate: "02/08/2026" }).success).toBe(false);
  });

  it("rejects a filled-in honeypot field", () => {
    expect(reportCreateSchema.safeParse({ ...validReport, website: "http://spam.example" }).success).toBe(false);
  });

  it("rejects restaurant identifiers that could be used for injection", () => {
    expect(reportCreateSchema.safeParse({ ...validReport, restaurantSlug: "../../etc" }).success).toBe(false);
  });
});

describe("moderationSchema", () => {
  it("accepts only known target statuses", () => {
    expect(moderationSchema.safeParse({ toStatus: "CORROBORATED", note: "Matched" }).success).toBe(true);
    expect(moderationSchema.safeParse({ toStatus: "DELETED" }).success).toBe(false);
  });
});

describe("explainSchema", () => {
  it("requires a real question and a valid slug", () => {
    expect(explainSchema.safeParse({ restaurantSlug: "harvest-table", question: "Any open issues?" }).success).toBe(true);
    expect(explainSchema.safeParse({ restaurantSlug: "harvest-table", question: "a" }).success).toBe(false);
    expect(explainSchema.safeParse({ restaurantSlug: "Harvest Table!", question: "Any open issues?" }).success).toBe(false);
  });
});

describe("publishReviewSchema", () => {
  const review = {
    inspectionAuthority: "Harbor Bay Demo Health Department",
    inspectionDate: "2026-07-08",
    overallOutcome: "PASS_WITH_CONDITIONS",
    categoriesAssessed: ["FOOD_STORAGE"],
    findings: [],
    reviewerNote: "Checked against the original.",
  };

  it("defaults to saving a review without publishing", () => {
    const parsed = publishReviewSchema.parse(review);
    expect(parsed.publish).toBe(false);
    expect(parsed.confirmHumanReview).toBe(false);
  });

  it("rejects an outcome outside the allowed list", () => {
    expect(publishReviewSchema.safeParse({ ...review, overallOutcome: "EXCELLENT" }).success).toBe(false);
  });

  it("rejects control characters in free text", () => {
    expect(publishReviewSchema.safeParse({ ...review, inspectionAuthority: "Harbor\u0000Bay" }).success).toBe(false);
  });
});

describe("restaurantListQuerySchema", () => {
  it("applies safe defaults and caps page size", () => {
    const parsed = restaurantListQuerySchema.parse({});
    expect(parsed).toMatchObject({ coverage: "ANY", sort: "EVIDENCE", page: 1, pageSize: 9 });
    expect(restaurantListQuerySchema.safeParse({ pageSize: "500" }).success).toBe(false);
  });

  it("rejects unknown sort keys instead of passing them to the database", () => {
    expect(restaurantListQuerySchema.safeParse({ sort: "price; DROP TABLE" }).success).toBe(false);
  });
});
