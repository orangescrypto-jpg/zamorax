// sentry.edge.config.ts
// Initialises Sentry in the Next.js Edge runtime (proxy.ts / middleware).
// Edge runtime has no Node.js APIs — keep this minimal.

import * as Sentry from "@sentry/nextjs"

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN

if (DSN) {
  Sentry.init({
    dsn: DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
  })
}
