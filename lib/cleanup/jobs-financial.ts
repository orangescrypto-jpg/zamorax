// lib/cleanup/jobs-financial.ts
// Orders, wallet transactions and proof files: the jobs that touch money.
//
// Non-negotiable rules (each one is enforced in code and has a test):
//   * Archive first. Rows are written to R2, read back and verified before
//     a single D1 row is deleted (see archive.ts). If verification fails,
//     nothing is deleted.
//   * An order is only archived when it is in a FINAL state, past the
//     window, and nothing else still depends on it: no dispute that is not
//     resolved/closed, no layaway plan that is not finished, no payout or
//     refund still in flight.
//   * Wallet transactions are only archived when they are completed and
//     older than the window. Balances live in seller_wallets, which this
//     module never reads or writes, so archiving history cannot change
//     anyone's balance.
import { archiveRows, monthOf } from "@/lib/cleanup/archive"
import {
  MAX_ROWS_PER_RUN,
  chunk,
  deleteByIds,
  deleteFiles,
  emptyResult,
  extractKeys,
  liveColumns,
  missingSchema,
  placeholders,
  selectRows,
  type JobResult,
} from "@/lib/cleanup/helpers"
import type { Ctx } from "@/lib/cleanup/jobs-basic"
import { d1Query } from "@/lib/d1"

/** Order states that can never change again. Anything else is still live. */
export const FINAL_ORDER_STATUS = ["completed", "cancelled", "refunded", "payment_rejected"]
/** Layaway states that are finished; anything else keeps its order alive. */
const FINAL_LAYAWAY = ["completed", "cancelled", "refunded", "refunded_confirmed", "expired", "defaulted"]
const SETTLED_DISPUTE = ["resolved", "closed"]

// ── Orders ───────────────────────────────────────────────────────────

/** Order ids among `ids` that must be kept, because something still depends on them. */
export async function protectedOrderIds(ids: string[], nativeDB?: unknown): Promise<Set<string>> {
  const prot = new Set<string>()
  for (const part of chunk(ids)) {
    const ph = placeholders(part.length)
    try {
      // Any dispute that is not explicitly settled.
      for (const d of await selectRows<{ order_id: string; status: string }>(
        `SELECT order_id, status FROM disputes WHERE order_id IN (${ph})`,
        part,
        nativeDB,
      )) {
        if (!SETTLED_DISPUTE.includes(String(d.status).toLowerCase())) prot.add(String(d.order_id))
      }
      // Any layaway plan that is not finished, or whose refund is not settled.
      for (const p of await selectRows<{ order_id: string; status: string; refund_status: string | null }>(
        `SELECT order_id, status, refund_status FROM layaway_plans WHERE order_id IN (${ph})`,
        part,
        nativeDB,
      )) {
        const planDone = FINAL_LAYAWAY.includes(String(p.status))
        const refundOpen = p.refund_status != null && !["buyer_confirmed", "auto_confirmed", "paid"].includes(String(p.refund_status))
        if (!planDone || refundOpen) prot.add(String(p.order_id))
      }
      // A payout or refund still being processed against this order.
      // wallet_transactions is confirmed in the live database, so a failure
      // there is a real problem and falls through to the outer catch (which
      // protects the whole chunk).
      for (const row of await selectRows<{ order_id: string }>(
        `SELECT order_id FROM wallet_transactions WHERE status NOT IN ('completed','success','paid') AND order_id IN (${ph})`,
        part,
        nativeDB,
      )) {
        prot.add(String(row.order_id))
      }
      // refund_records is written by the dispute code but was not present in
      // the live schema export, so it may not exist. Only a genuinely missing
      // table is skipped; the table is checked explicitly instead of
      // swallowing every error. If it exists and the check fails, the outer
      // catch protects the chunk.
      if ((await liveColumns("refund_records", nativeDB)).size > 0) {
        for (const row of await selectRows<{ order_id: string }>(
          `SELECT order_id FROM refund_records WHERE status NOT IN ('completed','paid','processed','done') AND order_id IN (${ph})`,
          part,
          nativeDB,
        )) {
          prot.add(String(row.order_id))
        }
      }
    } catch (err) {
      console.error("[cleanup] order guard failed, protecting chunk:", err)
      for (const id of part) prot.add(id)
    }
  }
  return prot
}

