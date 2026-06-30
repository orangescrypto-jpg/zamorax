// app/api/upload/route.ts
// Accepts multipart FormData, stores in R2 via S3-compatible HTTP API, returns public URL.
// Auth check uses Supabase session cookie via lib/auth-server.ts.

import { NextRequest, NextResponse } from "next/server"
import { r2Put, R2_PUBLIC_URL } from "@/lib/r2/client"
import { requireAuth } from "@/lib/auth-server"

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.ok) return auth.error

  try {
    const formData = await req.formData()
    const file     = formData.get("file") as File | null
    const path     = formData.get("path") as string | null

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })

    const ext    = file.name.split(".").pop() ?? "bin"
    const key    = path ?? `uploads/${auth.uid}/${Date.now()}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    // Use the native Cloudflare R2 binding when available (production) —
    // without this, every upload silently falls back to the AWS SDK path,
    // which throws if R2_ENDPOINT/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY
    // aren't set, leaving the client stuck waiting on a non-JSON error page.
    const nativeBucket = (req as any)?.env?.ZAMORAX_BUCKET

    await r2Put(key, buffer, file.type || "application/octet-stream", nativeBucket)

    const url = `${R2_PUBLIC_URL()}/${key}`
    return NextResponse.json({ url, path: key })
  } catch (err: any) {
    console.error("Upload error:", err)
    return NextResponse.json({ error: err.message || "Upload failed" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.ok) return auth.error

  const { path } = await req.json()
  if (!path) return NextResponse.json({ error: "No path provided" }, { status: 400 })

  const { DeleteObjectCommand } = await import("@aws-sdk/client-s3")
  const { r2Client, R2_BUCKET } = await import("@/lib/r2/client")
  await r2Client().send(new DeleteObjectCommand({ Bucket: R2_BUCKET(), Key: path }))

  return NextResponse.json({ ok: true })
}
