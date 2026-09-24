// app/api/buyback/settings/route.ts
// GET  public: the merged Sell for Cash content the form renders.
// PUT  admin only: saves edited content, one row per top-level key.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-server"
import { d1Query } from "@/lib/d1"
import { loadBuybackSettings } from "@/lib/buyback/loadSettings"
import { mergeBuybackSettings, DEFAULT_BUYBACK_SETTINGS } from "@/lib/buyback/settings"

const ALLOWED_KEYS = new Set(Object.keys(DEFAULT_BUYBACK_SETTINGS))

export async function GET(req: NextRequest) {
  const nativeDB = (req as any)?.env?.DB
  const settings = await loadBuybackSettings(nativeDB)
  return NextResponse.json({ settings })
}

export async function PUT(req: NextRequest) {
  const nativeDB = (req as any)?.env?.DB
  const auth = await requireAdmin(req, nativeDB)
  if (!auth.ok) return auth.error

  try {
    const body = await req.json().catch(() => ({}))
    const incoming = (body?.settings ?? {}) as Record<string, unknown>

    // Validate by merging: anything malformed falls back to defaults, so
    // an admin can never save a state that breaks the public form.
    const cleaned = mergeBuybackSettings(incoming) as unknown as Record<string, unknown>

    for (const key of Object.keys(cleaned)) {
      if (!ALLOWED_KEYS.has(key)) continue
      await d1Query(
        `INSERT INTO buyback_settings (key, value, updated_by, updated_at)
         VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET
           value = excluded.value,
           updated_by = excluded.updated_by,
           updated_at = datetime('now')`,
        [key, JSON.stringify(cleaned[key]), auth.uid],
        nativeDB,
      )
    }

    return NextResponse.json({ ok: true, settings: cleaned })
  } catch (err) {
    console.error("[api/buyback/settings PUT] failed:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not save settings." },
      { status: 500 },
    )
  }
}
