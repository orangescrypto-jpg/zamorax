// app/api/admin/orders/route.ts
// Lists ALL orders regardless of status, for the admin Orders page. Unlike
// /admin/payments (which only shows pending_payments rows awaiting manual
// confirmation), this covers escrow_held/shipped/delivered/completed/
// refunded/cancelled orders too — anything an admin might need to force-
// delete or reverse a payment on, no matter what stage it's at.
//
// NOTE on auth: this mirrors every other admin data-read in the codebase
// (AdminService.getCollection hits D1 directly with no requireAdmin check)
// — access control for admin pages is enforced by <RoleGuard
// allowedRoles={["admin"]}> wrapping the whole (admin) route group
// client-side, not per-request here. requireAdmin/requireModerator IS
// still enforced on the routes that actually mutate data (reverse-payment,
// cancel-admin) — this route only reads.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { d1Query } from "@/lib/d1"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const limit = Math.min(Number(searchParams.get("limit") ?? 100), 200)

    const result = await d1Query(
      `SELECT * FROM orders ORDER BY created_at DESC LIMIT ?`,
      [limit],
    )
    const rows = (result?.results ?? []) as Record<string, unknown>[]

    const orders = rows.map((r) => ({
      id:               String(r.id ?? ""),
      buyerId:          String(r.buyer_id ?? ""),
      buyerName:        String(r.buyer_name ?? ""),
      sellerId:         String(r.seller_id ?? ""),
      sellerName:       String(r.seller_name ?? ""),
      itemTitle:        String(r.item_title ?? "Order"),
      totalAmount:      Number(r.total_amount ?? 0),
      sellerPayout:     Number(r.seller_payout ?? 0),
      status:           String(r.status ?? ""),
      escrowStatus:     String(r.escrow_status ?? ""),
      paymentProvider:  String(r.payment_provider ?? ""),
      paymentReference: String(r.payment_reference ?? ""),
      orderType:        String(r.order_type ?? ""),
      createdAt:        r.created_at ?? null,
    }))

    return NextResponse.json({ orders })
  } catch (err: any) {
    console.error("[GET /api/admin/orders]", err)
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 })
  }
}