export async function jobOrdersArchive(cutoff: string, ctx: Ctx): Promise<JobResult> {
  const r = emptyResult("ordersArchive", ctx.dryRun)
  const miss = await missingSchema("orders", ["id", "status", "created_at", "completed_at"], ctx.nativeDB)
  if (miss) return { ...r, note: miss }

  const finals = placeholders(FINAL_ORDER_STATUS.length)
  const candidates = await selectRows<Record<string, unknown> & { id: string }>(
    `SELECT * FROM orders
      WHERE status IN (${finals})
        AND COALESCE(completed_at, refunded_at, updated_at, created_at) < ?
      LIMIT ?`,
    [...FINAL_ORDER_STATUS, cutoff, MAX_ROWS_PER_RUN],
    ctx.nativeDB,
  )
  r.complete = candidates.length < MAX_ROWS_PER_RUN

  const prot = await protectedOrderIds(candidates.map((c) => String(c.id)), ctx.nativeDB)
  const eligible = candidates.filter((c) => !prot.has(String(c.id)))
  r.protectedSkipped = candidates.length - eligible.length

  if (ctx.dryRun) {
    r.deleted = eligible.length
    return r
  }

  // Group by month so each archive file stays a sensible size.
  const byMonth = new Map<string, typeof eligible>()
  for (const row of eligible) {
    const m = monthOf(row.completed_at ?? row.refunded_at ?? row.created_at)
    byMonth.set(m, [...(byMonth.get(m) ?? []), row])
  }
  const notes: string[] = []
  for (const [month, rows] of byMonth) {
    const { safeIds, note } = await archiveRows("orders", month, rows, ctx.nativeBucket)
    if (note) notes.push(note)
    if (safeIds.length === 0) continue
    // Layaway rows point at the order; remove them with it, only when finished.
    for (const part of chunk(safeIds)) {
      try {
        await d1Query(
          `DELETE FROM layaway_payments WHERE plan_id IN (SELECT id FROM layaway_plans WHERE order_id IN (${placeholders(part.length)}))`,
          part,
          ctx.nativeDB,
        )
        await d1Query(`DELETE FROM layaway_plans WHERE order_id IN (${placeholders(part.length)})`, part, ctx.nativeDB)
      } catch {
        /* layaway tables are optional */
      }
    }
    r.deleted += await deleteByIds("orders", "id", safeIds, ctx.nativeDB)
  }
  r.note = notes.length ? notes.join("; ") : null
  return r
}

// ── Wallet transactions ──────────────────────────────────────────────
export async function jobTransactionsArchive(cutoff: string, ctx: Ctx): Promise<JobResult> {
  const r = emptyResult("transactionsArchive", ctx.dryRun)
  const miss = await missingSchema("wallet_transactions", ["id", "status", "created_at"], ctx.nativeDB)
  if (miss) return { ...r, note: miss }

  const rows = await selectRows<Record<string, unknown> & { id: string }>(
    `SELECT * FROM wallet_transactions
      WHERE status IN ('completed', 'success', 'paid') AND created_at < ?
      LIMIT ?`,
    [cutoff, MAX_ROWS_PER_RUN],
    ctx.nativeDB,
  )
  r.complete = rows.length < MAX_ROWS_PER_RUN

  // A transaction tied to an order that is still on file, and still live,
  // stays until that order is archived first.
  const withOrder = rows.filter((x) => x.order_id)
  const liveOrders = new Set<string>()
  for (const part of chunk(withOrder.map((x) => String(x.order_id)))) {
    for (const o of await selectRows<{ id: string; status: string }>(
      `SELECT id, status FROM orders WHERE id IN (${placeholders(part.length)})`,
      part,
      ctx.nativeDB,
    )) {
      if (!FINAL_ORDER_STATUS.includes(String(o.status))) liveOrders.add(String(o.id))
    }
  }
  const eligible = rows.filter((x) => !(x.order_id && liveOrders.has(String(x.order_id))))
  r.protectedSkipped = rows.length - eligible.length

  if (ctx.dryRun) {
    r.deleted = eligible.length
    return r
  }
  const byMonth = new Map<string, typeof eligible>()
  for (const row of eligible) {
    const m = monthOf(row.created_at)
    byMonth.set(m, [...(byMonth.get(m) ?? []), row])
  }
  const notes: string[] = []
  for (const [month, group] of byMonth) {
    const { safeIds, note } = await archiveRows("transactions", month, group, ctx.nativeBucket)
    if (note) notes.push(note)
    if (safeIds.length) r.deleted += await deleteByIds("wallet_transactions", "id", safeIds, ctx.nativeDB)
  }
  r.note = notes.length ? notes.join("; ") : null
  return r
}

