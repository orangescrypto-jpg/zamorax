// app/api/buyback/submit/route.ts
// Creates a buyback_requests row. Works for guests (no login required to
// submit). If the submitter happens to be logged in, seller_id is
// attached, but it is never required.
//
// Security notes:
//  - The offer price is looked up here from buyback_pricing. The price
//    sent by the browser is ignored, so it cannot be tampered with.
//  - Category, brand, model, storage and condition must match an active
//    pricing row, so requests cannot be created for made-up devices.
//  - Photos must be URLs under our own buyback/ R2 prefix.
//  - Every confirmation the admin has configured must be ticked.
//  - Guest submissions are rate limited per IP and per phone number.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-server"
import { d1Query } from "@/lib/d1"
import { getSubSettings } from "@/src/services/subSettings"
import { loadBuybackSettings } from "@/lib/buyback/loadSettings"
import { R2_PUBLIC_URL } from "@/lib/r2/client"
import { rateLimit, rateLimitResponse, getClientIp } from "@/lib/rateLimit"

const VALID_FULFILLMENT = new Set(["dropoff", "meetup"])
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const clip = (v: unknown, max: number) =>
  typeof v === "string" ? v.trim().slice(0, max) : ""

export async function POST(req: NextRequest) {
  const nativeDB = (req as any)?.env?.DB

  try {
    const settings = await getSubSettings()
    if (!settings.buybackEnabled) {
      return NextResponse.json({ error: "Sell for Cash is not available right now." }, { status: 403 })
    }

    // 5 submissions per hour per IP.
    const ip = getClientIp(req)
    const rlIp = await rateLimit(`buyback_submit:${ip}`, { limit: 5, windowSeconds: 3600 }, nativeDB)
    if (!rlIp.allowed) return rateLimitResponse(rlIp)

    const body = await req.json().catch(() => ({}))
    const categorySlug = clip(body?.categorySlug, 60)
    const brand = clip(body?.brand, 120)
    const model = clip(body?.model, 160)
    const storageVariant = clip(body?.storageVariant, 60)
    const condition = clip(body?.condition, 40)
    const knownIssues = clip(body?.knownIssues, 2000)
    const fulfillmentMethod = clip(body?.fulfillmentMethod, 20)
    const warehouseId = clip(body?.warehouseId, 80)
    const meetupAddress = clip(body?.meetupAddress, 500)
    const contactName = clip(body?.contactName, 120)
    const contactEmail = clip(body?.contactEmail, 200).toLowerCase()
    const contactPhone = clip(body?.contactPhone, 30)
    const images: unknown = body?.images
    const declarations: unknown = body?.declarations

    const content = await loadBuybackSettings(nativeDB)

    // ── Basic field checks ────────────────────────────────────────────
    if (!categorySlug || !brand || !model || !condition) {
      return NextResponse.json({ error: "Category, brand, model and condition are required." }, { status: 400 })
    }
    if (content.disabledCategories.includes(categorySlug)) {
      return NextResponse.json({ error: "Select a valid category." }, { status: 400 })
    }
    if (!contactName) {
      return NextResponse.json({ error: "Enter your name." }, { status: 400 })
    }
    if (!EMAIL_RE.test(contactEmail)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 })
    }
    if (contactPhone.replace(/\D/g, "").length < 10) {
      return NextResponse.json({ error: "Enter a valid phone number." }, { status: 400 })
    }
    if (!VALID_FULFILLMENT.has(fulfillmentMethod)) {
      return NextResponse.json({ error: "Choose drop-off or meetup." }, { status: 400 })
    }
    if (fulfillmentMethod === "dropoff" && !warehouseId) {
      return NextResponse.json({ error: "Select a warehouse to drop off at." }, { status: 400 })
    }
    if (fulfillmentMethod === "meetup" && !meetupAddress) {
      return NextResponse.json({ error: "Enter where you would like to meet." }, { status: 400 })
    }

    // 3 submissions per day per phone number, so changing IP does not
    // bypass the limit.
    const phoneKey = contactPhone.replace(/\D/g, "").slice(-10)
    const rlPhone = await rateLimit(`buyback_submit_phone:${phoneKey}`, { limit: 3, windowSeconds: 86400 }, nativeDB)
    if (!rlPhone.allowed) return rateLimitResponse(rlPhone)

    // ── Photos ────────────────────────────────────────────────────────
    if (!Array.isArray(images)) {
      return NextResponse.json({ error: "Upload at least one photo of the device." }, { status: 400 })
    }
    const base = (R2_PUBLIC_URL() || "").replace(/\/$/, "")
    const cleanImages = Array.from(
      new Set(images.filter((u): u is string => typeof u === "string" && u.length < 500)),
    )
    const badImage = cleanImages.some(u => !base || !u.startsWith(`${base}/buyback/`))
    if (badImage) {
      return NextResponse.json({ error: "One of the photos is not valid. Please upload it again." }, { status: 400 })
    }
    if (cleanImages.length < content.minPhotos) {
      return NextResponse.json(
        { error: `Upload at least ${content.minPhotos} photo${content.minPhotos > 1 ? "s" : ""} of the device.` },
        { status: 400 },
      )
    }
    if (cleanImages.length > content.maxPhotos) {
      return NextResponse.json({ error: `You can upload up to ${content.maxPhotos} photos.` }, { status: 400 })
    }

    // ── Declarations: every configured confirmation must be ticked ────
    const declared = (declarations && typeof declarations === "object" ? declarations : {}) as Record<string, unknown>
    const missing = content.confirmations.filter(c => declared[c.key] !== true)
    if (missing.length > 0) {
      return NextResponse.json({ error: "Please tick all the confirmations to continue." }, { status: 400 })
    }
    const storedDeclarations: Record<string, boolean> = {}
    for (const c of content.confirmations) storedDeclarations[c.key] = true

    // ── Real price from the pricing table, never from the browser ─────
    const priceRows = await d1Query(
      `SELECT price FROM buyback_pricing
        WHERE is_active = 1 AND category_slug = ? AND brand = ? AND model = ?
          AND condition = ?
          AND (storage_variant = ? OR ((storage_variant IS NULL OR storage_variant = '') AND ? = ''))
        LIMIT 1`,
      [categorySlug, brand, model, condition, storageVariant, storageVariant],
      nativeDB,
    )
    const realPrice = (priceRows?.results?.[0] as { price?: number } | undefined)?.price
    if (realPrice == null) {
      return NextResponse.json(
        { error: "We could not find a price for this device. Please start again." },
        { status: 400 },
      )
    }

    // Attach seller_id only if a valid session is present. Never required.
    let sellerId: string | null = null
    try {
      const auth = await requireAuth(req, nativeDB)
      if (auth.ok) sellerId = auth.uid
    } catch { /* guest, fine */ }

    const id = crypto.randomUUID()
    await d1Query(
      `INSERT INTO buyback_requests (
        id, category_slug, brand, model, storage_variant, condition,
        estimated_price, images, known_issues,
        fulfillment_method, warehouse_id, meetup_address,
        contact_name, contact_email, contact_phone,
        seller_id, declarations, declared_at, ownership_verified,
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 0, 'submitted', datetime('now'), datetime('now'))`,
      [
        id, categorySlug, brand, model, storageVariant || null, condition,
        realPrice, JSON.stringify(cleanImages), knownIssues || null,
        fulfillmentMethod, warehouseId || null, meetupAddress || null,
        contactName, contactEmail, contactPhone,
        sellerId, JSON.stringify(storedDeclarations),
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
