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

async function verifyPaystack(reference: string) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY
  if (!secretKey) throw new Error("PAYSTACK_SECRET_KEY not configured")
  const res = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  })
  const data = await res.json()
  if (!data.status) throw new Error(data.message || "Paystack verification failed")
  return { verified: data.data.status === "success" }
}

async function verifyFlutterwave(reference: string) {
  const secretKey = process.env.FLW_SECRET_KEY
  if (!secretKey) throw new Error("FLW_SECRET_KEY not configured")
  const res = await fetch(
    `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${secretKey}` } },
  )
  const data = await res.json()
  if (data.status !== "success") throw new Error(data.message || "Flutterwave verification failed")
  return { verified: data.data?.status === "successful" }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.ok) return auth.error

  try {
    const { boostId, adBoostId, reference, provider } = await req.json()
    if (!reference || (!boostId && !adBoostId)) {
      return NextResponse.json({ error: "reference and boostId or adBoostId required" }, { status: 400 })
    }

    const gatewayProvider = provider === "flutterwave" ? "flutterwave" : "paystack"
    const { verified } = gatewayProvider === "flutterwave"
      ? await verifyFlutterwave(reference)
      : await verifyPaystack(reference)
    if (!verified) {
      return NextResponse.json({ error: "Payment not verified yet" }, { status: 409 })
    }

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
