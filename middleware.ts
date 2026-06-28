// middleware.ts
// Merges rate limiting, Supabase SSR session refresh, security headers,
// maintenance mode, and auth guards.
export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"

// ── Rate limiter ──────────────────────────────────────────────────
interface RateBucket {
  count:       number
  windowStart: number
}

const rateLimitStore = new Map<string, RateBucket>()

const RATE_LIMITS: Record<string, { max: number; windowMs: number }> = {
  // Tight limit on d1/query — it's admin-only and hits CF HTTP API each call
  "/api/d1/query":            { max: 60,  windowMs: 60_000 },
  "/api/payment/initialize":  { max: 10,  windowMs: 60_000 },
  "/api/payment/verify":      { max: 20,  windowMs: 60_000 },
  "/api/payment/payout":      { max: 5,   windowMs: 60_000 },
  "/api/payment/confirm":     { max: 5,   windowMs: 60_000 },
  "/api/payment/notify-admin":{ max: 10,  windowMs: 60_000 },
  "/api/ai/chat":             { max: 30,  windowMs: 60_000 },
  "/api/contact":             { max: 5,   windowMs: 60_000 },
  "/api/email":               { max: 5,   windowMs: 60_000 },
  // Generic fallback — shared bucket for everything else
  "/api/":                    { max: 120, windowMs: 60_000 },
}

function getRateLimit(pathname: string) {
  for (const [path, config] of Object.entries(RATE_LIMITS)) {
    if (path !== "/api/" && pathname.startsWith(path)) return config
  }
  return RATE_LIMITS["/api/"]
}

function checkRateLimit(key: string, max: number, windowMs: number): boolean {
  const now    = Date.now()
  const bucket = rateLimitStore.get(key)
  if (!bucket || now - bucket.windowStart > windowMs) {
    rateLimitStore.set(key, { count: 1, windowStart: now })
    return true
  }
  if (bucket.count >= max) return false
  bucket.count++
  return true
}

let pruneCounter = 0
function maybePrune() {
  if (++pruneCounter % 1000 !== 0) return
  const now = Date.now()
  for (const [key, bucket] of rateLimitStore.entries()) {
    if (now - bucket.windowStart > 120_000) rateLimitStore.delete(key)
  }
}

// ── Security headers ──────────────────────────────────────────────
function applySecurityHeaders(response: NextResponse) {
  response.headers.set("X-DNS-Prefetch-Control", "on")
  response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload")
  response.headers.set("X-Frame-Options", "SAMEORIGIN")
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://www.gstatic.com https://*.supabase.co",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' blob: data: https://*.supabase.co https://*.r2.dev https://api.qrserver.com https://avatars.githubusercontent.com",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.paystack.co https://api.flutterwave.com https://*.sentry.io",
      "frame-src https://accounts.google.com",
      "object-src 'none'",
      "base-uri 'self'",
    ].join("; "),
  )
}

// ── Protected paths ───────────────────────────────────────────────
const PROTECTED_PATH_PREFIXES = [
  "/dashboard",
  "/wishlist",
  "/chat",
  "/notifications",
  "/admin",
  "/moderator",
  "/api/admin",
  "/api/d1/query",   // admin/mod only — enforced in route too, belt+suspenders
]

const PUBLIC_API_EXACT_PATHS = new Set([
  "/api/admin/settings",
])

const PROTECTED_ROLE_PATHS: Array<{ prefix: string; roles: string[] }> = [
  { prefix: "/admin",            roles: ["admin"] },
  { prefix: "/moderator",        roles: ["admin", "moderator"] },
  { prefix: "/dashboard/seller", roles: ["admin", "seller"] },
  { prefix: "/dashboard/buyer",  roles: ["admin", "moderator", "seller", "buyer"] },
]

function requiresAuth(pathname: string, method: string) {
  if (method === "GET" && PUBLIC_API_EXACT_PATHS.has(pathname)) return false
  return PROTECTED_PATH_PREFIXES.some((p) => pathname.startsWith(p))
}

// ── Middleware ────────────────────────────────────────────────────
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── 1. Rate limiting ─────────────────────────────────────────────
  if (pathname.startsWith("/api/") && !pathname.startsWith("/api/webhooks/")) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
            ?? request.headers.get("x-real-ip")
            ?? "unknown"
    const { max, windowMs } = getRateLimit(pathname)
    maybePrune()

    if (!checkRateLimit(`${ip}:${pathname}`, max, windowMs)) {
      return new NextResponse(
        JSON.stringify({ error: "Too many requests. Please try again shortly." }),
        { status: 429, headers: { "Content-Type": "application/json", "Retry-After": "60" } },
      )
    }
  }

  // ── 2. Supabase session refresh ───────────────────────────────────
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options: any }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()

  // ── 3. Security headers ───────────────────────────────────────────
  applySecurityHeaders(supabaseResponse)

  // ── 4. Admin API header check ─────────────────────────────────────
  const isPublicSettingsGet =
    request.method === "GET" && PUBLIC_API_EXACT_PATHS.has(pathname)

  if (pathname.startsWith("/api/admin") && !isPublicSettingsGet) {
    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      })
    }
  }

  // ── 5. Maintenance mode ───────────────────────────────────────────
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
      const res = await fetch(settingsUrl.toString(), { next: { revalidate: 60 } })
      if (res.ok) {
        const settings = await res.json()
        if (settings.maintenanceMode) {
          const url = request.nextUrl.clone()
          url.pathname = "/maintenance"
          return NextResponse.redirect(url)
        }
      }
    } catch {
      // Settings fetch failed — let request through
    }
  }

  // ── 6. Auth + role guards ─────────────────────────────────────────
  if (requiresAuth(pathname, request.method)) {
    const isApiRoute = pathname.startsWith("/api/")

    if (!user) {
      if (isApiRoute) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
      const loginUrl = request.nextUrl.clone()
      loginUrl.pathname = "/login"
      loginUrl.searchParams.set("next", pathname)
      return NextResponse.redirect(loginUrl)
    }

    const role = (user.user_metadata?.role as string) ?? "buyer"

    for (const { prefix, roles } of PROTECTED_ROLE_PATHS) {
      if (pathname.startsWith(prefix) && !roles.includes(role)) {
        if (isApiRoute) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }
        return NextResponse.redirect(new URL("/", request.url))
      }
    }
  }

  // ── 7. Return response with refreshed session cookies ─────────────
  return supabaseResponse
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js).*)"],
}
