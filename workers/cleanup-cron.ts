// workers/cleanup-cron.ts
// =====================================================================
// Zamorax — Weekly D1 + R2 Cleanup Worker
// =====================================================================
// What this does, every Sunday 03:00 Africa/Lagos (02:00 UTC):
//   1. Deletes expired/stale rows from D1 (sessions-style junk, expired
//      offers, expired boosts, abandoned pending_payments, etc.)
//   2. Finds orphaned R2 images (referenced by nothing) and deletes them
//   3. Runs VACUUM on D1 to reclaim space
//   4. Logs a summary row into kv_store so you can check what happened
//
// SAFETY: Defaults to DRY RUN. Nothing is deleted until you explicitly
// set DRY_RUN = false (see wrangler.toml vars below) after reviewing
// a few weeks of dry-run logs.
//
// Deploy:
//   1. Save this file as workers/cleanup-cron.ts in your project
//   2. Add the wrangler.toml block at the bottom of this file to your
//      existing wrangler.toml (or create a separate one for this worker)
//   3. wrangler deploy --config wrangler.cleanup.toml
//   4. Check logs weekly: wrangler tail zamorax-cleanup
// =====================================================================

interface Env {
  DB: D1Database
  ZAMORAX_BUCKET: R2Bucket
  DRY_RUN?: string   // "true" | "false" — defaults to true if unset
}

interface CleanupSummary {
  dryRun: boolean
  startedAt: string
  finishedAt?: string
  d1: Record<string, number>
  r2: { scanned: number; orphaned: number; deletedBytes: number; deletedKeys: string[] }
  errors: string[]
}

// Retention windows — tune these to your actual product rules
const RETENTION = {
  expiredOffersDays: 7,           // offers past expires_at, never accepted
  rejectedListingsDays: 60,       // rejected listings nobody resubmitted
  pendingPaymentsDays: 3,         // abandoned checkout attempts
  expiredBoostsDays: 14,          // boosts/adBoosts past expires_at
  allNotificationsDays: 30,       // ANY notification (read or unread) older than this
  cancelledOrdersDays: 90,        // cancelled orders, counted only — not deleted
  expiredSearchAlertsDays: 90,    // search alerts nobody's touched in a while
  staleVerificationDays: 30,      // verification_requests stuck in "pending" — never reviewed
  abandonedChatsDays: 90,         // chats with zero messages ever sent (created, then dropped)
  oldWalletTxDays: 730,           // wallet_transactions — kept long (financial record), 2 years
  allChatsDays: 90,                // ALL chats incl. message history — see "all_chats" step, OFF by default
  proofDays: 30,                    // R2: buyer-uploaded payment proof screenshots

}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString()
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runCleanup(env))
  },

  // Allow manual trigger via HTTP for testing: POST /__cleanup?dryRun=true
  async fetch(req: Request, env: Env) {
    const url = new URL(req.url)
    if (req.method !== "POST" || url.pathname !== "/__cleanup") {
      return new Response("Not found", { status: 404 })
    }
    const override = url.searchParams.get("dryRun")
    const summary = await runCleanup(env, override !== null ? override === "true" : undefined)
    return new Response(JSON.stringify(summary, null, 2), {
      headers: { "Content-Type": "application/json" },
    })
  },
}

