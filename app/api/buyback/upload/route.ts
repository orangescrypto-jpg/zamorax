// app/api/buyback/upload/route.ts
// Guest-writable image upload, scoped to the Sell for Cash form only. The
// generic /api/upload route requires a session (uploads are attributed to
// a logged-in seller's listing), but buyback submission must work for
// people who aren't logged in yet — so this is a narrow, separate copy of
// the same r2Put mechanics with no auth requirement and its own R2 prefix
// (buyback/) so these images never mix with listing uploads.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { r2Put, R2_PUBLIC_URL } from "@/lib/r2/client"

const MAX_BYTES = 8 * 1024 * 1024 // 8MB per photo

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Image is too large (max 8MB)" }, { status: 400 })
    }

    const ext = file.name.split(".").pop() ?? "jpg"
    const key = `buyback/${crypto.randomUUID()}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())
    const nativeBucket = (req as any)?.env?.ZAMORAX_BUCKET

    await r2Put(key, buffer, file.type || "image/jpeg", nativeBucket)

    return NextResponse.json({ url: `${R2_PUBLIC_URL()}/${key}`, path: key })
  } catch (err: any) {
    console.error("[api/buyback/upload] failed:", err)
    return NextResponse.json({ error: err.message || "Upload failed" }, { status: 500 })
  }
}
