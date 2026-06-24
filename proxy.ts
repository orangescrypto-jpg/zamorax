// proxy.ts
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// ── In-memory rate limiter ────────────────────────────────────────
// Uses a sliding-window counter keyed by IP + route bucket.
// Works without any external dependency (Upstash/Redis optional upgrade).
// Resets automatically — Map entries expire after their window.

interface RateBucket {
  count:     number
  windowStart: number
}

const rateLimitStore = new Map<string, RateBucket>()

const RATE_LIMITS: Record<string, { max: number; windowMs: number }> = {
  // Financial routes — tight limits
  "/api/payment/initialize": { max: 10,  windowMs: 60_000 },   // 10/min per IP
  "/api/payment/verify":     { max: 20,  windowMs: 60_000 },   // 20/min per IP
  "/api/payment/payout":     { max: 5,   windowMs: 60_000 },   // 5/min per IP
  "/api/payment/confirm":    { max: 5,   windowMs: 60_000 },
  "/api/payment/notify-admin": { max: 10, windowMs: 60_000 },
  // AI chat — prevent bill abuse
  "/api/ai/chat":            { max: 30,  windowMs: 60_000 },   // 30/min per IP
  // Contact / email — prevent spam
  "/api/contact":            { max: 5,   windowMs: 60_000 },
  "/api/email":              { max: 5,   windowMs: 60_000 },
  // Default for all other /api routes
  "/api/":                   { max: 120, windowMs: 60_000 },   // 120/min per IP
}

function getRateLimit(pathname: string) {
  // Check specific paths first, then fall back to /api/ default
  for (const [path, config] of Object.entries(RATE_LIMITS)) {
    if (path !== "/api/" && pathname.startsWith(path)) return config
  }
  return RATE_LIMITS["/api/"]
}

function checkRateLimit(key: string, max: number, windowMs: number): boolean {
  const now    = Date.now()
  const bucket = rateLimitStore.get(key)

  if (!bucket || now - bucket.windowStart > windowMs) {
    // New window
    rateLimitStore.set(key, { count: 1, windowStart: now })
    return true
  }

  if (bucket.count >= max) return false   // over limit

  bucket.count++
  return true
}

// Periodically prune expired entries (every 1000 requests approx)
let pruneCounter = 0
function maybePrune() {
  if (++pruneCounter % 1000 !== 0) return
  const now = Date.now()
  for (const [key, bucket] of rateLimitStore.entries()) {
    if (now - bucket.windowStart > 120_000) rateLimitStore.delete(key)
  }
}

// ── Main proxy function ───────────────────────────────────────────
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const response = NextResponse.next()
  response.headers.set("X-DNS-Prefetch-Control", "on")
  response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload")
  response.headers.set("X-Frame-Options", "SAMEORIGIN")
  // ── Content-Security-Policy ──────────────────────────────────
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://www.gstatic.com https://*.firebaseapp.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' blob: data: https://firebasestorage.googleapis.com https://*.firebasestorage.app https://api.qrserver.com https://avatars.githubusercontent.com",
      "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebase.com https://api.paystack.co https://api.flutterwave.com https://*.sentry.io",
      "frame-src https://accounts.google.com https://*.firebaseapp.com",
      "object-src 'none'",
      "base-uri 'self'",
    ].join("; ")
  )

  // ── Rate limiting for API routes ──────────────────────────────
  if (pathname.startsWith("/api/")) {
    // Webhooks are verified by their own signature — skip rate limit
    const isWebhook = pathname.startsWith("/api/webhooks/")
    if (!isWebhook) {
      const ip        = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
                     ?? request.headers.get("x-real-ip")
                     ?? "unknown"
      const { max, windowMs } = getRateLimit(pathname)
      const key = `${ip}:${pathname}`
      maybePrune()

      if (!checkRateLimit(key, max, windowMs)) {
        return new NextResponse(
          JSON.stringify({ error: "Too many requests. Please try again shortly." }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After":  "60",
            },
          }
        )
      }
    }
  }

  // ── Admin API auth ────────────────────────────────────────────
  if (pathname.startsWith("/api/admin")) {
    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      })
    }
  }

  // ── Maintenance mode ──────────────────────────────────────────
  const bypassMaintenance =
    pathname.startsWith("/maintenance") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/manifest") ||
    pathname.startsWith("/icon") ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml"

  if (!bypassMaintenance) {
    try {
      const settingsUrl = new URL("/api/platform-settings", request.url)
      const res = await fetch(settingsUrl.toString(), {
        next: { revalidate: 60 },
      })
      if (res.ok) {
        const settings = await res.json()
        if (settings.maintenanceMode) {
          const url = request.nextUrl.clone()
          url.pathname = "/maintenance"
          return NextResponse.redirect(url)
        }
      }
    } catch {
      // If settings fetch fails, let the request through
    }
  }

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js).*)"],
}
