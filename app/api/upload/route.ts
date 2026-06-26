// app/api/upload/route.ts
// Accepts multipart FormData, stores in R2, returns public URL.
// Auth check uses Firebase Admin SDK to verify the Bearer token.

import { NextRequest, NextResponse } from "next/server"
import { PutObjectCommand } from "@aws-sdk/client-s3"
import { r2Client, R2_BUCKET, R2_PUBLIC_URL } from "@/lib/r2/client"
import { verifyFirebaseToken } from "@/lib/verifyFirebaseToken"

async function getAuthUserId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) return null
  const token = authHeader.slice(7)
  return verifyFirebaseToken(token)
}

export async function POST(req: NextRequest) {
  const uid = await getAuthUserId(req)
  if (!uid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const formData = await req.formData()
  const file     = formData.get("file") as File | null
  const path     = formData.get("path") as string | null

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })

  const ext    = file.name.split(".").pop() ?? "bin"
  const key    = path ?? `uploads/${uid}/${Date.now()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  await r2Client().send(
    new PutObjectCommand({
      Bucket:      R2_BUCKET(),
      Key:         key,
      Body:        buffer,
      ContentType: file.type || "application/octet-stream",
    }),
  )

  const url = `${R2_PUBLIC_URL()}/${key}`
  return NextResponse.json({ url, path: key })
}

export async function DELETE(req: NextRequest) {
  const uid = await getAuthUserId(req)
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { path } = await req.json()
  if (!path) return NextResponse.json({ error: "No path provided" }, { status: 400 })

  const { DeleteObjectCommand } = await import("@aws-sdk/client-s3")
  await r2Client().send(new DeleteObjectCommand({ Bucket: R2_BUCKET(), Key: path }))

  return NextResponse.json({ ok: true })
}
