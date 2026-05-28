// functions/src/searchAlerts.ts
// When a new listing goes active, check all saved search alerts and notify matching users.

import * as functions from "firebase-functions"
import * as admin from "firebase-admin"

if (!admin.apps.length) admin.initializeApp()
const db = admin.firestore()

export const onListingActivated = functions.firestore
  .document("listings/{listingId}")
  .onWrite(async (change, ctx) => {
    const before = change.before.exists ? change.before.data()! : null
    const after  = change.after.exists  ? change.after.data()!  : null

    // Only fire when a listing becomes active for the first time
    const wasActive = before?.isActive && before?.status === "active"
    const isNowActive = after?.isActive && after?.status === "active"
    if (wasActive || !isNowActive || !after) return null

    // Load all search alerts
    const alertsSnap = await db.collection("searchAlerts").get()
    if (alertsSnap.empty) return null

    const listing = after
    const listingId = ctx.params.listingId
    const batch = db.batch()
    const notifications: Promise<any>[] = []

    for (const alertDoc of alertsSnap.docs) {
      const alert = alertDoc.data()
      const filters = alert.filters || {}

      // ── Match listing against alert filters ──────────────────────────────
      let matches = true

      if (filters.q) {
        const q = filters.q.toLowerCase()
        const searchable = `${listing.title} ${listing.description}`.toLowerCase()
        if (!searchable.includes(q)) matches = false
      }
      if (matches && filters.category && listing.categorySlug !== filters.category)    matches = false
      if (matches && filters.listingType && listing.listingType !== filters.listingType) matches = false
      if (matches && filters.condition && listing.condition !== filters.condition)      matches = false
      if (matches && filters.nigerianState && listing.nigerianState !== filters.nigerianState) matches = false
      if (matches && filters.minPrice && (listing.priceSale || 0) < filters.minPrice)  matches = false
      if (matches && filters.maxPrice && (listing.priceSale || 0) > filters.maxPrice)  matches = false

      // Don't notify the seller about their own listing
      if (alert.userId === listing.sellerId) matches = false

      if (!matches) continue

      // Update lastNotifiedAt
      batch.update(alertDoc.ref, {
        lastNotifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      })

      // Create in-app notification
      const notifRef = db.collection("notifications").doc()
      batch.set(notifRef, {
        userId: alert.userId,
        type: "system",
        title: "🔔 New match for your saved search!",
        body: `"${listing.title}" — ${formatKobo(listing.priceSale || 0)} in ${listing.city || listing.nigerianState}`,
        link: `/listings/${listingId}`,
        listingImage: listing.images?.[0] || null,
        alertLabel: alert.label,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })

      // Also push-notify if user has FCM token
      notifications.push(
        db.collection("users").doc(alert.userId).get().then(async userSnap => {
          const fcmToken = userSnap.data()?.fcmToken
          if (!fcmToken) return

          await admin.messaging().send({
            token: fcmToken,
            notification: {
              title: "🔔 New listing matches your search!",
              body: `"${listing.title}" — ${formatKobo(listing.priceSale || 0)}`,
              imageUrl: listing.images?.[0] || undefined,
            },
            data: { link: `/listings/${listingId}` },
            webpush: {
              fcmOptions: { link: `https://zamorax.ng/listings/${listingId}` },
            },
          }).catch(e => {
            if (e.code === "messaging/registration-token-not-registered") {
              db.collection("users").doc(alert.userId).update({
                fcmToken: admin.firestore.FieldValue.delete()
              })
            }
          })
        })
      )
    }

    await batch.commit()
    await Promise.allSettled(notifications)
    console.log(`Processed search alerts for listing ${listingId}`)
    return null
  })

// ── Saved Alerts management page data ────────────────────────────────────────
// (No extra function needed — frontend reads searchAlerts collection directly)

function formatKobo(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString("en-NG")}`
}
