// app/api/upload/route.ts
// Accepts multipart FormData, stores in R2, returns the public URL.
// Auth check uses the Supabase session cookie via lib/auth-server.ts.
//
// Every upload and delete is checked by lib/upload-policy.ts first:
//   - the key must be inside a folder the caller is allowed to write to
//     (users may only write under their own id; admin-only folders such as
//     blog/ and featured-banners/ reject everyone else; archive/ is never
//     writable, because that is where order and transaction archives live),
//   - the file type and size must suit that folder,
//   - video is refused unless the admin has switched it on.
// Previously any signed-in user could write or delete any key in the bucket.

import { NextRequest, NextResponse } from "next/server"
import { r2Put, r2Delete, R2_PUBLIC_URL } from "@/lib/r2/client"
import { requireAuth } from "@/lib/auth-server"
import { checkDelete, checkUpload } from "@/lib/upload-policy"

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.ok) return auth.error

  try {
    const formData = await req.formData()
    const file     = formData.get("file") as File | null
    const path     = formData.get("path") as string | null

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })

    const ext = (file.name.split(".").pop() ?? "bin").replace(/[^A-Za-z0-9]/g, "").slice(0, 8) || "bin"
    const key = path ?? `uploads/${auth.uid}/${Date.now()}.${ext}`

    // Video settings come from the admin platform settings. If they cannot be
    // read, fall back to the safe defaults: video off.
    let videoEnabled = false
    let maxVideoBytes = 15 * 1024 * 1024
    try {
      const { getPlatformSettings } = await import("@/src/services/platformSettings")
      const s = await getPlatformSettings()
      videoEnabled = s.videoUploadEnabled === true
      if (Number.isFinite(s.maxVideoSizeMb) && s.maxVideoSizeMb > 0) maxVideoBytes = s.maxVideoSizeMb * 1024 * 1024
    } catch (err) {
      console.error("[upload] could not read platform settings, video stays off:", err)
    }

    const verdict = checkUpload({
      key,
      uid: auth.uid,
      role: auth.role,
      contentType: file.type || "",
      size: file.size,
      videoEnabled,
      maxVideoBytes,
    })
    if (!verdict.ok) return NextResponse.json({ error: verdict.error }, { status: verdict.status })

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

  let path: unknown
  try {
    ;({ path } = await req.json())
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  if (!path) return NextResponse.json({ error: "No path provided" }, { status: 400 })

  const verdict = checkDelete(path, auth.uid, auth.role)
  if (!verdict.ok) return NextResponse.json({ error: verdict.error }, { status: verdict.status })

  try {
    // r2Delete uses the native binding when present and the S3 client only as
    // a fallback. The old code always used the S3 client, which fails in
    // production when the S3 credentials are not set, leaving the file behind.
    const nativeBucket = (req as any)?.env?.ZAMORAX_BUCKET
    await r2Delete(path as string, nativeBucket)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error("Delete error:", err)
    return NextResponse.json({ error: err.message || "Delete failed" }, { status: 500 })
  }
}
