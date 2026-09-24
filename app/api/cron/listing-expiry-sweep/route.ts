// app/api/cron/listing-expiry-sweep/route.ts
// Runs on a schedule, same trigger mechanism as layaway-sweep. Two jobs:
//   1. Restock reminder — a listing that has sat at stock_qty = 0 for
//      half of subSettings.listingAutoDeleteDays gets a one-time email +
//      in-app notification to the seller, warning of the deletion date.
//      restock_notice_sent_at stops it firing twice.
//   2. Hard delete — a listing still at stock_qty = 0 after the full
//      listingAutoDeleteDays window is permanently removed: every image
//      in its `images` JSON array is deleted from R2, then the D1 row
//      itself is deleted. Irreversible, matches the same "hard delete,
//      images and data both gone" behaviour used for buyback requests.
//
// Triggered the same way as layaway-sweep — see that file's header for
// the external cron setup notes (GitHub Actions / cron-job.org / etc.
// hitting this URL with the CRON_SECRET header on a schedule).
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { d1Query } from "@/lib/d1"
import { sendPushNotification } from "@/src/services/webPush"
import { getCronSecret } from "@/lib/cron-secret"
import { getSubSettings } from "@/src/services/subSettings"
import { r2Delete } from "@/lib/r2/client"
import { Emails } from "@/src/services/email"
import { extractKeys } from "@/lib/cleanup/helpers"
import { protectedListingIds } from "@/lib/cleanup/jobs-listings"

export async function POST(req: NextRequest) {
  const nativeDB = (req as any)?.env?.DB
  const secret = await getCronSecret(nativeDB)
  // This route DELETES listings, so it must never run unauthenticated. It used
  // to skip the check whenever no secret was configured, which left the URL
  // open to anyone. Now a missing secret is refused, not treated as "allow".
  if (!secret) {
    return NextResponse.json(
      { error: "No cron secret is configured. Set one at /admin/cron-settings first." },
      { status: 503 },
    )
  }
  const provided = req.headers.get("x-cron-secret") ?? new URL(req.url).searchParams.get("secret")
  if (!provided || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const results = { reminded: 0, deleted: 0, kept: 0, errors: [] as string[] }
  const nowIso = new Date().toISOString()
  const settings = await getSubSettings()
  const totalDays = Math.max(1, Number(settings.listingAutoDeleteDays) || 120)
  const reminderAtDays = Math.floor(totalDays / 2)

  // ── Job 1: restock reminders ─────────────────────────────────────
  try {
    const dueForReminder = await d1Query(
      `SELECT id, seller_id, title, out_of_stock_since
         FROM listings
        WHERE stock_qty = 0
          AND out_of_stock_since IS NOT NULL
          AND restock_notice_sent_at IS NULL
          AND julianday(?) - julianday(out_of_stock_since) >= ?`,
      [nowIso, reminderAtDays],
      nativeDB,
    )
    const rows = (dueForReminder?.results ?? []) as Array<Record<string, unknown>>
    for (const row of rows) {
      const listingId = String(row.id)
      const sellerId = String(row.seller_id ?? "")
      const itemTitle = String(row.title ?? "your listing")
      try {
        const daysLeft = totalDays - reminderAtDays
        const deleteDate = new Date(
          new Date(String(row.out_of_stock_since)).getTime() + totalDays * 86400000,
        ).toLocaleDateString("en-NG", { year: "numeric", month: "long", day: "numeric" })

        if (sellerId) {
          await sendPushNotification({
            userId: sellerId,
            type: "account_activity",
            title: "⏳ Restock reminder",
            body: `"${itemTitle}" is out of stock and will be deleted on ${deleteDate} if not restocked.`,
            link: "/dashboard/seller/listings",
            nativeDB,
          })

          const sellerRows = await d1Query("SELECT email, full_name FROM users WHERE uid = ? LIMIT 1", [sellerId], nativeDB)
          const seller = sellerRows?.results?.[0] as { email?: string; full_name?: string } | undefined
          if (seller?.email) {
            Emails.restockReminder(seller.email, {
              sellerName: seller.full_name || "there",
              itemTitle,
              daysLeft,
              deleteDate,
            }).catch(() => {})
          }
        }

        await d1Query(
          "UPDATE listings SET restock_notice_sent_at = ? WHERE id = ?",
          [nowIso, listingId],
          nativeDB,
        )
        results.reminded++
      } catch (err) {
        results.errors.push(`reminder ${listingId}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  } catch (err) {
    results.errors.push(`reminder query: ${err instanceof Error ? err.message : String(err)}`)
  }

  // ── Job 2: hard delete ────────────────────────────────────────────
  // Only listings nothing else depends on are removed. A listing with an
  // order, a layaway plan, Fulfilled-by-Zamorax stock, an active boost or an
  // open offer is kept even when it has been out of stock for the full
  // window, because deleting it would orphan real transactions.
  try {
    const dueForDeletion = await d1Query(
      `SELECT id, images, verification_video
         FROM listings
        WHERE stock_qty = 0
          AND out_of_stock_since IS NOT NULL
          AND julianday(?) - julianday(out_of_stock_since) >= ?
        LIMIT 500`,
      [nowIso, totalDays],
      nativeDB,
    )
    const rows = (dueForDeletion?.results ?? []) as Array<Record<string, unknown>>
    const protectedIds = await protectedListingIds(rows.map((r) => String(r.id)), nowIso, nativeDB)
    for (const row of rows) {
      const listingId = String(row.id)
      if (protectedIds.has(listingId)) {
        results.kept++
        continue
      }
      try {
        const keys = [
          ...extractKeys(row.images as string | null),
          ...extractKeys(row.verification_video as string | null),
        ]
        for (const key of new Set(keys)) {
          try {
            await r2Delete(key, (req as any)?.env?.ZAMORAX_BUCKET)
          } catch (err) {
            console.error(`[listing-expiry-sweep] R2 delete failed for ${key}:`, err)
          }
        }

        // Rows that point at the listing go first, so none is left dangling.
        for (const table of ["saved_listings", "listing_qna"]) {
          try {
            await d1Query(`DELETE FROM ${table} WHERE listing_id = ?`, [listingId], nativeDB)
          } catch {
            /* table may not exist in this database */
          }
        }
        await d1Query("DELETE FROM listings WHERE id = ?", [listingId], nativeDB)
        results.deleted++
      } catch (err) {
        results.errors.push(`delete ${listingId}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  } catch (err) {
    results.errors.push(`delete query: ${err instanceof Error ? err.message : String(err)}`)
  }

  return NextResponse.json({ ok: true, ...results })
}

export async function GET(req: NextRequest) {
  return POST(req)
}
