// app/api/agent/wallet/route.ts
// Returns the authenticated user's agent (referral) wallet balance.
// Kept server-side/authoritative so the client never reads another
// user's wallet doc directly.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { AdminService } from "@/src/services/admin"
import { requireAuth } from "@/lib/auth-server"

export async function GET(req: NextRequest) {
  let auth
  try {
    auth = await requireAuth(req)
  } catch (err: any) {
    console.error("[GET /api/agent/wallet] auth check failed:", err)
    return NextResponse.json({ error: "Could not verify your session. Please try again." }, { status: 500 })
  }
  if (!auth.ok) return auth.error

  try {
    const wallet = await AdminService.getDoc("agent_wallets", auth.uid) as Record<string, unknown> | null

    return NextResponse.json({
      wallet: {
        balance:     Number(wallet?.balance ?? 0),
        total_earned: Number(wallet?.totalEarned ?? wallet?.total_earned ?? 0),
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Something went wrong" }, { status: 500 })
  }
}
