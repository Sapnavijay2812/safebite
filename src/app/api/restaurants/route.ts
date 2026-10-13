import { NextResponse } from "next/server";
import { restaurantListQuerySchema } from "@/lib/api/schemas";
import { handleApiError } from "@/lib/api/errors";
import { discoverRestaurants } from "@/lib/discovery/discovery";
import { loadRestaurantProfiles, toDiscoveryRecord } from "@/lib/data/repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const params = restaurantListQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const profiles = await loadRestaurantProfiles();
    const result = discoverRestaurants(profiles.map(toDiscoveryRecord), { ...params, asOfMs: Date.now() });
    return NextResponse.json({
      items: result.items,
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: result.totalPages,
      facets: result.facets,
      demoData: true,
    });
  } catch (error) {
    return handleApiError(error, "GET /api/restaurants");
  }
}