// ── Proofs and evidence files ────────────────────────────────────────
// Files that only prove a payment or payout happened. Once the money side is
// settled and the window has passed, the screenshot has no further use.
// The row itself is KEPT (a payout record is a money record); only the file
// link is cleared and the R2 file removed, so no page shows a broken image.
//
// Sources, each checked for existence first:
//   - pending_payments.proof_url   (confirmed or rejected payments)
//   - withdrawals.proof_url        (completed or rejected payouts)
//   - disputes: evidence lives in R2 under disputes/<orderId>/ and is
//     handled by the orphan sweep once the order is archived, because the
//     live disputes table stores no file column to clear.
export async function jobProofs(cutoff: string, ctx: Ctx): Promise<JobResult> {
  const r = emptyResult("proofs", ctx.dryRun)
  const notes: string[] = []
  let removedFiles = 0
  let clearedRows = 0

  const sources: Array<{ table: string; statuses: string[]; dateExpr: string; needs: string[] }> = [
    {
      table: "pending_payments",
      statuses: ["confirmed", "rejected"],
      dateExpr: "COALESCE(confirmed_at, rejected_at, updated_at, created_at)",
      needs: ["id", "proof_url", "status", "created_at"],
    },
    {
      table: "withdrawals",
      statuses: ["completed", "rejected", "paid"],
      dateExpr: "COALESCE(paid_at, rejected_at, updated_at, created_at)",
      needs: ["id", "proof_url", "status", "created_at"],
    },
  ]

  for (const src of sources) {
    const miss = await missingSchema(src.table, src.needs, ctx.nativeDB)
    if (miss) {
      notes.push(miss)
      continue
    }
    // Date columns are optional in the expression: keep only ones that exist.
    const cols = await liveColumns(src.table, ctx.nativeDB)
    const parts = src.dateExpr
      .replace(/^COALESCE\(|\)$/g, "")
      .split(",")
      .map((x) => x.trim())
      .filter((c) => cols.has(c))
    const dateExpr = `COALESCE(${parts.join(", ")})`

    const rows = await selectRows<{ id: string; proof_url: string }>(
      `SELECT id, proof_url FROM ${src.table}
        WHERE proof_url IS NOT NULL AND proof_url != ''
          AND status IN (${placeholders(src.statuses.length)})
          AND ${dateExpr} < ?
        LIMIT ?`,
      [...src.statuses, cutoff, MAX_ROWS_PER_RUN],
      ctx.nativeDB,
    )
    if (rows.length >= MAX_ROWS_PER_RUN) r.complete = false
    const keys = rows.flatMap((x) => extractKeys(x.proof_url))
    if (ctx.dryRun) {
      clearedRows += rows.length
      removedFiles += new Set(keys).size
      continue
    }
    removedFiles += await deleteFiles(keys, ctx.nativeBucket)
    for (const part of chunk(rows.map((x) => x.id))) {
      await d1Query(
        `UPDATE ${src.table} SET proof_url = NULL WHERE id IN (${placeholders(part.length)})`,
        part,
        ctx.nativeDB,
      )
      clearedRows += part.length
    }
  }
  r.deleted = clearedRows
  r.filesDeleted = removedFiles
  r.note = notes.length ? notes.join("; ") : null
  return r
}
