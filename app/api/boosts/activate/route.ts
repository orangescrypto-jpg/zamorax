// app/api/boosts/activate/route.ts
// Called from the seller's boost/ad-boost success redirect for Paystack- or
// Flutterwave-paid checkouts. Verifies the transaction directly with
// whichever gateway processed it (never trusts the client-supplied "it
// succeeded"), then activates the boost/adBoost the same way
// /api/payment/confirm does for admin-confirmed manual payments.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-server"
import { AdminService } from "@/src/services/admin"
import { getPlatformSettings } from "@/src/services/platformSettings"

async function verifyPaystack(reference: string) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY
  if (!secretKey) throw new Error("PAYSTACK_SECRET_KEY not configured")
  const res = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  })
  const data = await res.json()
  if (!data.status) throw new Error(data.message || "Paystack verification failed")
  return { verified: data.data.status === "success", amount: Number(data.data.amount ?? 0) as number }
}

async function verifyFlutterwave(reference: string, transactionId?: string) {
  const secretKey = process.env.FLW_SECRET_KEY
  if (!secretKey) throw new Error("FLW_SECRET_KEY not configured")

  // Verify-by-id is the reliable path Flutterwave recommends (verify_by_reference
  // can occasionally return stale/duplicate matches for a given tx_ref).
  const url = transactionId
    ? `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(transactionId)}/verify`
    : `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`

  const res = await fetch(url, { headers: { Authorization: `Bearer ${secretKey}` } })
  const data = await res.json()
  if (data.status !== "success") throw new Error(data.message || "Flutterwave verification failed")

  // Sanity-check the tx_ref on the verified transaction matches what we expect,
  // so a valid-but-unrelated transaction_id can't be used to activate a boost.
  if (data.data?.tx_ref && reference && data.data.tx_ref !== reference) {
    throw new Error("Transaction reference mismatch")
  }

  return { verified: data.data?.status === "successful", amount: Math.round(Number(data.data?.amount ?? 0) * 100) as number }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.ok) return auth.error

  try {
    const { boostId, adBoostId, reference, provider, transactionId } = await req.json()
    if (!reference || (!boostId && !adBoostId)) {
      return NextResponse.json({ error: "reference and boostId or adBoostId required" }, { status: 400 })
    }

    const gatewayProvider = provider === "flutterwave" ? "flutterwave" : "paystack"
    const { verified, amount: paidKobo } = gatewayProvider === "flutterwave"
      ? await verifyFlutterwave(reference, transactionId)
      : await verifyPaystack(reference)
    if (!verified) {
      return NextResponse.json({ error: "Payment not verified yet" }, { status: 409 })
    }

    const settings = await getPlatformSettings() as any

    const now = new Date().toISOString()

    if (adBoostId) {
      const adBoost = await AdminService.getDoc("adBoosts", adBoostId) as Record<string, unknown> | null
      if (!adBoost) return NextResponse.json({ error: "Ad Boost not found" }, { status: 404 })
      if (String((adBoost as any).sellerId ?? "") !== auth.uid) {
        return NextResponse.json({ error: "Not authorised" }, { status: 403 })
      }
      if (String((adBoost as any).status ?? "") === "active") {
        return NextResponse.json({ success: true, alreadyActive: true })
      }

      // The row's own `amount`/`amount_paid` is client-set at creation time
      // (adBoosts is not one of the server-priced tables), so the price
      // check is against the admin-configured plan price instead —
      // resolved the same way AdBoostService.create() derives it, by
      // planType.
      const expectedAdKobo = String((adBoost as any).planType ?? "") === "combined"
        ? Number(settings.adBoostPriceCombined)
        : Number(settings.adBoostPriceStandard)
      if (expectedAdKobo > 0 && paidKobo + 1 < expectedAdKobo) {
        console.error("[boosts/activate] paid amount below ad boost plan price", { adBoostId, reference, paidKobo, expectedAdKobo })
        return NextResponse.json(
          { error: "Amount paid does not cover this ad boost plan. Contact support with your payment reference." },
          { status: 402 },
        )
      }

      await AdminService.updateDoc("adBoosts", adBoostId, {
        status: "active", payment_reference: reference, payment_provider: gatewayProvider,
        activated_at: now,
      })
      const productId = (adBoost as any).productId
      if (productId) await AdminService.updateDoc("listings", String(productId), { ad_boost_status: "active" })
      await AdminService.addDoc("notifications", {
        user_id: auth.uid, type: "system", title: "📣 Ad Boost Activated!",
        body: `Your ad campaign for "${(adBoost as any).productTitle ?? "your product"}" is now active.`,
        link: "/dashboard/seller/boost", is_read: false,
      })
      return NextResponse.json({ success: true, kind: "adBoost" })
    }

    const boost = await AdminService.getDoc("boosts", boostId) as Record<string, unknown> | null
    if (!boost) return NextResponse.json({ error: "Boost not found" }, { status: 404 })
    if (String((boost as any).sellerId ?? "") !== auth.uid) {
      return NextResponse.json({ error: "Not authorised" }, { status: 403 })
    }
    if (String((boost as any).status ?? "") === "active") {
      return NextResponse.json({ success: true, alreadyActive: true })
    }
    const durationMatch = String((boost as any).duration ?? "7 days").match(/(\d+)\s*day/i)
    const durationDays  = durationMatch ? parseInt(durationMatch[1], 10) : 7
    const boostEndsAt   = new Date(Date.now() + durationDays * 86400000).toISOString()

    // Same idea as the ad-boost branch: `boosts` has no server-priced
    // `amount` column, so match the plan by its label (the same "Title ·
    // N days" string the boost page writes) and check against the
    // admin-configured price for that plan.
    const durationLabel = String((boost as any).duration ?? "")
    const expectedKobo =
      durationLabel.startsWith("Category Top") ? Number(settings.boostCategoryTop) :
      durationLabel.startsWith("Premium")      ? Number(settings.boostPremium) :
      durationLabel.startsWith("Standard")     ? Number(settings.boostStandard) :
      null
    if (expectedKobo && expectedKobo > 0 && paidKobo + 1 < expectedKobo) {
      console.error("[boosts/activate] paid amount below boost plan price", { boostId, reference, paidKobo, expectedKobo, durationLabel })
      return NextResponse.json(
        { error: "Amount paid does not cover this boost plan. Contact support with your payment reference." },
        { status: 402 },
      )
    }

    await AdminService.updateDoc("boosts", boostId, {
      status: "active", payment_reference: reference, payment_provider: gatewayProvider,
      activated_at: now, boost_ends_at: boostEndsAt,
    })
    const listingId = (boost as any).listingId
    if (listingId) await AdminService.updateDoc("listings", String(listingId), {
      is_boosted: true, boost_expires_at: boostEndsAt,
    })
    await AdminService.addDoc("notifications", {
      user_id: auth.uid, type: "system", title: "⚡ Boost Activated!",
      body: `Your listing boost is active for ${durationDays} days.`,
      link: "/dashboard/seller/boost", is_read: false,
    })
    return NextResponse.json({ success: true, kind: "boost" })
  } catch (err: any) {
    console.error("[POST /api/boosts/activate]", err)
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 })
  }
}
