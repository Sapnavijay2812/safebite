import { describe, expect, it, vi } from "vitest";
import { ApiError, handleApiError, readJson } from "./errors";

describe("handleApiError", () => {
  it("returns the consistent error envelope for known API errors", async () => {
    const response = handleApiError(new ApiError(404, "NOT_FOUND", "Restaurant not found."), "test");
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body).toEqual({ error: { code: "NOT_FOUND", message: "Restaurant not found." } });
  });

  it("maps validation failures to 400 with field paths", async () => {
    const { z } = await import("zod");
    const parsed = z.object({ page: z.number() }).safeParse({ page: "x" });
    if (parsed.success) throw new Error("expected failure");
    const response = handleApiError(parsed.error, "test");
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_FAILED");
    expect(body.error.details[0].path).toBe("page");
  });

  it("hides internal error details and logs them on the server", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = handleApiError(new Error("connection string postgres://user:secret@host failed"), "test");
    expect(response.status).toBe(500);
    const text = await response.text();
    expect(text).not.toContain("secret");
    expect(text).not.toContain("postgres");
    expect(text).toContain("INTERNAL_ERROR");
    spy.mockRestore();
  });
});

describe("readJson", () => {
  it("rejects non-JSON content types", async () => {
    const request = new Request("http://localhost/api/reports", { method: "POST", headers: { "content-type": "text/plain" }, body: "{}" });
    await expect(readJson(request)).rejects.toMatchObject({ status: 415, code: "UNSUPPORTED_MEDIA_TYPE" });
  });

  it("rejects malformed JSON with a 400", async () => {
    const request = new Request("http://localhost/api/reports", { method: "POST", headers: { "content-type": "application/json" }, body: "{nope" });
    await expect(readJson(request)).rejects.toMatchObject({ status: 400, code: "INVALID_JSON" });
  });

  it("parses valid JSON bodies", async () => {
    const request = new Request("http://localhost/api/reports", { method: "POST", headers: { "content-type": "application/json" }, body: '{"a":1}' });
    await expect(readJson(request)).resolves.toEqual({ a: 1 });
  });
});
