// app/api/upload/route.ts
// Accepts multipart FormData, stores in R2, returns public URL.
// Auth check uses Supabase session cookie via lib/auth-server.ts.

import { NextRequest, NextResponse } from "next/server"
import { getCloudflareContext } from "@opennextjs/cloudflare"
import { r2Put, R2_PUBLIC_URL, R2_BUCKET } from "@/lib/r2/client"
import { requireAuth } from "@/lib/auth-server"

// Best-effort native binding lookup. Returns undefined outside Cloudflare.
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
    // Fallback: AWS SDK against R2's S3-compatible endpoint (local dev only).
    // Dynamic import = never bundled into the Cloudflare Worker.
    const { S3Client, DeleteObjectCommand } = await import("@aws-sdk/client-s3")
    const client = new S3Client({
      region:   "auto",
      endpoint: process.env.R2_ENDPOINT!,
      credentials: {
        accessKeyId:     process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    })
    await client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET(), Key: path }))
  }

  return NextResponse.json({ ok: true })
}
