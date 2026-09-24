// app/api/buyback/submit/route.ts
// Creates a buyback_requests row. Works for guests (no login required to
// submit — Path A/B decision already happened client-side before this is
// called). If the submitter happens to be logged in, seller_id is
// attached, but it is never required.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-server"
import { d1Query } from "@/lib/d1"
import { getSubSettings } from "@/src/services/subSettings"

const VALID_CATEGORIES = new Set(["phones-tablets", "computing", "electronics"])
const VALID_FULFILLMENT = new Set(["dropoff", "meetup"])

export async function POST(req: NextRequest) {
  const nativeDB = (req as any)?.env?.DB

  try {
    const settings = await getSubSettings()
    if (!settings.buybackEnabled) {
      return NextResponse.json({ error: "Sell for Cash is not available right now." }, { status: 403 })
    }

    const body = await req.json()
    const {
      categorySlug, brand, model, storageVariant, condition,
      estimatedPrice, images, knownIssues,
      fulfillmentMethod, warehouseId, meetupAddress,
      contactName, contactEmail, contactPhone,
    } = body ?? {}

    if (!categorySlug || !VALID_CATEGORIES.has(categorySlug)) {
      return NextResponse.json({ error: "Select a valid category." }, { status: 400 })
    }
    if (!brand || !model || !condition) {
      return NextResponse.json({ error: "Brand, model and condition are required." }, { status: 400 })
    }
    if (!Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: "Upload at least one photo of the device." }, { status: 400 })
    }
    if (!contactEmail || !contactPhone) {
      return NextResponse.json({ error: "Contact email and phone are required." }, { status: 400 })
    }
    if (!fulfillmentMethod || !VALID_FULFILLMENT.has(fulfillmentMethod)) {
      return NextResponse.json({ error: "Choose drop-off or meetup." }, { status: 400 })
    }
    if (fulfillmentMethod === "dropoff" && !warehouseId) {
      return NextResponse.json({ error: "Select a warehouse to drop off at." }, { status: 400 })
    }
    if (fulfillmentMethod === "meetup" && !meetupAddress) {
      return NextResponse.json({ error: "Enter where you would like to meet." }, { status: 400 })
    }

    // Attach seller_id only if a valid session is present — never required.
    let sellerId: string | null = null
    try {
      const auth = await requireAuth(req, nativeDB)
      if (auth.ok) sellerId = auth.uid
    } catch { /* guest — fine */ }

    const id = crypto.randomUUID()
    await d1Query(
      `INSERT INTO buyback_requests (
        id, category_slug, brand, model, storage_variant, condition,
        estimated_price, images, known_issues,
        fulfillment_method, warehouse_id, meetup_address,
        contact_name, contact_email, contact_phone,
        seller_id, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', datetime('now'), datetime('now'))`,
      [
        id, categorySlug, brand, model, storageVariant || null, condition,
        estimatedPrice ?? null, JSON.stringify(images), knownIssues || null,
        fulfillmentMethod, warehouseId || null, meetupAddress || null,
        contactName || null, contactEmail, contactPhone,
        sellerId,
      ],
      nativeDB,
    )

    return NextResponse.json({ id, status: "submitted" })
  } catch (err) {
    console.error("[api/buyback/submit] failed:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Something went wrong." },
      { status: 500 },
    )
  }
}
