// app/api/upload/route.ts
// Accepts multipart FormData, stores in R2 via S3-compatible HTTP API, returns public URL.
// Auth check uses Supabase session cookie via lib/auth-server.ts.

import { NextRequest, NextResponse } from "next/server"
import { r2Put, R2_PUBLIC_URL } from "@/lib/r2/client"
import { requireAuth } from "@/lib/auth-server"

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.ok) return auth.error

  const formData = await req.formData()
  const file     = formData.get("file") as File | null
  const path     = formData.get("path") as string | null

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })

  const ext    = file.name.split(".").pop() ?? "bin"
  const key    = path ?? `uploads/${auth.uid}/${Date.now()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  await r2Put(key, buffer, file.type || "application/octet-stream")

  const url = `${R2_PUBLIC_URL()}/${key}`
  return NextResponse.json({ url, path: key })
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
