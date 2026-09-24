// lib/buyback/loadSettings.ts
// Server-only: reads saved settings rows from D1 and merges over defaults.
import { d1Query } from "@/lib/d1"
import { BuybackSettings, mergeBuybackSettings } from "@/lib/buyback/settings"

export async function loadBuybackSettings(nativeDB?: unknown): Promise<BuybackSettings> {
  try {
    const rows = await d1Query("SELECT key, value FROM buyback_settings", [], nativeDB)
    const saved: Record<string, unknown> = {}
    for (const r of (rows?.results ?? []) as Array<{ key: string; value: string }>) {
      try { saved[r.key] = JSON.parse(r.value) } catch { /* skip malformed row */ }
    }
    return mergeBuybackSettings(saved)
  } catch (err) {
    // Table may not exist yet (migration not run). Fall back to defaults.
    console.error("[buyback/loadSettings] falling back to defaults:", err)
    return mergeBuybackSettings(null)
  }
}
