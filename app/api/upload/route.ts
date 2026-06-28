// app/api/upload/route.ts — REPLACE EXISTING FILE
// Accepts multipart FormData, stores in R2, returns public URL.
// Auth check uses Supabase session cookie via lib/auth-server.ts.
//
// On Cloudflare, the native R2 binding (ZAMORAX_BUCKET, from wrangler.toml)
// is read off the request context and passed through to r2Put/r2Get in
// lib/r2/client.ts. If no binding is present (e.g. local `next dev`),
// those helpers fall back to the S3-compatible AWS SDK client automatically
// — no code path here needs to change between environments.

import { NextRequest, NextResponse } from "next/server"
import { getCloudflareContext } from "@opennextjs/cloudflare"
import { r2Put, R2_PUBLIC_URL } from "@/lib/r2/client"
import { requireAuth } from "@/lib/auth-server"

// Best-effort native binding lookup. Returns undefined outside Cloudflare
// (e.g. local dev), in which case r2Put falls back to the AWS SDK client.
function getNativeBucket(): unknown {
  try {
    return (getCloudflareContext()?.env as any)?.ZAMORAX_BUCKET
  } catch {
    return undefined
  }
}

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

  await r2Put(key, buffer, file.type || "application/octet-stream", getNativeBucket())

  const url = `${R2_PUBLIC_URL()}/${key}`
  return NextResponse.json({ url, path: key })
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.ok) return auth.error

  const { path } = await req.json()
  if (!path) return NextResponse.json({ error: "No path provided" }, { status: 400 })

  const nativeBucket = getNativeBucket() as { delete?(key: string): Promise<unknown> } | undefined

  if (nativeBucket?.delete) {
    await nativeBucket.delete(path)
  } else {
    // Fallback: AWS SDK against R2's S3-compatible endpoint (local dev only)
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3")
    const { r2Client, R2_BUCKET } = await import("@/lib/r2/client")
    await r2Client().send(new DeleteObjectCommand({ Bucket: R2_BUCKET(), Key: path }))
  }

  return NextResponse.json({ ok: true })
}
