// app/api/admin/cleanup/run/route.ts
// Admin-only. Runs one cleanup job, or all of them, on demand.
//
// Body: { job: "<jobKey>" | "all", mode: "preview" | "delete" }
//   preview - reports what WOULD be removed and changes nothing.
//   delete  - performs the cleanup.
//
// Every destructive request must also carry confirm: true, so a stray or
// replayed call cannot delete anything by accident.
export const dynamic = "force-dynamic"
export const maxDuration = 60

import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-server"
import { runAll, runJob } from "@/lib/cleanup/runner"
import { JOBS, type JobKey } from "@/lib/cleanup/settings"

type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown; ZAMORAX_BUCKET?: unknown } }

export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.error
  const nativeDB = (req as any)?.env?.DB ?? (context as any)?.env?.DB
  const nativeBucket = (req as any)?.env?.ZAMORAX_BUCKET ?? (context as any)?.env?.ZAMORAX_BUCKET

  let body: { job?: string; mode?: string; confirm?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const mode = body.mode === "delete" ? "delete" : body.mode === "preview" ? "preview" : null
  if (!mode) return NextResponse.json({ error: 'mode must be "preview" or "delete"' }, { status: 400 })
  if (mode === "delete" && body.confirm !== true) {
    return NextResponse.json({ error: "Deleting requires confirm: true" }, { status: 400 })
  }
  const dryRun = mode === "preview"

  try {
    if (body.job === "all") {
      const result = await runAll({ nativeDB, nativeBucket, dryRun })
      return NextResponse.json({ mode, ...result })
    }
    const key = JOBS.find((j) => j.key === body.job)?.key as JobKey | undefined
    if (!key) return NextResponse.json({ error: "Unknown job" }, { status: 400 })
    const result = await runJob(key, { nativeDB, nativeBucket, dryRun })
    return NextResponse.json({ mode, result })
  } catch (err: any) {
    console.error("[admin/cleanup/run] failed:", err)
    return NextResponse.json({ error: err?.message ?? "Cleanup failed. Nothing further was changed." }, { status: 500 })
  }
}
