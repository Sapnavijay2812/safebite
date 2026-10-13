import { describe, expect, it } from "vitest";
import { clientKey, isDemoAdminEnabled, isSafeStorageKey } from "./guards";

describe("isSafeStorageKey", () => {
  it("accepts keys inside the allow-listed folders", () => {
    expect(isSafeStorageKey("samples/sample-inspection-report.pdf")).toBe(true);
    expect(isSafeStorageKey("uploads/3f2a9c1e.pdf")).toBe(true);
  });

  it("rejects traversal, absolute paths and unknown folders", () => {
    expect(isSafeStorageKey("uploads/../../etc/passwd")).toBe(false);
    expect(isSafeStorageKey("/etc/passwd")).toBe(false);
    expect(isSafeStorageKey("secrets/.env")).toBe(false);
    expect(isSafeStorageKey("uploads/evil.html")).toBe(false);
    expect(isSafeStorageKey("uploads/%2e%2e/x.pdf")).toBe(false);
  });
});

describe("isDemoAdminEnabled", () => {
  it("is open outside production", () => {
    expect(isDemoAdminEnabled({ NODE_ENV: "development" })).toBe(true);
  });

  it("is closed in production unless explicitly enabled", () => {
    expect(isDemoAdminEnabled({ NODE_ENV: "production" })).toBe(false);
    expect(isDemoAdminEnabled({ NODE_ENV: "production", SAFEBITE_ENABLE_DEMO_ADMIN: "true" })).toBe(true);
  });
});

describe("clientKey", () => {
  it("hashes the client address so raw IPs are never stored", () => {
    const request = new Request("http://localhost/api/reports", { headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.1" } });
    const key = clientKey(request, { SAFEBITE_HASH_SALT: "s" });
    expect(key).toMatch(/^[a-f0-9]{32}$/);
    expect(key).not.toContain("203.0.113.9");
    expect(clientKey(request, { SAFEBITE_HASH_SALT: "s" })).toBe(key);
  });
});
