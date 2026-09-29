// app/api/cron/order-auto-confirm/route.ts
// Shipped but the buyer never tapped "Received"? This sweep:
//   1. Stamps auto_confirm_at on every shipped order that doesn't have one
//      yet (shipped time + the admin-set days for its delivery method).
//   2. Sends the buyer a reminder N days before auto-confirm (admin-set).
//   3. Once auto_confirm_at has passed, moves the order to "inspecting"
//      with escrow_release_at = now + admin-set inspection hours. The
//      existing escrow-release cron then pays the seller when that ends.
// Every number comes from Sub Settings > Order Timers. Schedule hourly,
// same way as escrow-release (see CRON_SETUP.md).
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { d1Query } from "@/lib/d1"
import { getCronSecret } from "@/lib/cron-secret"
import { getSubSettings, type SubSettings } from "@/src/services/subSettings"

type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

const DAY = 86_400_000
const HOUR = 3_600_000

function autoConfirmDays(method: string, s: SubSettings): number {
  if (method === "fbz") return s.orderAutoConfirmDaysFbz
  if (method === "zamorax_logistics") return s.orderAutoConfirmDaysLogistics
  return s.orderAutoConfirmDaysMeetup
}

async function notify(nativeDB: unknown, userId: string, title: string, body: string, link: string) {
  if (!userId) return
  try {
    await d1Query(
      `INSERT INTO notifications (id, user_id, type, title, body, link, is_read, created_at)
       VALUES (?, ?, 'system', ?, ?, ?, 0, ?)`,
      [`notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, userId, title, body, link, new Date().toISOString()],
      nativeDB,
    )
  } catch (err) {
    console.error("[order-auto-confirm] notify failed (non-fatal):", err)
  }
}

async function runSweep(nativeDB: unknown) {
  const s = await getSubSettings()
  const result = { stamped: 0, reminded: 0, autoConfirmed: 0 }
  if (!s.orderAutoConfirmEnabled) return { ...result, skipped: "auto-confirm disabled in Sub Settings" }

  const nowMs = Date.now()
  const nowIso = new Date(nowMs).toISOString()

  const rows = await d1Query(
    "SELECT * FROM orders WHERE status = 'shipped' AND (dispute_id IS NULL OR dispute_id = '')",
    [],
    nativeDB,
  )

  for (const o of ((rows?.results ?? []) as Record<string, unknown>[])) {
    const orderId  = String(o.id)
    const buyerId  = String(o.buyer_id ?? "")
    const sellerId = String(o.seller_id ?? "")
    const title    = String(o.item_title ?? "your item")
    const method   = String(o.delivery_method ?? "")
    const days     = autoConfirmDays(method, s)
    try {
      let autoAt = o.auto_confirm_at ? new Date(String(o.auto_confirm_at)).getTime() : NaN

      // 1. Stamp (also re-stamps if admin changed nothing but the order has no value yet)
      if (!Number.isFinite(autoAt)) {
        const shippedMs = new Date(String(o.marked_shipped_at ?? nowIso)).getTime()
        autoAt = (Number.isFinite(shippedMs) ? shippedMs : nowMs) + days * DAY
        await d1Query("UPDATE orders SET auto_confirm_at = ? WHERE id = ?", [new Date(autoAt).toISOString(), orderId], nativeDB)
        result.stamped++
      }

      // 3. Auto-confirm
      if (autoAt <= nowMs) {
        const releaseAt = new Date(nowMs + s.orderInspectionHours * HOUR).toISOString()
        await d1Query(
          `UPDATE orders SET status = 'inspecting', delivered_at = ?, escrow_release_at = ?, updated_at = ? WHERE id = ? AND status = 'shipped'`,
          [nowIso, releaseAt, nowIso, orderId],
          nativeDB,
        )
        await notify(nativeDB, buyerId, "Order auto-confirmed",
          `"${title}" was marked shipped ${days} days ago, so it was confirmed automatically. You have ${s.orderInspectionHours} hours to raise a dispute before payment is released.`,
          `/dashboard/buyer/orders/${orderId}`)
        await notify(nativeDB, sellerId, "Order auto-confirmed",
          `"${title}" was auto-confirmed. Payment releases after the ${s.orderInspectionHours}-hour inspection window unless the buyer opens a dispute.`,
          `/dashboard/seller/orders/${orderId}`)
        result.autoConfirmed++
        continue
      }

      // 2. Reminder
      const remindDays = s.orderAutoConfirmReminderDaysBefore
      if (remindDays > 0 && !o.auto_confirm_reminded_at && autoAt - nowMs <= remindDays * DAY) {
        const when = new Date(autoAt).toLocaleDateString("en-NG", { day: "numeric", month: "short" })
        await notify(nativeDB, buyerId, "Did your order arrive?",
          `Confirm receipt of "${title}" or report a problem. If you do nothing it confirms automatically on ${when}.`,
          `/dashboard/buyer/orders/${orderId}`)
        await d1Query("UPDATE orders SET auto_confirm_reminded_at = ? WHERE id = ?", [nowIso, orderId], nativeDB)
        result.reminded++
      }
    } catch (err) {
      console.error("[order-auto-confirm] failed for order", orderId, err)
    }
  }
  return result
}

async function handle(req: NextRequest, context: RouteContext) {
  const nativeDB = (context as any)?.env?.DB
  const cronSecret = await getCronSecret(nativeDB)
  const headerAuth = req.headers.get("authorization")
  const queryAuth = req.nextUrl.searchParams.get("secret")
  if (!cronSecret || !(headerAuth === `Bearer ${cronSecret}` || queryAuth === cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    return NextResponse.json({ success: true, ...(await runSweep(nativeDB)) })
  } catch (err: any) {
    console.error("[cron/order-auto-confirm]", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export const GET = handle
export const POST = handle
