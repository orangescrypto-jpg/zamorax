// app/api/checkout/validate/route.ts
// Server-side checkout guardrail — called by BuyNowModal and
// CartCheckoutModal right before payment is initiated (online redirect or
// manual bank transfer draft). Until this route existed, a seller's
// minOrderQty (set on the listing) was only ever clamped in the browser —
// the cart store's stepper and the listing page's quantity control — with
// nothing stopping a direct API call from placing an order below it. This
// route re-checks each line item's quantity against the listing's real
// minOrderQty (and, while already fetching the listing, its stock too) so
// the floor holds even if the client-side clamp is bypassed.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { AdminService } from "@/src/services/admin"

interface LineItemInput {
  listingId: string
  qty: number
}

export async function POST(req: NextRequest) {
  try {
    const { lineItems } = await req.json() as { lineItems: LineItemInput[] }
    if (!Array.isArray(lineItems) || lineItems.length === 0) {
      return NextResponse.json({ error: "Missing line items" }, { status: 400 })
    }

    const errors: string[] = []

    for (const item of lineItems) {
      if (!item?.listingId || !item?.qty) continue
      const listing = await AdminService.getDoc("listings", item.listingId) as Record<string, unknown> | null
      if (!listing) {
        errors.push(`Listing ${item.listingId} is no longer available.`)
        continue
      }

      const minOrderQty = Number((listing as any).minOrderQty ?? (listing as any).min_order_qty ?? 0)
      if (minOrderQty > 1 && item.qty < minOrderQty) {
        const title = String((listing as any).title ?? "This item")
        errors.push(`${title} has a minimum order of ${minOrderQty} — you have ${item.qty}.`)
      }

      const stockQty = (listing as any).stockQty ?? (listing as any).stock_qty
      if (stockQty != null && Number(stockQty) < item.qty) {
        const title = String((listing as any).title ?? "This item")
        errors.push(`${title} only has ${stockQty} left in stock.`)
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({ ok: false, errors }, { status: 409 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[checkout/validate] failed:", err)
    return NextResponse.json({ error: "Validation failed, please try again" }, { status: 500 })
  }
}
