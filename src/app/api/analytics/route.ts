import { NextResponse } from "next/server";
import { requireDemoAdmin } from "@/lib/api/admin";
import { handleApiError } from "@/lib/api/errors";
import { buildAnalytics } from "@/lib/data/analytics";
import { loadRestaurantProfiles } from "@/lib/data/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = requireDemoAdmin();
  if (denied) return denied;
  try {
    const asOfMs = Date.now();
    const profiles = await loadRestaurantProfiles(asOfMs);
    const snapshot = await buildAnalytics(profiles, asOfMs);
    return NextResponse.json({ ...snapshot, demoData: true });
  } catch (error) {
    return handleApiError(error, "GET /api/analytics");
  }
}
