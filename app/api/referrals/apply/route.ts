// app/api/referrals/apply/route.ts
// Records "I signed up with referrer X" and pays the signup reward.
//
// ReferralsService.applyReferralCode used to run in the new user's browser and
// wrote referrals + agent_wallets (balance, total_earned) through the D1 proxy,
// which meant any signed-in user could credit any agent wallet with any amount.
// Wallets are read-only in the proxy now; this route is the only writer, and it
// takes the new user's id from the session and their role from the database.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-server"
import { AdminService } from "@/src/services/admin"
import { ReferralsService } from "@/src/services/referrals"

const DAY_MS = 86_400_000

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.ok) return auth.error

  try {
    const { referrerId } = await req.json()
    if (!referrerId || typeof referrerId !== "string") {
      return NextResponse.json({ error: "referrerId required" }, { status: 400 })
    }
    const newUserId = auth.uid
    if (referrerId === newUserId) return NextResponse.json({ success: true, skipped: "self" })

    // Only fresh accounts can claim a signup referral.
    const me = await AdminService.getDoc("users", newUserId) as Record<string, any> | null
    if (!me) return NextResponse.json({ error: "User not found" }, { status: 404 })
    const created = new Date(String(me.createdAt ?? me.created_at ?? "")).getTime()
    if (!Number.isFinite(created) || Date.now() - created > DAY_MS) {
      return NextResponse.json({ success: true, skipped: "account_too_old" })
    }

    const referrer = await AdminService.getDoc("users", referrerId)
    if (!referrer) return NextResponse.json({ success: true, skipped: "unknown_referrer" })

    // One referral per new user, ever.
    const existing = await AdminService.getDoc("referrals", newUserId)
    if (existing) return NextResponse.json({ success: true, skipped: "already_referred" })

    // Role is read from the account, not from the request.
    const referredRole = String(me.role ?? "buyer") === "buyer" ? "buyer" : "seller"
    await ReferralsService.applyReferralCode(newUserId, referrerId, referredRole as "buyer" | "seller")
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("[POST /api/referrals/apply]", err)
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 })
  }
}
