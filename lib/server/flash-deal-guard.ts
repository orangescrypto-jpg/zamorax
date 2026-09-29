// lib/server/flash-deal-guard.ts
// A flash deal replaces the listing's normal (standing) discount while it is
// live. If the flash percent is not higher than the standing one, buyers
// would pay MORE during the flash deal, so it is blocked.
import { d1Query } from "@/lib/d1"

export type FlashCheck = { ok: true } | { ok: false; error: string }

export async function checkFlashDealAgainstStanding(
  listingId: string,
  flashPercent: number,
  nativeDB?: unknown,
): Promise<FlashCheck> {
  const r = await d1Query(
    "SELECT standing_discount_enabled AS en, standing_discount_percent AS pct FROM listings WHERE id = ? LIMIT 1",
    [listingId],
    nativeDB,
  )
  const row = (r as any)?.results?.[0]
  const standing = row?.en && Number(row.pct) > 0 ? Number(row.pct) : 0
  if (standing > 0 && flashPercent <= standing) {
    return {
      ok: false,
      error: `This listing already has a ${standing}% discount. A flash deal must be higher than ${standing}%.`,
    }
  }
  return { ok: true }
}

/** Pull the flash percent + listing id out of a non-staff listings UPDATE that sets flash_deal. */
export function extractFlashUpdate(sql: string, vals: unknown[]): { listingId: string; percent: number } | null {
  if (!/\bflash_deal\b/i.test(sql)) return null
  const json = vals.find(v => typeof v === "string" && v.trim().startsWith("{") && v.includes("discountPercent")) as string | undefined
  if (!json) return null // clearing (null) or unrelated write
  try {
    const percent = Number(JSON.parse(json).discountPercent)
    const listingId = String(vals[vals.length - 1] ?? "")
    if (!Number.isFinite(percent) || !listingId) return null
    return { listingId, percent }
  } catch { return null }
}
