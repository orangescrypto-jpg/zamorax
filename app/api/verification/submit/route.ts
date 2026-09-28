// app/api/verification/submit/route.ts
// Server-side handler for identity-verification / become-a-seller submissions.
//
// These used to be written straight from the browser through the D1 proxy:
// UpgradeToSellerForm and the two verify pages updated the user's own row
// (role, plan, verificationLevel, isSellerReady, ...) themselves. With the
// proxy now refusing writes to those columns, this route does it instead, and
// only ever applies the pending-review shape — approval stays with staff, and
// plan changes only ever come from a paid subscription.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-server"
import { AdminService } from "@/src/services/admin"

type Mode = "seller_free" | "seller_pro" | "id" | "pro"
const digits11 = (v: unknown) => typeof v === "string" && /^\d{11}$/.test(v)

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.ok) return auth.error

  try {
    const body = await req.json() as {
      mode: Mode; nin?: string; bvn?: string; type?: "nin" | "bvn"; value?: string; selfieUrl?: string
    }
    const uid = auth.uid
    const user = await AdminService.getDoc("users", uid) as Record<string, any> | null
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

    // Staff accounts keep their role; only buyers become "both".
    const nextRole = ["buyer", "both", "seller", undefined, null, ""].includes(user.role)
      ? (user.role === "seller" ? "seller" : "both")
      : user.role
    const userName = String(user.fullName ?? user.full_name ?? "")
    const userEmail = String(user.email ?? "")
    const userPhone = String(user.phone ?? "")

    switch (body.mode) {
      case "seller_free": {
        if (!digits11(body.nin)) return NextResponse.json({ error: "Enter a valid NIN (11 digits)" }, { status: 400 })
        await AdminService.updateDoc("users", uid, {
          role: nextRole, nin: body.nin, verificationLevel: "nin",
          verificationStatus: "pending_review", isSellerReady: false,
        })
        await AdminService.setDoc("verificationRequests", uid, {
          userId: uid, userName, userEmail, type: "nin", value: body.nin, status: "pending",
        })
        return NextResponse.json({ success: true, role: nextRole, verificationLevel: "nin", verificationStatus: "pending_review" })
      }

      case "seller_pro": {
        if (!digits11(body.bvn)) return NextResponse.json({ error: "Enter a valid BVN (11 digits)" }, { status: 400 })
        if (!body.selfieUrl) return NextResponse.json({ error: "Selfie required" }, { status: 400 })
        await AdminService.updateDoc("users", uid, {
          role: nextRole, bvn: body.bvn, selfieUrl: body.selfieUrl, verificationLevel: "bvn",
          proVerificationStatus: "pending_review", isSellerReady: false,
        })
        await AdminService.setDoc("proVerificationRequests", uid, {
          uid, fullName: userName, email: userEmail, bvn: body.bvn,
          selfieUrl: body.selfieUrl, plan: user.plan ?? "free", status: "pending",
        })
        return NextResponse.json({ success: true, role: nextRole, plan: user.plan ?? "free", proVerificationStatus: "pending_review" })
      }

      case "id": {
        if ((body.type !== "nin" && body.type !== "bvn") || !digits11(body.value)) {
          return NextResponse.json({ error: "Invalid ID" }, { status: 400 })
        }
        await AdminService.addDoc("verificationRequests", {
          userId: uid, userName, userEmail, userPhone, type: body.type, value: body.value, status: "pending",
        })
        await AdminService.updateDoc("users", uid, {
          [`${body.type}SubmittedAt`]: new Date().toISOString(),
          verificationLevel: body.type === "bvn" ? "nin_bvn" : "nin",
        })
        return NextResponse.json({ success: true })
      }

      case "pro": {
        if (!digits11(body.bvn)) return NextResponse.json({ error: "Enter valid BVN (11 digits)" }, { status: 400 })
        if (!body.selfieUrl) return NextResponse.json({ error: "Upload a selfie photo" }, { status: 400 })
        const hasNin = !!user.ninVerified
        if (!hasNin && !digits11(body.nin)) return NextResponse.json({ error: "Enter valid NIN (11 digits)" }, { status: 400 })
        await AdminService.updateDoc("users", uid, {
          bvn: body.bvn, ...(!hasNin && { nin: body.nin }), proVerificationStatus: "pending_review",
        })
        await AdminService.setDoc("proVerificationRequests", uid, {
          uid, fullName: userName, email: userEmail, bvn: body.bvn,
          nin: body.nin || "already_verified", selfieUrl: body.selfieUrl, status: "pending",
        })
        return NextResponse.json({ success: true })
      }

      default:
        return NextResponse.json({ error: "Unknown mode" }, { status: 400 })
    }
  } catch (err: any) {
    console.error("[POST /api/verification/submit]", err)
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 })
  }
}
