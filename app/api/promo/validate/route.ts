// app/api/promo/validate/route.ts
// WAS FIREBASE ADMIN → NOW CLOUDFLARE D1 via AdminService
import { NextRequest, NextResponse } from "next/server"
import { AdminService } from "@/src/services/admin"

export async function POST(req: NextRequest) {
  try {
    const { code, userId, amount } = await req.json()
    if (!code || !userId) return NextResponse.json({ error: "Missing fields" }, { status: 400 })

    const all = await AdminService.getCollection("promo_codes") as Record<string, unknown>[]
    const promo = all.find(r => String(r.code ?? "").toUpperCase() === code.toUpperCase())
    if (!promo) return NextResponse.json({ error: "Invalid promo code" }, { status: 404 })
    if (!promo.is_active && !promo.isActive) return NextResponse.json({ error: "Code no longer active" }, { status: 400 })
    if (promo.expires_at && new Date(String(promo.expires_at)) < new Date()) return NextResponse.json({ error: "Code expired" }, { status: 400 })
    const usageLimit = Number(promo.usage_limit ?? promo.usageLimit ?? 0)
    const usedCount  = Number(promo.used_count  ?? promo.usedCount  ?? 0)
    if (usageLimit && usedCount >= usageLimit) return NextResponse.json({ error: "Usage limit reached" }, { status: 400 })
    const minOrder = Number(promo.min_order_amount ?? promo.minOrderAmount ?? 0)
    if (minOrder && amount < minOrder) return NextResponse.json({ error: `Min order ₦${(minOrder/100).toLocaleString()} required` }, { status: 400 })
    const usedBy = (() => { try { return JSON.parse(String(promo.used_by ?? "[]")) } catch { return [] } })()
    if (usedBy.includes(userId)) return NextResponse.json({ error: "Already used this code" }, { status: 400 })

    const value    = Number(promo.value ?? 0)
    const type     = String(promo.type ?? "percent")
    const discount = type === "percent" ? Math.floor(amount * (value / 100)) : value
    return NextResponse.json({ valid: true, promoId: String(promo.id), code: promo.code, discount, type, value, description: promo.description || `${value}${type === "percent" ? "%" : "₦"} off` })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
