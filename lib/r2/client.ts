// lib/r2/client.ts
// ─────────────────────────────────────────────────────────────────
// Two paths:
//   1. Native R2 binding (env.ZAMORAX_BUCKET) — production on Cloudflare Workers.
//      No AWS SDK needed — uses the binding directly. Zero bundle cost.
//   2. S3-compatible client via @aws-sdk/client-s3 — local `next dev` fallback ONLY.
//      Imported DYNAMICALLY so the bundler never includes it in the Worker bundle.
// ─────────────────────────────────────────────────────────────────

// Minimal shape of the Cloudflare R2 binding
interface R2Bucket {
  put(key: string, value: ArrayBuffer | Uint8Array | string, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer> } | null>
}

// ── Native binding path ─────────────────────────────────────────────
function getNativeBucket(nativeBucket?: unknown): R2Bucket | null {
  if (nativeBucket && typeof (nativeBucket as R2Bucket).put === "function") {
    return nativeBucket as R2Bucket
  }
  return null
}

export function R2_BUCKET(): string {
  const v = process.env.R2_BUCKET
  if (!v) throw new Error("Missing R2_BUCKET")
  return v
}

export function R2_PUBLIC_URL(): string {
  const v = process.env.R2_PUBLIC_URL
  if (!v) throw new Error("Missing R2_PUBLIC_URL")
  return v
}

// ── Fallback S3-compatible client (local dev only) ──────────────────
// Dynamic import = NOT bundled into the Cloudflare Worker. Only loaded
// at runtime when actually needed (i.e. no native R2 binding present).
async function getAwsSdkClient() {
  if (!process.env.R2_ENDPOINT)          throw new Error("Missing R2_ENDPOINT")
  if (!process.env.R2_ACCESS_KEY_ID)     throw new Error("Missing R2_ACCESS_KEY_ID")
  if (!process.env.R2_SECRET_ACCESS_KEY) throw new Error("Missing R2_SECRET_ACCESS_KEY")

  const { S3Client } = await import("@aws-sdk/client-s3")
  return new S3Client({
    region:   "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId:     process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  })
}

// ── Unified helpers — use these from route handlers ──────────────────

export async function r2Put(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
  nativeBucket?: unknown,
): Promise<void> {
  const bucket = getNativeBucket(nativeBucket)

  if (bucket) {
    await bucket.put(key, body, { httpMetadata: { contentType } })
    return
  }

  // Fallback: dynamic AWS SDK (local dev only)
  const { PutObjectCommand } = await import("@aws-sdk/client-s3")
  const client = await getAwsSdkClient()
  await client.send(
    new PutObjectCommand({
      Bucket:      R2_BUCKET(),
      Key:         key,
      Body:        body,
      ContentType: contentType || "application/octet-stream",
    }),
  )
}

export async function r2Get(
  key: string,
  nativeBucket?: unknown,
): Promise<ArrayBuffer | null> {
  const bucket = getNativeBucket(nativeBucket)

  if (bucket) {
    const obj = await bucket.get(key)
    return obj ? await obj.arrayBuffer() : null
  }

  // Fallback: dynamic AWS SDK (local dev only)
  const { GetObjectCommand } = await import("@aws-sdk/client-s3")
  const client = await getAwsSdkClient()
  const result = await client.send(
    new GetObjectCommand({ Bucket: R2_BUCKET(), Key: key }),
  )
  const b = result.Body as any
  if (!b) return null
  return await b.transformToByteArray()
}
