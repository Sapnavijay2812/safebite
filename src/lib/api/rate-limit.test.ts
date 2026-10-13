import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rate-limit";

describe("createRateLimiter", () => {
  it("allows up to the limit and then blocks with a retry hint", () => {
    let now = 0;
    const limiter = createRateLimiter(() => now);
    expect(limiter.consume("ip", 2, 60_000).allowed).toBe(true);
    expect(limiter.consume("ip", 2, 60_000).allowed).toBe(true);
    const blocked = limiter.consume("ip", 2, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(60);
  });

  it("resets after the window passes", () => {
    let now = 0;
    const limiter = createRateLimiter(() => now);
    limiter.consume("ip", 1, 1000);
    expect(limiter.consume("ip", 1, 1000).allowed).toBe(false);
    now = 1001;
    expect(limiter.consume("ip", 1, 1000).allowed).toBe(true);
  });

  it("keeps keys independent", () => {
    const limiter = createRateLimiter(() => 0);
    limiter.consume("a", 1, 1000);
    expect(limiter.consume("b", 1, 1000).allowed).toBe(true);
  });
});
