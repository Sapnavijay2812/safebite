import { describe, expect, it } from "vitest";
import { canTransition, isPubliclyListable, validateTransition } from "./moderation";

const LONG_NOTE = "Second independent report matched the timeline.";

describe("moderation state machine", () => {
  it("allows the documented forward path", () => {
    expect(validateTransition("PENDING", "UNDER_REVIEW", undefined).ok).toBe(true);
    expect(validateTransition("UNDER_REVIEW", "CORROBORATED", LONG_NOTE).ok).toBe(true);
  });

  it("blocks skipping review and leaving terminal states", () => {
    expect(canTransition("PENDING", "CORROBORATED")).toBe(false);
    expect(canTransition("CORROBORATED", "REJECTED")).toBe(false);
    expect(canTransition("REJECTED", "PENDING")).toBe(false);
    expect(validateTransition("REJECTED", "UNDER_REVIEW", LONG_NOTE).ok).toBe(false);
  });

  it("requires a meaningful note to corroborate or reject", () => {
    const missing = validateTransition("UNDER_REVIEW", "CORROBORATED", "   ");
    expect(missing.ok).toBe(false);
    expect(validateTransition("PENDING", "REJECTED", "spam").ok).toBe(false);
    expect(validateTransition("PENDING", "REJECTED", "Duplicate of an existing submission").ok).toBe(true);
  });

  it("only lists corroborated reports publicly", () => {
    expect(isPubliclyListable("CORROBORATED")).toBe(true);
    expect(isPubliclyListable("PENDING")).toBe(false);
    expect(isPubliclyListable("UNDER_REVIEW")).toBe(false);
    expect(isPubliclyListable("REJECTED")).toBe(false);
  });
});
