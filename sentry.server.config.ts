// sentry.server.config.ts
// Initialises Sentry on the Next.js server (Node.js runtime).
// Catches unhandled errors in API routes, Server Components, etc.

import * as Sentry from "@sentry/nextjs"

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN

if (DSN) {
  Sentry.init({
    dsn: DSN,
    environment: process.env.NODE_ENV,

    // Capture all traces server-side — it's cheap and gives full visibility
    // into slow API routes and database queries.
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,

    // Don't report 4xx errors — those are user errors, not bugs.
    // Do report all 5xx errors.
    beforeSend(event, hint) {
      const status = (hint?.originalException as any)?.status
      if (status && status >= 400 && status < 500) return null
      return event
    },
  })
}
