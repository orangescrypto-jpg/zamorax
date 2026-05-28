// sentry.client.config.ts
// Initialises Sentry on the browser side.
// Next.js auto-loads this file — do not import it manually.

import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Capture 10% of sessions for performance monitoring in prod.
  // Increase to 1.0 during initial launch for full visibility.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Capture 10% of sessions for session replay.
  replaysSessionSampleRate: 0.1,
  // Always capture replays on errors.
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration({
      // Mask all text and block all media by default (NDPR compliance).
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  enabled: process.env.NODE_ENV === "production",
})
