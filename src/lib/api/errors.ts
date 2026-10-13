// Consistent API error envelope:
//   { "error": { "code": "VALIDATION_FAILED", "message": "...", "details": ... } }
// Internal error messages are logged on the server and never returned to clients.

import { NextResponse } from "next/server";
import { ZodError } from "zod";

export type ApiErrorCode =
  | "VALIDATION_FAILED"
  | "INVALID_JSON"
  | "NOT_FOUND"
  | "CONFLICT"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "PAYLOAD_TOO_LARGE"
  | "UNPROCESSABLE"
  | "RATE_LIMITED"
  | "FORBIDDEN"
  | "INTERNAL_ERROR";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ApiErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function errorResponse(
  status: number,
  code: ApiErrorCode,
  message: string,
  details?: unknown,
  headers?: Record<string, string>,
): NextResponse {
  return NextResponse.json(
    { error: { code, message, ...(details !== undefined ? { details } : {}) } },
    { status, headers: { "Cache-Control": "no-store", ...headers } },
  );
}

export function handleApiError(error: unknown, route: string): NextResponse {
  if (error instanceof ApiError) {
    return errorResponse(error.status, error.code, error.message, error.details);
  }
  if (error instanceof ZodError) {
    return errorResponse(400, "VALIDATION_FAILED", "The request contains invalid values.", error.issues.map((i) => ({
      path: i.path.join("."),
      message: i.message,
    })));
  }
  // Log the real error on the server only. The client receives a generic message.
  console.error(`[api] ${route} failed:`, error instanceof Error ? error.name : "unknown error");
  return errorResponse(500, "INTERNAL_ERROR", "Something went wrong. Please try again.");
}

export async function readJson(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", "Send the request body as application/json.");
  }
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > 64 * 1024) {
    throw new ApiError(413, "PAYLOAD_TOO_LARGE", "The request body is too large.");
  }
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, "INVALID_JSON", "The request body is not valid JSON.");
  }
}
