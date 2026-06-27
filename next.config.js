/** @type {import('next').NextConfig} */
// ─────────────────────────────────────────────────────────────────
// WAS FIREBASE → NOW CLOUDFLARE R2 + D1 + SUPABASE
// Removed: undici webpack external (was needed for firebase/storage)
// Added: R2 image hostname
// ─────────────────────────────────────────────────────────────────

const nextConfig = {
  turbopack: {},
  reactStrictMode: true,

  // firebase-admin relies on Node-native modules (undici, grpc, etc.) that
  // Turbopack/webpack mishandle if bundled. This keeps it external so
  // Vercel's Node runtime just `require()`s it directly instead of bundling
  // it — without this, firebase-admin can throw at import time on Vercel
  // (FUNCTION_INVOCATION_FAILED with zero outgoing requests, before any
  // route code even runs) while still working fine in local dev.
  serverExternalPackages: ["firebase-admin"],

  images: {
    remotePatterns: [
      // WAS FIREBASE STORAGE → NOW CLOUDFLARE R2 CDN
      // Replace <your-r2-domain> with your actual R2 custom domain
      { protocol: "https", hostname: process.env.NEXT_PUBLIC_R2_HOSTNAME || "*.r2.dev" },
      // Keep for any legacy Firebase URLs still in the DB during migration
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      { protocol: "https", hostname: "zamorax-cefc8.firebasestorage.app" },
      // Other
      { protocol: "https", hostname: "api.qrserver.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      // Google profile photos (Supabase Google OAuth)
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86400,
  },

  async headers() {
    return [
      {
        source: "/manifest.json",
        headers: [
          { key: "Content-Type", value: "application/manifest+json" },
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript" },
          { key: "Cache-Control", value: "no-cache" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ]
  },
}

module.exports = nextConfig
