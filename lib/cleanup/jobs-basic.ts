// lib/cleanup/jobs-basic.ts
// The non-financial jobs. Each takes (cutoffIso, ctx) and returns a JobResult.
// Common pattern: SELECT candidate ids (bounded) -> apply safety rules ->
// delete exactly those ids. `dryRun` reports what WOULD happen and changes nothing.
import {
  MAX_ROWS_PER_RUN,
  deleteByIds,
  deleteFiles,
  emptyResult,
  extractKeys,
  missingSchema,
  selectRows,
  type JobResult,
} from "@/lib/cleanup/helpers"
import { d1Query } from "@/lib/d1"

export interface Ctx {
  nativeDB?: unknown
  nativeBucket?: unknown
  dryRun: boolean
  /** ISO timestamp for "now" (injectable for tests). */
  nowIso: string
}

// ── 1 & 2. Notifications ─────────────────────────────────────────────
export async function jobNotificationsRead(cutoff: string, ctx: Ctx): Promise<JobResult> {
  const r = emptyResult("notificationsRead", ctx.dryRun)
  const miss = await missingSchema("notifications", ["id", "is_read", "created_at"], ctx.nativeDB)
  if (miss) return { ...r, note: miss }
  const rows = await selectRows<{ id: string }>(
    `SELECT id FROM notifications WHERE is_read = 1 AND created_at < ? LIMIT ?`,
    [cutoff, MAX_ROWS_PER_RUN],
    ctx.nativeDB,
  )
  r.complete = rows.length < MAX_ROWS_PER_RUN
  r.deleted = ctx.dryRun ? rows.length : await deleteByIds("notifications", "id", rows.map((x) => x.id), ctx.nativeDB)
  return r
}

export async function jobNotificationsUnread(cutoff: string, ctx: Ctx): Promise<JobResult> {
  const r = emptyResult("notificationsUnread", ctx.dryRun)
  const miss = await missingSchema("notifications", ["id", "is_read", "created_at"], ctx.nativeDB)
  if (miss) return { ...r, note: miss }
  const rows = await selectRows<{ id: string }>(
    `SELECT id FROM notifications WHERE is_read = 0 AND created_at < ? LIMIT ?`,
    [cutoff, MAX_ROWS_PER_RUN],
    ctx.nativeDB,
  )
  r.complete = rows.length < MAX_ROWS_PER_RUN
  r.deleted = ctx.dryRun ? rows.length : await deleteByIds("notifications", "id", rows.map((x) => x.id), ctx.nativeDB)
  return r
}

// ── 3. Messages ──────────────────────────────────────────────────────
// A message is only removed when its chat is NOT protected. A chat is
// protected when it has an open dispute or an order that is not finished.
// Protected chats are detected through the chat's listing + buyer/seller
// pair, because the live chats table has no order_id column.
// A dispute only stops protecting a chat once it is explicitly resolved or
// closed. Any other status, including one this code has never seen, is
// treated as still open: when unsure, keep the conversation.
const SETTLED_DISPUTE = ["resolved", "closed"]
const FINISHED_ORDER = ["completed", "cancelled", "refunded", "payment_rejected"]

export async function protectedChatIds(chatIds: string[], nativeDB?: unknown): Promise<Set<string>> {
  const prot = new Set<string>()
  if (chatIds.length === 0) return prot
  for (let i = 0; i < chatIds.length; i += 80) {
    const part = chatIds.slice(i, i + 80)
    const ph = part.map(() => "?").join(", ")
    const chats = await selectRows<{ id: string; buyer_id: string; seller_id: string; listing_id: string | null }>(
      `SELECT id, buyer_id, seller_id, listing_id FROM chats WHERE id IN (${ph})`,
      part,
      nativeDB,
    )
    for (const c of chats) {
      // Unfinished order between this buyer and seller (for this listing when known).
      const orderRows = await selectRows<{ id: string; status: string }>(
        c.listing_id
          ? `SELECT id, status FROM orders WHERE buyer_id = ? AND seller_id = ? AND listing_id = ? LIMIT 50`
          : `SELECT id, status FROM orders WHERE buyer_id = ? AND seller_id = ? LIMIT 50`,
        c.listing_id ? [c.buyer_id, c.seller_id, c.listing_id] : [c.buyer_id, c.seller_id],
        nativeDB,
      )
      const unfinished = orderRows.some((o) => !FINISHED_ORDER.includes(String(o.status)))
      if (unfinished) {
        prot.add(c.id)
        continue
      }
      // Open dispute on any of their orders.
      const oids = orderRows.map((o) => o.id)
      if (oids.length) {
        const dph = oids.map(() => "?").join(", ")
        const disp = await selectRows<{ status: string }>(
          `SELECT status FROM disputes WHERE order_id IN (${dph}) LIMIT 20`,
          oids,
          nativeDB,
        )
        if (disp.some((d) => !SETTLED_DISPUTE.includes(String(d.status).toLowerCase()))) {
          prot.add(c.id)
        }
      }
    }
  }
  return prot
}

