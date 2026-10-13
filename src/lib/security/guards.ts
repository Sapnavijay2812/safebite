// Request-level safeguards: demo-admin gating, client keys for rate limiting, and
// storage-key validation that prevents path traversal.

import { createHash } from "node:crypto";
import path from "node:path";

// Mutating and admin endpoints are open only in development, or when explicitly
// enabled for a demo. Production needs an authentication layer in front of them.
export function isDemoAdminEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.NODE_ENV !== "production") return true;
  return env.SAFEBITE_ENABLE_DEMO_ADMIN === "true";
}

export function clientKey(request: Request, env: NodeJS.ProcessEnv = process.env): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const raw = forwarded || request.headers.get("x-real-ip") || "local";
  const salt = env.SAFEBITE_HASH_SALT ?? "safebite-demo-salt";
  return createHash("sha256").update(`${salt}:${raw}`).digest("hex").slice(0, 32);
}

export function hashSubmitter(request: Request, env: NodeJS.ProcessEnv = process.env): string {
  return clientKey(request, env);
}

const STORAGE_KEY_PATTERN = /^(samples|uploads)\/[A-Za-z0-9][A-Za-z0-9._-]{0,120}\.(pdf|png|jpg)$/;

export function isSafeStorageKey(key: string): boolean {
  return STORAGE_KEY_PATTERN.test(key) && !key.includes("..") && !path.isAbsolute(key);
}
