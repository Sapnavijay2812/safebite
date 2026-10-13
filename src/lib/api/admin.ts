// Demo-admin gate for mutation, moderation and analytics endpoints.
// Open in development. In production it returns 403 unless SAFEBITE_ENABLE_DEMO_ADMIN=true,
// and even then an authentication layer must sit in front of these endpoints.

import { NextResponse } from "next/server";
import { isDemoAdminEnabled } from "@/lib/security/guards";
import { errorResponse } from "./errors";

export function requireDemoAdmin(): NextResponse | null {
  if (isDemoAdminEnabled()) return null;
  return errorResponse(403, "FORBIDDEN", "This endpoint is disabled in this deployment. Enable it only behind an authentication layer.");
}
