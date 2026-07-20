// lib/rateLimit.ts
// Table-backed fixed-window rate limiter. Works on Vercel (HTTP D1 API) or
// Cloudflare Pages (native binding) since it just goes through d1Query — no
// Redis/Upstash needed. Requires migrations/0003_add_rate_limits.sql.
//
// Usage in a route handler:
//
//   import { rateLimit, rateLimitResponse } from "@/lib/rateLimit"
//
//   export async function POST(req: NextRequest) {
//     const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
//     const rl = await rateLimit(`login:${ip}`, { limit: 10, windowSeconds: 60 })
//     if (!rl.allowed) return rateLimitResponse(rl)
//     ...
//   }

import { NextResponse } from "next/server"
import { d1Query } from "@/lib/d1"

export interface RateLimitOptions {
  /** Max requests allowed within the window. */
  limit: number
  /** Window size in seconds (fixed window, not sliding). */
  windowSeconds: number
}

export interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  /** Unix seconds when the current window resets. */
  resetAt: number
}

/**
 * Checks + increments a rate-limit bucket in one call.
 * bucketKey should already include the identity dimension, e.g.
 * `login:${ip}`, `listing_create:${userId}`, `chat_send:${userId}`.
 */
export async function rateLimit(
  bucketKey: string,
  { limit, windowSeconds }: RateLimitOptions,
  nativeDB?: any,
): Promise<RateLimitResult> {
  const now = Math.floor(Date.now() / 1000)
  const windowStart = Math.floor(now / windowSeconds) * windowSeconds
  const resetAt = windowStart + windowSeconds

  try {
    // Upsert-and-increment. SQLite (D1) supports ON CONFLICT DO UPDATE.
    await d1Query(
      `INSERT INTO rate_limits (bucket_key, window_start, count)
       VALUES (?, ?, 1)
       ON CONFLICT(bucket_key, window_start)
       DO UPDATE SET count = count + 1`,
      [bucketKey, windowStart],
      nativeDB,
    )

    const { results } = await d1Query(
      `SELECT count FROM rate_limits WHERE bucket_key = ? AND window_start = ?`,
      [bucketKey, windowStart],
      nativeDB,
    )

    const count = Number((results?.[0] as any)?.count ?? 1)
    const remaining = Math.max(0, limit - count)

    return { allowed: count <= limit, limit, remaining, resetAt }
  } catch (err) {
    // Fail OPEN: if D1 is unreachable, don't block real traffic over an
    // infra hiccup. Rate limiting is a safety net, not the primary defense.
    console.error("[rateLimit] D1 error, failing open:", err)
    return { allowed: true, limit, remaining: limit, resetAt }
  }
}

/** Standard 429 response with Retry-After + standard rate-limit headers. */
export function rateLimitResponse(result: RateLimitResult) {
  const retryAfter = Math.max(1, result.resetAt - Math.floor(Date.now() / 1000))
  return NextResponse.json(
    { error: "Too many requests. Please slow down and try again shortly." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": String(result.resetAt),
      },
    },
  )
}

/** Pulls the best-effort client IP from a NextRequest's headers. */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for")
  if (xff) return xff.split(",")[0].trim()
  return req.headers.get("x-real-ip") ?? "unknown"
}
