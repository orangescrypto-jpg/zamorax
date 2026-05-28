import { NextRequest, NextResponse } from "next/server"
import { initializeApp, cert, getApps, getApp } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"

function getDb() {
  const app = !getApps().length ? initializeApp({ credential: cert({
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  }) }) : getApp()
  return getFirestore(app)
}

export async function POST(req: NextRequest) {
  try {
    const { code, userId, amount } = await req.json()
    if (!code || !userId) return NextResponse.json({ error: "Missing fields" }, { status: 400 })
    const db = getDb()
    const snap = await db.collection("promoCodes").where("code", "==", code.toUpperCase()).limit(1).get()
    if (snap.empty) return NextResponse.json({ error: "Invalid promo code" }, { status: 404 })
    const promo = snap.docs[0].data()
    if (!promo.isActive) return NextResponse.json({ error: "Code no longer active" }, { status: 400 })
    if (promo.expiresAt && promo.expiresAt.toDate() < new Date()) return NextResponse.json({ error: "Code expired" }, { status: 400 })
    if (promo.usageLimit && promo.usedCount >= promo.usageLimit) return NextResponse.json({ error: "Usage limit reached" }, { status: 400 })
    if (promo.minOrderAmount && amount < promo.minOrderAmount) return NextResponse.json({ error: `Min order ₦${(promo.minOrderAmount/100).toLocaleString()} required` }, { status: 400 })
    if (promo.usedBy?.includes(userId)) return NextResponse.json({ error: "Already used this code" }, { status: 400 })
    const discount = promo.type === "percent" ? Math.floor(amount * (promo.value / 100)) : promo.value
    return NextResponse.json({ valid: true, promoId: snap.docs[0].id, code: promo.code, discount, type: promo.type, value: promo.value, description: promo.description || `${promo.value}${promo.type === "percent" ? "%" : "₦"} off` })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
