// lib/cron-secret.ts
// Resolves the secret used to authorise cron endpoints (layaway-sweep,
// escrow-release). Order of precedence: a value saved in D1 by the admin
// (via /admin/cron-settings) takes priority, falling back to the
// CRON_SECRET environment variable if nothing has been saved yet. This
// lets an admin generate or view the secret from the dashboard without
// needing server access to set an environment variable.
import { d1Query } from "@/lib/d1"

export async function getCronSecret(nativeDB?: unknown): Promise<string | null> {
  try {
    await d1Query(
      `CREATE TABLE IF NOT EXISTS cron_settings (
        id TEXT PRIMARY KEY DEFAULT 'default',
        secret TEXT, updated_at TEXT DEFAULT (datetime('now'))
      )`,
      [],
      nativeDB,
    )
    const rows = await d1Query(
      "SELECT secret FROM cron_settings WHERE id = 'default' LIMIT 1",
      [],
      nativeDB,
    )
    const row = rows?.results?.[0] as { secret?: string } | undefined
    if (row?.secret) return row.secret
  } catch (err) {
    console.error("[cron-secret] DB lookup failed, falling back to env:", err)
  }

  return process.env.CRON_SECRET || null
}
