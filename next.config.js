/** @type {import('next').NextConfig} */
// Image CDN: Cloudflare R2 (public dev URL or custom domain)
// Auth/DB: Supabase + Cloudflare D1

const nextConfig = {
  reactStrictMode: true,

  // ── Bundle size: keep heavy server-only packages out of the Worker ──
  // These are either Node.js-only (won't run in Workers anyway) or only
  // needed in local dev (AWS SDK fallback). Marking them external prevents
  // the bundler from inlining them into handler.mjs.
  serverExternalPackages: [
    "@aws-sdk/client-s3",
    "@aws-sdk/s3-request-presigner",
    "@aws-sdk/lib-storage",
  ],

  images: {
    remotePatterns: [
      // Primary: driven by NEXT_PUBLIC_R2_HOSTNAME (set in Vercel env vars)
      ...(process.env.NEXT_PUBLIC_R2_HOSTNAME
        ? [{ protocol: "https", hostname: process.env.NEXT_PUBLIC_R2_HOSTNAME }]
        : []),
      // Safety net: covers any R2 public-dev-URL bucket even if the env var
      // above is missing or stale.
      { protocol: "https", hostname: "*.r2.dev" },
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
