// app/api/platform-settings/route.ts
// Lightweight public endpoint consumed by middleware (Edge-compatible read path).
// Returns only the fields needed for request-level gating.
import { NextResponse } from "next/server"
import { getPlatformSettings } from "@/src/services/platformSettings"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const settings = await getPlatformSettings()
    // Only expose fields the middleware needs — never leak sensitive config
    return NextResponse.json(
      { maintenanceMode: settings.maintenanceMode },
      {
        headers: {
          // Cache at CDN for 30s, allow stale for 60s while revalidating
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        },
      }
    )
  } catch {
    return NextResponse.json({ maintenanceMode: false })
  }
}
