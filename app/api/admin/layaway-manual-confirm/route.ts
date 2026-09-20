// app/api/admin/layaway-manual-confirm/route.ts
// Admin-only. Confirms a manual bank transfer deposit was actually
// received for a layaway plan created via create-layaway-manual. This is
// the manual-payment equivalent of the instant Paystack/Flutterwave
// verify -- an admin has seen proof of payment and clicks confirm here.
// Activates the plan (starts its deadline from this moment, not from
// when the buyer first requested it) and moves the order out of
// "layaway_pending_confirmation" into the normal "layaway_active" state.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-server"
import { d1Query } from "@/lib/d1"
import { getPlatformSettings } from "@/src/services/platformSettings"

type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.error

  const nativeDB = (context as any)?.env?.DB

  try {
    const { planId, depositAmountReceivedKobo } = await req.json()
    if (!planId || !depositAmountReceivedKobo) {
      return NextResponse.json({ error: "planId and depositAmountReceivedKobo required" }, { status: 400 })
    }

    const planRows = await d1Query("SELECT * FROM layaway_plans WHERE id = ? LIMIT 1", [planId], nativeDB)
    const plan = planRows?.results?.[0] as Record<string, unknown> | undefined
    if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 })
    if (plan.status !== "pending_admin_confirmation") {
      return NextResponse.json({ error: `Plan is already ${plan.status}` }, { status: 409 })
    }

    const listingRows = await d1Query(
      "SELECT layaway_max_days FROM listings WHERE id = ? LIMIT 1",
      [String(plan.listing_id)],
      nativeDB,
    )
    const listingMaxDays = Number((listingRows?.results?.[0] as any)?.layaway_max_days) || null
    const platformSettings = await getPlatformSettings()
    const maxDays = Math.min(listingMaxDays || platformSettings.layawayMaxDays, platformSettings.layawayMaxDays)

    const now = new Date()
    const nowIso = now.toISOString()
    const expiresAt = new Date(now.getTime() + maxDays * 24 * 60 * 60 * 1000).toISOString()

    await d1Query(
      `UPDATE layaway_plans SET
        status = 'active', amount_paid = ?, price_locked_at = ?, expires_at = ?, updated_at = ?
      WHERE id = ?`,
      [Number(depositAmountReceivedKobo), nowIso, expiresAt, nowIso, planId],
      nativeDB,
    )

    await d1Query(
      `UPDATE layaway_payments SET
        amount = ?, status = 'success', paid_at = ?
      WHERE plan_id = ? AND status = 'pending_admin_review'`,
      [Number(depositAmountReceivedKobo), nowIso, planId],
      nativeDB,
    )

    await d1Query(
      "UPDATE orders SET status = 'layaway_active', updated_at = ? WHERE id = ?",
      [nowIso, String(plan.order_id)],
      nativeDB,
    )

    try {
      const { sendPushNotification } = await import("@/src/services/webPush")
      await sendPushNotification({
        userId: String(plan.buyer_id),
        type: "layaway_reminder",
        title: "Deposit confirmed",
        body: `Your manual bank transfer deposit has been confirmed. You have until ${new Date(expiresAt).toLocaleDateString()} to complete this layaway plan.`,
        link: `/dashboard/buyer/orders/${plan.order_id}`,
        nativeDB,
      })
      await sendPushNotification({
        userId: String(plan.seller_id),
        type: "account_activity",
        title: "New layaway plan started",
        body: "A buyer's manual deposit was confirmed and their layaway plan is now active.",
        link: `/dashboard/seller/orders/${plan.order_id}`,
        nativeDB,
      })
    } catch (err) {
      console.error("layaway-manual-confirm: notification failed (non-fatal):", err)
    }

    return NextResponse.json({ success: true, expiresAt })
  } catch (err: any) {
    console.error("layaway-manual-confirm error:", err)
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
  }
}
