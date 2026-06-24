// lib/r2/client.ts
// ─────────────────────────────────────────────────────────────────
// WAS FIREBASE STORAGE → NOW CLOUDFLARE R2
// Server-side R2 client using S3-compatible API.
// Only used inside app/api/upload/route.ts and migration scripts.
// Client-side code calls fetch('/api/upload') — never this directly.
// ─────────────────────────────────────────────────────────────────

import { S3Client } from "@aws-sdk/client-s3"

if (!process.env.R2_ENDPOINT)        throw new Error("Missing R2_ENDPOINT")
if (!process.env.R2_ACCESS_KEY_ID)   throw new Error("Missing R2_ACCESS_KEY_ID")
if (!process.env.R2_SECRET_ACCESS_KEY) throw new Error("Missing R2_SECRET_ACCESS_KEY")

export const r2Client = new S3Client({
  region:   "auto",
  endpoint: process.env.R2_ENDPOINT,   // https://<account-id>.r2.cloudflarestorage.com
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

export const R2_BUCKET     = process.env.R2_BUCKET!
export const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL!  // https://files.yourdomain.com
