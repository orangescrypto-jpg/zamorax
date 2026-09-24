// app/api/cron/data-cleanup/route.ts
// Weekly data cleanup. Runs every enabled job in a safe order, using the
// windows saved on the admin Storage & Cleanup page.
//
// Auth: this route REFUSES to run when no cron secret is configured. (The
// older cron routes skip the check in that case, which leaves them open to
// anyone who finds the URL; a route that can delete data must not do that.)
// Set the secret from /admin/cron-settings, then call:
//   POST https://yourdomain.com/api/cron/data-cleanup
//   header:  x-cron-secret: <secret>     (or ?secret=<secret> for schedulers
//                                         that cannot set headers)
// Safe to run repeatedly: every job only acts on rows still past its window.
//
// Speed: a full run touches 19 jobs and scans the whole file bucket, which
// can take longer than a scheduler will wait (cron-job.org reports
// "Failed (timeout)"). So by default this route answers straight away with
// { started: true } and finishes the cleanup after the response is sent.
// Add ?wait=1 to run it inside the request and get the full result back,
// which is what you want when testing by hand.
export const dynamic = "force-dynamic"
export const maxDuration = 60

import { NextRequest, NextResponse, after } from "next/server"
import { getCronSecret } from "@/lib/cron-secret"
import { runAll } from "@/lib/cleanup/runner"

type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown; ZAMORAX_BUCKET?: unknown } }

/** Constant-time string comparison so the secret cannot be guessed from response timing. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function handle(req: NextRequest, context: RouteContext) {
  const nativeDB = (req as any)?.env?.DB ?? (context as any)?.env?.DB
  const nativeBucket = (req as any)?.env?.ZAMORAX_BUCKET ?? (context as any)?.env?.ZAMORAX_BUCKET

  const secret = await getCronSecret(nativeDB)
  if (!secret) {
    return NextResponse.json(
      { error: "No cron secret is configured. Set one at /admin/cron-settings first." },
      { status: 503 },
    )
  }
  const auth = req.headers.get("authorization")
  const bearer = auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7) : null
  const provided =
    req.headers.get("x-cron-secret") ?? bearer ?? new URL(req.url).searchParams.get("secret") ?? ""
  if (!provided || !safeEqual(provided, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const wait = new URL(req.url).searchParams.get("wait") === "1"

  if (wait) {
    try {
      const result = await runAll({ nativeDB, nativeBucket, dryRun: false })
      return NextResponse.json({ ok: true, ...result })
    } catch (err: any) {
      console.error("[cron/data-cleanup] failed:", err)
      return NextResponse.json({ ok: false, error: err?.message ?? "Cleanup failed" }, { status: 500 })
    }
  }

  // Default: reply now, do the work after the response has gone out.
  after(async () => {
    try {
      const result = await runAll({ nativeDB, nativeBucket, dryRun: false })
      console.log(
        `[cron/data-cleanup] finished: removed ${result.totalDeleted} rows and ${result.totalFiles} files, allComplete=${result.allComplete}`,
      )
    } catch (err: any) {
      console.error("[cron/data-cleanup] background run failed:", err)
    }
  })
  return NextResponse.json({ ok: true, started: true, note: "Cleanup is running. Add ?wait=1 to wait for the result." })
}

export async function POST(req: NextRequest, context: RouteContext) {
  return handle(req, context)
}

// Some schedulers (cron-job.org) can only send GET, so both verbs work.
export async function GET(req: NextRequest, context: RouteContext) {
  return handle(req, context)
}