export async function jobMessages(cutoff: string, ctx: Ctx): Promise<JobResult> {
  const r = emptyResult("messages", ctx.dryRun)
  const miss = await missingSchema("messages", ["id", "chat_id", "created_at"], ctx.nativeDB)
  if (miss) return { ...r, note: miss }
  const rows = await selectRows<{ id: string; chat_id: string }>(
    `SELECT id, chat_id FROM messages WHERE created_at < ? LIMIT ?`,
    [cutoff, MAX_ROWS_PER_RUN],
    ctx.nativeDB,
  )
  r.complete = rows.length < MAX_ROWS_PER_RUN
  const prot = await protectedChatIds([...new Set(rows.map((x) => x.chat_id))], ctx.nativeDB)
  const deletable = rows.filter((x) => !prot.has(x.chat_id))
  r.protectedSkipped = rows.length - deletable.length
  r.deleted = ctx.dryRun ? deletable.length : await deleteByIds("messages", "id", deletable.map((x) => x.id), ctx.nativeDB)
  return r
}

// ── 4. Chats ─────────────────────────────────────────────────────────
// A chat goes when it has NO messages left, or has been silent past the
// cutoff, and is not protected. Its remaining messages go with it.
export async function jobChats(cutoff: string, ctx: Ctx): Promise<JobResult> {
  const r = emptyResult("chats", ctx.dryRun)
  const miss = (await missingSchema("chats", ["id", "buyer_id", "seller_id", "created_at"], ctx.nativeDB)) ||
    (await missingSchema("messages", ["id", "chat_id"], ctx.nativeDB))
  if (miss) return { ...r, note: miss }
  const rows = await selectRows<{ id: string }>(
    `SELECT c.id FROM chats c
      WHERE COALESCE(c.last_message_at, c.updated_at, c.created_at) < ?
      LIMIT ?`,
    [cutoff, MAX_ROWS_PER_RUN],
    ctx.nativeDB,
  )
  r.complete = rows.length < MAX_ROWS_PER_RUN
  const prot = await protectedChatIds(rows.map((x) => x.id), ctx.nativeDB)
  const deletable = rows.filter((x) => !prot.has(x.id)).map((x) => x.id)
  r.protectedSkipped = rows.length - deletable.length
  if (!ctx.dryRun) {
    // Offers hang off chats; detach them so nothing points at a deleted chat.
    for (let i = 0; i < deletable.length; i += 80) {
      const part = deletable.slice(i, i + 80)
      const ph = part.map(() => "?").join(", ")
      await d1Query(`DELETE FROM messages WHERE chat_id IN (${ph})`, part, ctx.nativeDB)
    }
    r.deleted = await deleteByIds("chats", "id", deletable, ctx.nativeDB)
  } else {
    r.deleted = deletable.length
  }
  return r
}

// ── 5. Offers ────────────────────────────────────────────────────────
// Expired, rejected, or old accepted offers. A pending offer that has not
// yet expired is never touched.
export async function jobOffers(cutoff: string, ctx: Ctx): Promise<JobResult> {
  const r = emptyResult("offers", ctx.dryRun)
  const miss = await missingSchema("offers", ["id", "status", "created_at"], ctx.nativeDB)
  if (miss) return { ...r, note: miss }
  const rows = await selectRows<{ id: string; status: string }>(
    `SELECT id, status FROM offers
      WHERE created_at < ?
        AND (status IN ('expired', 'rejected', 'declined', 'cancelled', 'accepted', 'countered')
             OR (status = 'pending' AND expires_at IS NOT NULL AND expires_at < ?))
      LIMIT ?`,
    [cutoff, ctx.nowIso, MAX_ROWS_PER_RUN],
    ctx.nativeDB,
  )
  r.complete = rows.length < MAX_ROWS_PER_RUN
  r.deleted = ctx.dryRun ? rows.length : await deleteByIds("offers", "id", rows.map((x) => x.id), ctx.nativeDB)
  return r
}

// ── 13. Rate limits ──────────────────────────────────────────────────
// Uses only window_start (confirmed present in the live table). window_start
// is a unix-seconds integer; anything older than the cutoff is past its window.
export async function jobRateLimits(cutoff: string, ctx: Ctx): Promise<JobResult> {
  const r = emptyResult("rateLimits", ctx.dryRun)
  const miss = await missingSchema("rate_limits", ["bucket_key", "window_start"], ctx.nativeDB)
  if (miss) return { ...r, note: miss }
  const cutoffSec = Math.floor(new Date(cutoff).getTime() / 1000)
  const cnt = await selectRows<{ n: number }>(
    `SELECT COUNT(*) AS n FROM rate_limits WHERE window_start < ?`,
    [cutoffSec],
    ctx.nativeDB,
  )
  const n = Number(cnt[0]?.n ?? 0)
  r.deleted = n
  if (!ctx.dryRun && n > 0) {
    // One bounded statement: the table has a composite PK, no id to list.
    await d1Query(
      `DELETE FROM rate_limits WHERE rowid IN (SELECT rowid FROM rate_limits WHERE window_start < ? LIMIT ?)`,
      [cutoffSec, MAX_ROWS_PER_RUN],
      ctx.nativeDB,
    )
    r.deleted = Math.min(n, MAX_ROWS_PER_RUN)
    r.complete = n <= MAX_ROWS_PER_RUN
  }
  return r
}

