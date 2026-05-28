/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {},
  reactStrictMode: true,
  // Do NOT transpile undici — it uses private class fields (#target) that
  // Next.js 14's webpack/SWC cannot handle. Instead we exclude it from the
  // server bundle entirely via webpack externals below.
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Prevent undici (pulled in by firebase/storage node ESM build) from
      // being bundled into the server-side webpack output.
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : [config.externals].filter(Boolean)),
        'undici',
      ];
    }
    return config;
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
      { protocol: 'https', hostname: 'zamorax-cefc8.firebasestorage.app' },
      { protocol: 'https', hostname: 'api.qrserver.com' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400,
  },
  async headers() {
    return [
      {
        source: '/manifest.json',
        headers: [
          { key: 'Content-Type', value: 'application/manifest+json' },
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript' },
          { key: 'Cache-Control', value: 'no-cache' },
        ],
      },
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
