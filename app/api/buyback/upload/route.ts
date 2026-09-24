// app/api/buyback/upload/route.ts
// Guest-writable image upload, scoped to the Sell for Cash form only. The
// generic /api/upload route requires a session, but buyback submission
// must work for people who are not logged in, so this is a narrow,
// separate route with its own R2 prefix (buyback/) so these images never
// mix with listing uploads.
//
// Because it is public, it is rate limited per IP and only accepts a
// fixed set of image types. The file extension is taken from the
// verified MIME type, never from the client-supplied file name.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { r2Put, R2_PUBLIC_URL } from "@/lib/r2/client"
import { rateLimit, rateLimitResponse, getClientIp } from "@/lib/rateLimit"

const MAX_BYTES = 8 * 1024 * 1024 // 8MB per photo

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
}

export async function POST(req: NextRequest) {
  const nativeDB = (req as any)?.env?.DB

  try {
    // 40 photos per hour per IP: enough for several submissions, far too
    // few for abuse.
    const ip = getClientIp(req)
    const rl = await rateLimit(`buyback_upload:${ip}`, { limit: 40, windowSeconds: 3600 }, nativeDB)
    if (!rl.allowed) return rateLimitResponse(rl)

    const formData = await req.formData()
    const file = formData.get("file") as File | null
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })

    const ext = EXT_BY_MIME[file.type]
    if (!ext) {
      return NextResponse.json(
        { error: "Only JPG, PNG, WebP or HEIC photos are allowed" },
        { status: 400 },
      )
    }
    if (file.size <= 0 || file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Photo is too large (max 8MB)" }, { status: 400 })
    }

    const key = `buyback/${crypto.randomUUID()}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())
    const nativeBucket = (req as any)?.env?.ZAMORAX_BUCKET

    await r2Put(key, buffer, file.type, nativeBucket)

    return NextResponse.json({ url: `${R2_PUBLIC_URL()}/${key}`, path: key })
  } catch (err: any) {
    console.error("[api/buyback/upload] failed:", err)
    return NextResponse.json({ error: err.message || "Upload failed" }, { status: 500 })
  }
}
