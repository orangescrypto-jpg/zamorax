// src/services/webPush.ts
// Server-only. Sends real Web Push (VAPID) notifications to a user's
// saved browser subscriptions, and writes the same notification into the
// existing `notifications` table so it also shows in the in-app bell menu
// regardless of whether push is enabled or the browser permission was
// granted. Push is a bonus channel on top of in-app notifications, never
// a replacement for them.

import webpush from "web-push"
import { d1Query } from "@/lib/d1"
import { getVapidKeys } from "@/lib/push-vapid"
import { getSubSettings } from "@/src/services/subSettings"

export type PushNotificationType =
  | "new_listing"        // followed seller posted a new listing
  | "account_activity"   // order status, messages, offers, disputes, escrow
  | "price_drop"
  | "back_in_stock"
  | "layaway_reminder"

export interface SendPushInput {
  userId: string
  type: PushNotificationType
  title: string
  body: string
  link?: string
  nativeDB?: unknown
}

function subSettingKeyFor(type: PushNotificationType): string {
  switch (type) {
    case "new_listing": return "pushNewListingEnabled"
    case "account_activity": return "pushAccountActivityEnabled"
    case "price_drop": return "pushPriceDropEnabled"
    case "back_in_stock": return "pushBackInStockEnabled"
    case "layaway_reminder": return "pushLayawayRemindersEnabled"
  }
}

// Always writes the in-app notification row. Only attempts a real Web
// Push send if the master toggle and the specific type's toggle are both
// on, and the user has at least one saved subscription.
export async function sendPushNotification(input: SendPushInput): Promise<{
  inAppWritten: boolean
  pushSent: number
  pushSkippedReason?: string
}> {
  const { userId, type, title, body, link, nativeDB } = input
  const now = new Date().toISOString()

  // In-app notification -- always written, independent of push settings.
  let inAppWritten = false
  try {
    await d1Query(
      `INSERT INTO notifications (id, user_id, type, title, body, link, is_read, created_at)
       VALUES (?, ?, 'system', ?, ?, ?, 0, ?)`,
      [crypto.randomUUID(), userId, title, body, link || null, now],
      nativeDB,
    )
    inAppWritten = true
  } catch (err) {
    console.error("[webPush] failed to write in-app notification:", err)
  }

  const settings = await getSubSettings()
  if (!settings.pushMasterEnabled) {
    return { inAppWritten, pushSent: 0, pushSkippedReason: "push_master_disabled" }
  }
  const typeKey = subSettingKeyFor(type)
  if (!(settings as any)[typeKey]) {
    return { inAppWritten, pushSent: 0, pushSkippedReason: `${typeKey}_disabled` }
  }

  const vapid = await getVapidKeys(nativeDB)
  if (!vapid.publicKey || !vapid.privateKey) {
    return { inAppWritten, pushSent: 0, pushSkippedReason: "vapid_not_configured" }
  }

  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey)

  const subRows = await d1Query(
    "SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?",
    [userId],
    nativeDB,
  )
  const subs = (subRows?.results ?? []) as Array<{
    id: string; endpoint: string; p256dh: string; auth: string
  }>

  if (subs.length === 0) {
    return { inAppWritten, pushSent: 0, pushSkippedReason: "no_subscriptions" }
  }

  const payload = JSON.stringify({ title, body, url: link || "/" })
  let sent = 0

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        } as any,
        payload,
      )
      sent++
    } catch (err: any) {
      // 404/410 means the subscription is gone (browser data cleared,
      // permission revoked at OS level) -- clean it up so future sends
      // don't keep retrying a dead endpoint.
      const statusCode = err?.statusCode
      if (statusCode === 404 || statusCode === 410) {
        try {
          await d1Query("DELETE FROM push_subscriptions WHERE id = ?", [sub.id], nativeDB)
        } catch { /* non-fatal cleanup */ }
      } else {
        console.error("[webPush] send failed for subscription", sub.id, err?.message || err)
      }
    }
  }

  return { inAppWritten, pushSent: sent }
}

// Convenience wrapper for notifying every follower of a seller when that
// seller's listing goes live -- used by the admin listing-approve action.
export async function notifyFollowersOfNewListing(params: {
  sellerId: string
  sellerName: string
  listingId: string
  listingTitle: string
  nativeDB?: unknown
}) {
  const { sellerId, sellerName, listingId, listingTitle, nativeDB } = params

  const followerRows = await d1Query(
    "SELECT follower_id FROM seller_follows WHERE seller_id = ?",
    [sellerId],
    nativeDB,
  )
  const followers = (followerRows?.results ?? []) as Array<{ follower_id: string }>

  for (const f of followers) {
    if (!f.follower_id) continue
    try {
      await sendPushNotification({
        userId: f.follower_id,
        type: "new_listing",
        title: `${sellerName} just listed something new`,
        body: listingTitle,
        link: `/listings/${listingId}`,
        nativeDB,
      })
    } catch (err) {
      console.error("[notifyFollowersOfNewListing] failed for follower", f.follower_id, err)
    }
  }
}
