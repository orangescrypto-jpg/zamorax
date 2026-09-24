// lib/stockManagement.ts
// Centralised stock_qty decrement/restore so every order path (Buy Now,
// cart, layaway, admin recovery flows) marks out_of_stock_since the same
// way. That column drives the auto-delete sweep in
// app/api/cron/listing-expiry-sweep/route.ts, which hard-deletes a
// listing (D1 row + R2 images) once it has sat out of stock for longer
// than subSettings.listingAutoDeleteDays with no restock.

import { d1Query } from "@/lib/d1"

/**
 * Decrements stock_qty by qty for a listing, atomically (only succeeds if
 * enough stock exists). If this decrement takes stock to exactly 0,
 * out_of_stock_since is stamped with the current time. Safe to call on a
 * listing with a null stock_qty (unlimited stock, e.g. services) — the
 * WHERE clause requires stock_qty IS NOT NULL so those rows are untouched.
 */
export async function decrementStock(
  listingId: string,
  qty: number,
  nativeDB?: unknown,
): Promise<void> {
  if (!listingId || !qty || qty <= 0) return
  try {
    await d1Query(
      `UPDATE listings
          SET stock_qty = stock_qty - ?,
              out_of_stock_since = CASE
                WHEN stock_qty - ? <= 0 THEN datetime('now')
                ELSE out_of_stock_since
              END,
              restock_notice_sent_at = CASE
                WHEN stock_qty - ? <= 0 THEN restock_notice_sent_at
                ELSE NULL
              END
        WHERE id = ? AND stock_qty IS NOT NULL AND stock_qty >= ?`,
      [qty, qty, qty, listingId, qty],
      nativeDB,
    )
  } catch (err) {
    console.error("[stockManagement] decrementStock failed:", err)
  }
}

/**
 * Restores stock_qty by qty (order cancelled/reversed/refunded before
 * fulfillment). Clears out_of_stock_since and restock_notice_sent_at
 * whenever the restore brings stock back above 0, since the listing is
 * no longer eligible for auto-delete.
 */
export async function restoreStock(
  listingId: string,
  qty: number,
  nativeDB?: unknown,
): Promise<void> {
  if (!listingId || !qty || qty <= 0) return
  try {
    await d1Query(
      `UPDATE listings
          SET stock_qty = stock_qty + ?,
              out_of_stock_since = CASE
                WHEN stock_qty + ? > 0 THEN NULL
                ELSE out_of_stock_since
              END,
              restock_notice_sent_at = CASE
                WHEN stock_qty + ? > 0 THEN NULL
                ELSE restock_notice_sent_at
              END
        WHERE id = ? AND stock_qty IS NOT NULL`,
      [qty, qty, qty, listingId],
      nativeDB,
    )
  } catch (err) {
    console.error("[stockManagement] restoreStock failed:", err)
  }
}
