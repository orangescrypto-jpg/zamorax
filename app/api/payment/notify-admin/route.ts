// app/api/payment/notify-admin/route.ts
// WAS FIREBASE ADMIN → NOW CLOUDFLARE D1 via AdminService
export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { AdminService } from "@/src/services/admin"

export async function POST(req: NextRequest) {
  try {
    const { reference, proofUrl, userId, purpose, amount } = await req.json()
    if (!reference || !userId || !purpose)
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })

    const all = await AdminService.getCollection("pending_payments") as Record<string, unknown>[]
    const payment = all.find(r => String(r.reference) === reference)
    if (!payment)
      return NextResponse.json({ error: `No pending payment found for reference: ${reference}` }, { status: 404 })

    await AdminService.updateDoc("pending_payments", String(payment.id), {
      ...(proofUrl ? { proof_url: proofUrl } : {}),
      buyer_submitted_at: new Date().toISOString(),
      status: "awaiting_confirmation",
    })

    // Notify all admin users
    const users = await AdminService.getCollection("users") as Record<string, unknown>[]
    const admins = users.filter(u => u.role === "admin")
    const amountNaira = amount ? `₦${(amount / 100).toLocaleString("en-NG")}` : ""
    const purposeLabel = purpose === "order" ? "Order Escrow" : purpose === "subscription" ? "Subscription" : "Listing Boost"

    for (const admin of admins) {
      await AdminService.addDoc("notifications", {
        user_id: admin.uid ?? admin.id,
        type:    "system",
        title:   "💳 New Manual Payment Submitted",
        body:    `A buyer submitted a ${purposeLabel} payment${amountNaira ? ` of ${amountNaira}` : ""}. Reference: ${reference}. Please verify and confirm.`,
        link:    "/admin/payments",
        is_read: false,
      })
    }

    return NextResponse.json({ success: true, adminsNotified: admins.length, message: "Proof attached and admins notified." })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
