// sentry.client.config.ts
// Initialises Sentry in the browser. Runs once on app load.
// Set NEXT_PUBLIC_SENTRY_DSN in .env.local (and Vercel env vars).
// If DSN is absent the import is a no-op — app still works fine.

import * as Sentry from "@sentry/nextjs"

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN

if (DSN) {
  Sentry.init({
    dsn: DSN,
    environment: process.env.NODE_ENV,

    // Capture 10% of sessions for performance tracing in production,
    // 100% in development so you see everything locally.
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

    // Replay 1% of sessions, 100% on error — great for catching
    // what a user was doing right before a crash.
    replaysSessionSampleRate: 0.01,
    replaysOnErrorSampleRate: 1.0,

    integrations: [
      Sentry.replayIntegration({
        // Mask all text and block all media in replays for privacy
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],

    // Don't send errors caused by browser extensions or bots
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "Non-Error promise rejection captured",
      /^No error$/,
    ],

    beforeSend(event) {
      // Strip any payment reference or account numbers from error context
      if (event.request?.data) {
        const data = event.request.data as Record<string, unknown>
        if (data.accountNumber) data.accountNumber = "[Filtered]"
        if (data.password)      data.password      = "[Filtered]"
        if (data.bvn)           data.bvn           = "[Filtered]"
        if (data.nin)           data.nin           = "[Filtered]"
      }
      return event
    },
  })
}
