// app/api/payment/confirm/route.ts
// ─────────────────────────────────────────────────────────────────
// Admin-only endpoint to confirm a manual payment was received.
// Called from /admin/payments page when admin marks a payment as paid.
// Updates: pendingPayments doc + order/boost/subscription accordingly.
// ─────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic"

import { getAdminDb } from "@/lib/firebase/admin"
import { FieldValue } from "firebase-admin/firestore"

import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { reference, adminId, purpose, orderId, boostId, subscriptionId } = await req.json()

    if (!reference || !adminId || !purpose) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const db = getAdminDb()

    // Find pending payment by reference
    const snap = await db.collection("pendingPayments")
      .where("reference", "==", reference)
      .limit(1)
      .get()

    if (snap.docs.length === 0) {
      return NextResponse.json(
        { error: `No pending payment found for reference: ${reference}` },
        { status: 404 }
      )
    }

    const paymentDoc = snap.docs[0]
    const payment = paymentDoc.data()

    if (payment.adminConfirmed) {
      return NextResponse.json(
        { error: "Payment already confirmed" },
        { status: 409 }
      )
    }

    // Mark payment as confirmed
    await paymentDoc.ref.update({
      adminConfirmed: true,
      adminId,
      confirmedAt:   FieldValue.serverTimestamp(),
      status:        "confirmed",
      updatedAt:     FieldValue.serverTimestamp(),
    })

    // ── Update the relevant document ─────────────────────────────
    if (purpose === "order" && orderId) {
      await db.collection("orders").doc(orderId).update({
        status:           "escrow_held",
        escrowStatus:     "held",
        escrowHeldAt:     FieldValue.serverTimestamp(),
        paymentReference: reference,
        paymentProvider:  "manual",
        updatedAt:        FieldValue.serverTimestamp(),
      })

      // Notify buyer
      await db.collection("notifications").add({
        userId: payment.userId,
        type:   "system",
        title:  "✅ Payment Confirmed!",
        body:   "Admin has confirmed your payment. Escrow is now active — the seller will be notified to ship.",
        link:   `/dashboard/buyer/orders/${orderId}`,
        read:   false,
        createdAt: FieldValue.serverTimestamp(),
      })

      // Notify seller
      if (payment.metadata?.sellerId) {
        await db.collection("notifications").add({
          userId: payment.metadata.sellerId,
          type:   "system",
          title:  "💰 Order Payment Confirmed",
          body:   "A buyer's payment has been confirmed. Escrow is active — please proceed to ship the item.",
          link:   `/dashboard/seller/orders/${orderId}`,
          read:   false,
          createdAt: FieldValue.serverTimestamp(),
        })
      }
    }

    if (purpose === "boost" && boostId) {
      await db.collection("boosts").doc(boostId).update({
        status:           "active",
        paymentReference: reference,
        paymentProvider:  "manual",
        activatedAt:      FieldValue.serverTimestamp(),
        updatedAt:        FieldValue.serverTimestamp(),
      })

      await db.collection("notifications").add({
        userId: payment.userId,
        type:   "system",
        title:  "⚡ Boost Activated!",
        body:   "Your listing boost has been activated after payment confirmation.",
        read:   false,
        createdAt: FieldValue.serverTimestamp(),
      })
    }

    if (purpose === "subscription" && subscriptionId) {
      const plan = payment.metadata?.plan as string

      await db.collection("subscriptions").doc(subscriptionId).update({
        status:           "active",
        paymentReference: reference,
        paymentProvider:  "manual",
        activatedAt:      FieldValue.serverTimestamp(),
        updatedAt:        FieldValue.serverTimestamp(),
      })

      // Update user plan + expiry (30 days)
      const planExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      await db.collection("users").doc(payment.userId).update({
        plan,
        planExpiresAt,
        updatedAt: FieldValue.serverTimestamp(),
      })

      await db.collection("notifications").add({
        userId: payment.userId,
        type:   "system",
        title:  "🎉 Subscription Activated!",
        body:   `Your ${plan} plan is now active. Enjoy all your benefits!`,
        link:   "/dashboard/seller",
        read:   false,
        createdAt: FieldValue.serverTimestamp(),
      })
    }

    return NextResponse.json({
      success: true,
      message: `Payment confirmed and ${purpose} updated successfully`,
    })

  } catch (err: any) {
    console.error("Admin confirm payment error:", err)
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
  }
}