// ── 10. Abandoned payment attempts ───────────────────────────────────
// Only attempts that never became a confirmed payment. Their proof files go too.
export async function jobPendingPayments(cutoff: string, ctx: Ctx): Promise<JobResult> {
  const r = emptyResult("pendingPayments", ctx.dryRun)
  const miss = await missingSchema("pending_payments", ["id", "status", "created_at", "proof_url"], ctx.nativeDB)
  if (miss) return { ...r, note: miss }
  const rows = await selectRows<{ id: string; proof_url: string | null }>(
    `SELECT id, proof_url FROM pending_payments
      WHERE created_at < ?
        AND admin_confirmed = 0
        AND status IN ('pending', 'awaiting_transfer', 'rejected', 'failed', 'abandoned', 'cancelled', 'expired')
      LIMIT ?`,
    [cutoff, MAX_ROWS_PER_RUN],
    ctx.nativeDB,
  )
  r.complete = rows.length < MAX_ROWS_PER_RUN
  const keys = rows.flatMap((x) => extractKeys(x.proof_url))
  if (ctx.dryRun) {
    r.deleted = rows.length
    r.filesDeleted = new Set(keys).size
    return r
  }
  r.filesDeleted = await deleteFiles(keys, ctx.nativeBucket)
  r.deleted = await deleteByIds("pending_payments", "id", rows.map((x) => x.id), ctx.nativeDB)
  return r
}

// ── 11. Resolved reports ─────────────────────────────────────────────
export async function jobReports(cutoff: string, ctx: Ctx): Promise<JobResult> {
  const r = emptyResult("reports", ctx.dryRun)
  let total = 0
  const notes: string[] = []
  for (const table of ["reports", "listing_reports"]) {
    const miss = await missingSchema(table, ["id", "status", "created_at"], ctx.nativeDB)
    if (miss) {
      notes.push(miss)
      continue
    }
    const rows = await selectRows<{ id: string }>(
      `SELECT id FROM ${table}
        WHERE created_at < ? AND status IN ('resolved', 'dismissed', 'closed', 'reviewed', 'actioned', 'rejected')
        LIMIT ?`,
      [cutoff, MAX_ROWS_PER_RUN],
      ctx.nativeDB,
    )
    if (rows.length >= MAX_ROWS_PER_RUN) r.complete = false
    total += ctx.dryRun ? rows.length : await deleteByIds(table, "id", rows.map((x) => x.id), ctx.nativeDB)
  }
  r.deleted = total
  r.note = notes.length ? notes.join("; ") : null
  return r
}

// ── 12. Ended boosts and inactive banners ────────────────────────────
export async function jobBoostsAndBanners(cutoff: string, ctx: Ctx): Promise<JobResult> {
  const r = emptyResult("boostsAndBanners", ctx.dryRun)
  const notes: string[] = []
  let deleted = 0
  let files = 0

  // boosts uses boost_ends_at; adBoosts uses expires_at (live schema).
  const boostSpecs: Array<{ table: string; col: string }> = [
    { table: "boosts", col: "boost_ends_at" },
    { table: "adBoosts", col: "expires_at" },
  ]
  for (const { table, col } of boostSpecs) {
    const miss = await missingSchema(table, ["id", col, "status"], ctx.nativeDB)
    if (miss) {
      notes.push(miss)
      continue
    }
    const rows = await selectRows<{ id: string }>(
      `SELECT id FROM ${table} WHERE ${col} IS NOT NULL AND ${col} < ? AND status != 'active' LIMIT ?`,
      [cutoff, MAX_ROWS_PER_RUN],
      ctx.nativeDB,
    )
    if (rows.length >= MAX_ROWS_PER_RUN) r.complete = false
    deleted += ctx.dryRun ? rows.length : await deleteByIds(table, "id", rows.map((x) => x.id), ctx.nativeDB)
  }

  // Inactive featured banners (column is `active`, not `is_active`).
  const missB = await missingSchema("featured_banners", ["id", "active", "image_url", "created_at"], ctx.nativeDB)
  if (missB) notes.push(missB)
  else {
    const banners = await selectRows<{ id: string; image_url: string | null }>(
      `SELECT id, image_url FROM featured_banners WHERE active = 0 AND COALESCE(updated_at, created_at) < ? LIMIT ?`,
      [cutoff, MAX_ROWS_PER_RUN],
      ctx.nativeDB,
    )
    if (banners.length >= MAX_ROWS_PER_RUN) r.complete = false
    if (ctx.dryRun) {
      deleted += banners.length
      files += new Set(banners.flatMap((b) => extractKeys(b.image_url))).size
    } else {
      files += await deleteFiles(banners.flatMap((b) => extractKeys(b.image_url)), ctx.nativeBucket)
      deleted += await deleteByIds("featured_banners", "id", banners.map((b) => b.id), ctx.nativeDB)
    }
  }
  r.deleted = deleted
  r.filesDeleted = files
  r.note = notes.length ? notes.join("; ") : null
  return r
}
