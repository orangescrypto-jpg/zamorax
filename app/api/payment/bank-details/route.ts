// app/api/payment/bank-details/route.ts
// ─────────────────────────────────────────────────────────────────
// Admin endpoint to get and save platform bank details.
// Stored in Firestore: settings/bankDetails
// Admin sets this in /admin/settings — no code change ever needed.
// ─────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { initializeApp, cert, getApps, getApp } from "firebase-admin/app"
import { getFirestore, FieldValue } from "firebase-admin/firestore"

function getDb() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey:  process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        projectId:   process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      }),
    })
  }
  return getFirestore(getApp())
}

// ── GET — fetch current bank details ─────────────────────────────
export async function GET() {
  try {
    const db = getDb()
    const snap = await db.collection("settings").doc("bankDetails").get()
    if (!snap.exists) {
      return NextResponse.json({ bankDetails: null })
    }
    return NextResponse.json({ bankDetails: snap.data() })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ── POST — save bank details (admin only) ─────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { bankName, accountNumber, accountName, bankCode } = await req.json()

    if (!bankName || !accountNumber || !accountName) {
      return NextResponse.json(
        { error: "bankName, accountNumber, and accountName are required" },
        { status: 400 }
      )
    }

    const db = getDb()
    await db.collection("settings").doc("bankDetails").set({
      bankName:      bankName.trim(),
      accountNumber: accountNumber.trim(),
      accountName:   accountName.trim(),
      bankCode:      bankCode?.trim() ?? "",
      updatedAt:     FieldValue.serverTimestamp(),
    })

    return NextResponse.json({ success: true, message: "Bank details saved successfully" })

  } catch (err: any) {
    console.error("Save bank details error:", err)
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 })
  }
}
