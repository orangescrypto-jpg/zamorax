// app/api/orders/layaway-topup-confirm/route.ts
// Called by the buyer orders page on return from Paystack/Flutterwave for
// a layaway top-up. Reads planId from the request body (client reads it
// out of sessionStorage's pending_layaway_topup_<reference> key) and
// forwards to the same verify + credit logic as layaway-pay.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { planId, reference, provider } = await req.json()
    if (!planId || !reference || !provider) {
      return NextResponse.json({ error: "planId, reference, provider required" }, { status: 400 })
    }

    // Delegate to the shared handler by calling it internally -- avoids
    // duplicating the verify + credit + notify logic in two places.
    const payRes = await fetch(new URL("/api/orders/layaway-pay", req.url), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Forward the caller's auth so requireAuth() on layaway-pay
        // authorizes correctly.
        cookie: req.headers.get("cookie") || "",
        authorization: req.headers.get("authorization") || "",
      },
      body: JSON.stringify({ planId, reference, provider }),
    })
    const json = await payRes.json()
    return NextResponse.json(json, { status: payRes.status })
  } catch (err: any) {
    console.error("layaway-topup-confirm error:", err)
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
  }
}