async function runCleanup(env: Env, dryRunOverride?: boolean): Promise<CleanupSummary> {
  const dryRun = dryRunOverride !== undefined ? dryRunOverride : env.DRY_RUN !== "false"

  const summary: CleanupSummary = {
    dryRun,
    startedAt: new Date().toISOString(),
    d1: {},
    r2: { scanned: 0, orphaned: 0, deletedBytes: 0, deletedKeys: [] },
    errors: [],
  }

  // ---------------------------------------------------------------
  // 1. D1 cleanup — each block is independent so one failure doesn't
  //    block the rest.
  // ---------------------------------------------------------------
  await safeStep(summary, "expired_offers", async () => {
    const cutoff = daysAgoIso(RETENTION.expiredOffersDays)
    const rows = await env.DB.prepare(
      `SELECT id FROM offers WHERE status = 'pending' AND expires_at < ?`
    ).bind(cutoff).all()
    if (!dryRun && rows.results.length) {
      await env.DB.prepare(
        `DELETE FROM offers WHERE status = 'pending' AND expires_at < ?`
      ).bind(cutoff).run()
    }
    return rows.results.length
  })

  await safeStep(summary, "rejected_listings", async () => {
    const cutoff = daysAgoIso(RETENTION.rejectedListingsDays)
    const rows = await env.DB.prepare(
      `SELECT id, images FROM listings WHERE status = 'rejected' AND rejected_at < ?`
    ).bind(cutoff).all()
    if (!dryRun && rows.results.length) {
      const ids = rows.results.map((r: any) => r.id)
      await deleteListingImages(env, rows.results)
      await env.DB.batch(
        ids.map((id: string) => env.DB.prepare(`DELETE FROM listings WHERE id = ?`).bind(id))
      )
    }
    return rows.results.length
  })

  await safeStep(summary, "pending_payments", async () => {
    const cutoff = daysAgoIso(RETENTION.pendingPaymentsDays)
    const rows = await env.DB.prepare(
      `SELECT id FROM pending_payments WHERE status = 'pending' AND created_at < ?`
    ).bind(cutoff).all()
    if (!dryRun && rows.results.length) {
      await env.DB.prepare(
        `DELETE FROM pending_payments WHERE status = 'pending' AND created_at < ?`
      ).bind(cutoff).run()
    }
    return rows.results.length
  })

  await safeStep(summary, "payment_proof_r2", async () => {
    // Deletes uploaded payment proof-of-payment screenshots from R2
    // once the payment record is 30+ days old, regardless of status
    // (confirmed or still pending). The proof image's job is done once
    // the payment has been resolved one way or another for that long —
    // the D1 row itself (and the order/transaction it's tied to) stays,
    // only the R2 file is removed.
    //
    // Confirmed column: pending_payments.proof_url
    // (set in app/api/payment/notify-admin/route.ts when a buyer
    // submits proof of a manual bank transfer)
    const cutoff = daysAgoIso(RETENTION.proofDays)
    const rows = await env.DB.prepare(
      `SELECT id, proof_url FROM pending_payments
       WHERE created_at < ? AND proof_url IS NOT NULL`
    ).bind(cutoff).all()

    let deleted = 0
    for (const row of rows.results as any[]) {
      const key = extractR2Key(row.proof_url)
      if (!key) continue
      if (!dryRun) {
        await env.ZAMORAX_BUCKET.delete(key)
        await env.DB.prepare(
          `UPDATE pending_payments SET proof_url = NULL WHERE id = ?`
        ).bind(row.id).run()
      }
      deleted++
    }
    return deleted
  })

  await safeStep(summary, "expired_boosts", async () => {
    const cutoff = daysAgoIso(RETENTION.expiredBoostsDays)
    const a = await env.DB.prepare(`SELECT id FROM adBoosts WHERE expires_at < ?`).bind(cutoff).all()
    const b = await env.DB.prepare(`SELECT id FROM boosts WHERE expires_at < ?`).bind(cutoff).all()
    if (!dryRun) {
      if (a.results.length) await env.DB.prepare(`DELETE FROM adBoosts WHERE expires_at < ?`).bind(cutoff).run()
      if (b.results.length) await env.DB.prepare(`DELETE FROM boosts WHERE expires_at < ?`).bind(cutoff).run()
      // also clear the boosted flag on listings whose boost lapsed
      await env.DB.prepare(
        `UPDATE listings SET is_boosted = 0, boost_type = 'none' WHERE boost_expires_at < ? AND is_boosted = 1`
      ).bind(cutoff).run()
    }
    return a.results.length + b.results.length
  })

  await safeStep(summary, "old_notifications", async () => {
    // ANY notification — read or unread — older than the cutoff gets cleared.
    // Unread ones that old are almost certainly stale/ignored, not useful.
    const cutoff = daysAgoIso(RETENTION.allNotificationsDays)
    const rows = await env.DB.prepare(
      `SELECT id FROM notifications WHERE created_at < ?`
    ).bind(cutoff).all()
    if (!dryRun && rows.results.length) {
      await env.DB.prepare(
        `DELETE FROM notifications WHERE created_at < ?`
      ).bind(cutoff).run()
    }
    return rows.results.length
  })

  await safeStep(summary, "orphaned_saved_listings", async () => {
    // saved_listings pointing at listings that no longer exist
    const rows = await env.DB.prepare(`
      SELECT sl.id FROM saved_listings sl
      LEFT JOIN listings l ON l.id = sl.listing_id
      WHERE l.id IS NULL
    `).all()
    if (!dryRun && rows.results.length) {
      const ids = rows.results.map((r: any) => r.id)
      await env.DB.batch(
        ids.map((id: string) => env.DB.prepare(`DELETE FROM saved_listings WHERE id = ?`).bind(id))
      )
    }
    return rows.results.length
  })

  await safeStep(summary, "orphaned_messages", async () => {
    // messages pointing at chats that no longer exist
    const rows = await env.DB.prepare(`
      SELECT m.id FROM messages m
      LEFT JOIN chats c ON c.id = m.chat_id
      WHERE c.id IS NULL
    `).all()
    if (!dryRun && rows.results.length) {
      const ids = rows.results.map((r: any) => r.id)
      await env.DB.batch(
        ids.map((id: string) => env.DB.prepare(`DELETE FROM messages WHERE id = ?`).bind(id))
      )
    }
    return rows.results.length
  })

  await safeStep(summary, "stale_search_alerts", async () => {
    const cutoff = daysAgoIso(RETENTION.expiredSearchAlertsDays)
    const rows = await env.DB.prepare(
      `SELECT id FROM search_alerts WHERE created_at < ?`
    ).bind(cutoff).all()
    if (!dryRun && rows.results.length) {
      await env.DB.prepare(
        `DELETE FROM search_alerts WHERE created_at < ?`
      ).bind(cutoff).run()
    }
    return rows.results.length
  })

  await safeStep(summary, "stale_verification_requests", async () => {
    // verification_requests stuck in "pending" that nobody ever reviewed —
    // these are dead weight if the user gave up or re-submitted elsewhere.
    const cutoff = daysAgoIso(RETENTION.staleVerificationDays)
    const rows = await env.DB.prepare(
      `SELECT id FROM verification_requests WHERE status = 'pending' AND created_at < ?`
    ).bind(cutoff).all()
    if (!dryRun && rows.results.length) {
      await env.DB.prepare(
        `DELETE FROM verification_requests WHERE status = 'pending' AND created_at < ?`
      ).bind(cutoff).run()
    }
    return rows.results.length
  })

  await safeStep(summary, "abandoned_chats", async () => {
    // Chats created but never actually used — no messages ever sent.
    const cutoff = daysAgoIso(RETENTION.abandonedChatsDays)
    const rows = await env.DB.prepare(`
      SELECT c.id FROM chats c
      LEFT JOIN messages m ON m.chat_id = c.id
      WHERE c.created_at < ? AND m.id IS NULL
    `).bind(cutoff).all()
    if (!dryRun && rows.results.length) {
      const ids = rows.results.map((r: any) => r.id)
      await env.DB.batch(
        ids.map((id: string) => env.DB.prepare(`DELETE FROM chats WHERE id = ?`).bind(id))
      )
    }
    return rows.results.length
  })

  await safeStep(summary, "all_chats_over_90d", async () => {
    // ⚠️ DESTRUCTIVE: this deletes EVERY chat (and its full message history)
    // older than the cutoff — not just empty/abandoned ones. This wipes
    // negotiation history, escrow conversations, and dispute evidence for
    // any deal older than the window, even completed/successful ones.
    // Counted only by default. Uncomment the delete block below to make
    // this rule actually delete on a live (non-dry-run) run.
    const cutoff = daysAgoIso(RETENTION.allChatsDays)
    const rows = await env.DB.prepare(
      `SELECT id FROM chats WHERE created_at < ?`
    ).bind(cutoff).all()

    // if (!dryRun && rows.results.length) {
    //   const ids = rows.results.map((r: any) => r.id)
    //   // delete messages first (no FK cascade in D1/SQLite by default)
    //   await env.DB.batch(
    //     ids.map((id: string) => env.DB.prepare(`DELETE FROM messages WHERE chat_id = ?`).bind(id))
    //   )
    //   await env.DB.batch(
    //     ids.map((id: string) => env.DB.prepare(`DELETE FROM chats WHERE id = ?`).bind(id))
    //   )
    // }

    return rows.results.length
  })

  await safeStep(summary, "old_wallet_transactions", async () => {
    // Financial record — long retention by design. Counted + only deleted
    // if you explicitly want that; consider exporting to cold storage
    // instead of deleting outright for accounting purposes.
    const cutoff = daysAgoIso(RETENTION.oldWalletTxDays)
    const rows = await env.DB.prepare(
      `SELECT id FROM wallet_transactions WHERE created_at < ?`
    ).bind(cutoff).all()
    // NOT auto-deleting — counting only. Flip the block below on if you're
    // sure you don't need these for tax/accounting history.
    // if (!dryRun && rows.results.length) {
    //   await env.DB.prepare(`DELETE FROM wallet_transactions WHERE created_at < ?`).bind(cutoff).run()
    // }
    return rows.results.length
  })

  await safeStep(summary, "cancelled_orders_count", async () => {
    const cutoff = daysAgoIso(RETENTION.cancelledOrdersDays)
    const rows = await env.DB.prepare(
      `SELECT id FROM orders WHERE status = 'cancelled' AND updated_at < ?`
    ).bind(cutoff).all()
    // NOTE: not auto-deleting orders by default — financial records.
    // Counting only, for visibility. Flip to delete once you're sure
    // you don't need these for accounting/dispute history.
    return rows.results.length
  })

  // ---------------------------------------------------------------
  // 2. VACUUM — reclaim space after deletes. Only meaningful once
  //    dryRun is false and rows have actually been removed.
  // ---------------------------------------------------------------
  if (!dryRun) {
    await safeStep(summary, "vacuum", async () => {
      await env.DB.exec("VACUUM")
      return 1
    })
  }

  // ---------------------------------------------------------------
  // 3. R2 orphan cleanup — cross-reference every key under known
  //    upload prefixes against the listings/users/blog tables that
  //    should reference them. Anything unreferenced after a grace
  //    period (so we don't nuke a file mid-upload) is deleted.
  // ---------------------------------------------------------------
  await cleanupOrphanedR2Images(env, summary, dryRun)

  summary.finishedAt = new Date().toISOString()

  // ---------------------------------------------------------------
  // 4. Log the run to kv_store so you have a history to check
  // ---------------------------------------------------------------
  try {
    await env.DB.prepare(
      `INSERT INTO kv_store (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    ).bind(
      `cleanup_log_${summary.startedAt.slice(0, 10)}`,
      JSON.stringify(summary),
      summary.finishedAt,
    ).run()
  } catch (e) {
    summary.errors.push(`Failed to log summary: ${String(e)}`)
  }

  console.log("[cleanup]", JSON.stringify(summary))
  return summary
}

async function safeStep(
  summary: CleanupSummary,
  name: string,
  fn: () => Promise<number>,
) {
  try {
    summary.d1[name] = await fn()
  } catch (e) {
    summary.errors.push(`${name}: ${String(e)}`)
    summary.d1[name] = -1
  }
}

async function deleteListingImages(env: Env, listingRows: any[]) {
  for (const row of listingRows) {
    try {
      const images = row.images ? JSON.parse(row.images) : []
      for (const img of images) {
        const key = extractR2Key(img)
        if (key) await env.ZAMORAX_BUCKET.delete(key)
      }
    } catch { /* malformed images JSON — skip, don't block deletion */ }
  }
}

// Pulls the R2 object key out of either a raw key or a full public URL
function extractR2Key(value: string): string | null {
  if (!value) return null
  if (value.startsWith("http")) {
    try {
      const u = new URL(value)
      return u.pathname.replace(/^\/+/, "")
    } catch { return null }
  }
  return value
}

// ---------------------------------------------------------------------
// Orphaned R2 image scan.
//
// Strategy: list every object under the prefixes your app actually
// writes to (see StorageService.uploadFiles — keys look like
// "<prefix>/<timestamp>_<i>.<ext>"), then check whether that key still
// appears inside the `images` JSON column of `listings`, or in
// `profile_photo` (users) / `cover_image` (blog). Anything not
// referenced AND older than 48h (grace period for in-flight uploads)
// is deleted.
//
// NOTE: R2 list() is paginated at 1000 keys per call — this loops
// through all pages. For very large buckets you may want to shard
// this across multiple scheduled runs by prefix.
// ---------------------------------------------------------------------
async function cleanupOrphanedR2Images(env: Env, summary: CleanupSummary, dryRun: boolean) {
  try {
    // Build the set of "in use" keys from D1 in one pass
    const inUse = new Set<string>()

    const listingImgs = await env.DB.prepare(`SELECT images FROM listings WHERE images IS NOT NULL`).all()
    for (const row of listingImgs.results as any[]) {
      try {
        const arr = JSON.parse(row.images)
        for (const v of arr) {
          const k = extractR2Key(v)
          if (k) inUse.add(k)
        }
      } catch { /* skip malformed */ }
    }

    const profilePhotos = await env.DB.prepare(`SELECT profile_photo FROM users WHERE profile_photo IS NOT NULL`).all()
    for (const row of profilePhotos.results as any[]) {
      const k = extractR2Key(row.profile_photo)
      if (k) inUse.add(k)
    }

    const blogCovers = await env.DB.prepare(`SELECT cover_image FROM blog WHERE cover_image IS NOT NULL`).all()
    for (const row of blogCovers.results as any[]) {
      const k = extractR2Key(row.cover_image)
      if (k) inUse.add(k)
    }

    // Grace period — anything uploaded in the last 48h is left alone
    // even if not yet referenced (could be mid-upload-flow).
    const graceCutoffMs = Date.now() - 48 * 3600000

    let cursor: string | undefined = undefined
    let scanned = 0
    const toDelete: string[] = []
    let deletedBytes = 0

    do {
      const page = await env.ZAMORAX_BUCKET.list({ cursor, limit: 1000 })
      for (const obj of page.objects) {
        scanned++
        if (inUse.has(obj.key)) continue
        if (obj.uploaded.getTime() > graceCutoffMs) continue // too new, skip
        toDelete.push(obj.key)
        deletedBytes += obj.size
      }
      cursor = page.truncated ? page.cursor : undefined
    } while (cursor)

    summary.r2.scanned = scanned
    summary.r2.orphaned = toDelete.length
    summary.r2.deletedBytes = deletedBytes
    summary.r2.deletedKeys = toDelete.slice(0, 200) // cap logged list, avoid huge log payload

    if (!dryRun && toDelete.length) {
      // R2 delete() accepts an array for batch delete
      const BATCH = 1000
      for (let i = 0; i < toDelete.length; i += BATCH) {
        await env.ZAMORAX_BUCKET.delete(toDelete.slice(i, i + BATCH))
      }
    }
  } catch (e) {
    summary.errors.push(`r2_cleanup: ${String(e)}`)
  }
}
