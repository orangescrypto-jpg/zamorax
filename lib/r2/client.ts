// lib/r2/client.ts
// ─────────────────────────────────────────────────────────────────
// WAS FIREBASE STORAGE → NOW CLOUDFLARE R2
// Server-side R2 client using S3-compatible API.
// Only used inside app/api/upload/route.ts and migration scripts.
// Client-side code calls fetch('/api/upload') — never this directly.
// ─────────────────────────────────────────────────────────────────

import { S3Client } from "@aws-sdk/client-s3"

// Env validation is deferred to request time so Next.js build-time
// static analysis / page-data collection never hits these throws.
function getR2Client(): S3Client {
  if (!process.env.R2_ENDPOINT)          throw new Error("Missing R2_ENDPOINT")
  if (!process.env.R2_ACCESS_KEY_ID)     throw new Error("Missing R2_ACCESS_KEY_ID")
  if (!process.env.R2_SECRET_ACCESS_KEY) throw new Error("Missing R2_SECRET_ACCESS_KEY")

  return new S3Client({
    region:   "auto",
    endpoint: process.env.R2_ENDPOINT,  // https://<account-id>.r2.cloudflarestorage.com
    credentials: {
      accessKeyId:     process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  })
}

// Lazy singleton — created once on first real request, never at import time.
let _r2Client: S3Client | undefined
export function r2Client(): S3Client {
  if (!_r2Client) _r2Client = getR2Client()
  return _r2Client
}

export function R2_BUCKET(): string {
  const v = process.env.R2_BUCKET
  if (!v) throw new Error("Missing R2_BUCKET")
  return v
}

export function R2_PUBLIC_URL(): string {
  const v = process.env.R2_PUBLIC_URL  // https://files.yourdomain.com
  if (!v) throw new Error("Missing R2_PUBLIC_URL")
  return v
}
