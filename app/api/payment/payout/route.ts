// app/api/payment/bank-details/route.ts
// ─────────────────────────────────────────────────────────────────
// Admin endpoint to get and save platform bank details.
// Stored in Firestore: settings/bankDetails
// Admin sets this in /admin/settings — no code change ever needed.
// ─────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic"

import { getAdminDb } from "@/lib/firebase/admin"

import { NextRequest, NextResponse } from "next/server"

// ── GET — fetch current bank details ─────────────────────────────
export async function GET() {
  try {
    const db = getAdminDb()
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

    const db = getAdminDb()
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
