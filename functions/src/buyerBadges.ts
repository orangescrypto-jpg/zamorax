// functions/src/buyerBadges.ts
// Awards "Verified Buyer" badge automatically after 5 completed orders.
// Runs on every order status update.

import * as functions from "firebase-functions"
import * as admin from "firebase-admin"

if (!admin.apps.length) admin.initializeApp()
const db = admin.firestore()

const BADGE_THRESHOLDS = [
  { id: "verified_buyer",    label: "Verified Buyer",    minOrders: 5  },
  { id: "trusted_buyer",     label: "Trusted Buyer",     minOrders: 20 },
  { id: "power_buyer",       label: "Power Buyer",       minOrders: 50 },
]

export const onOrderComplete = functions.firestore
  .document("orders/{orderId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data()
    const after  = change.after.data()

    // Only trigger when an order transitions TO "completed"
    if (before.status === after.status) return null
    if (after.status !== "completed")   return null

    const buyerId = after.buyerId
    if (!buyerId) return null

    // Count total completed orders for this buyer
    const snap = await db.collection("orders")
      .where("buyerId", "==", buyerId)
      .where("status", "==", "completed")
      .get()

    const completedCount = snap.size

    // Check which badges the buyer has earned
    const userRef  = db.collection("users").doc(buyerId)
    const userSnap = await userRef.get()
    if (!userSnap.exists) return null

    const userData = userSnap.data()!
    const currentBadges: string[] = userData.badges || []

    const newBadges: string[] = []
    for (const { id, label, minOrders } of BADGE_THRESHOLDS) {
      if (completedCount >= minOrders && !currentBadges.includes(id)) {
        newBadges.push(id)

        // Send a notification to the buyer
        await db.collection("notifications").add({
          userId: buyerId,
          type: "system",
          title: `🏅 You earned the "${label}" badge!`,
          body: `You've completed ${completedCount} orders on Zamorax. Sellers can see this badge on your profile.`,
          link: `/dashboard/buyer/profile`,
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        })
      }
    }

    if (newBadges.length === 0) return null

    // Update user document with new badges + completed order count
    await userRef.update({
      badges: admin.firestore.FieldValue.arrayUnion(...newBadges),
      completedOrderCount: completedCount,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    console.log(`Awarded badges [${newBadges.join(", ")}] to buyer ${buyerId}`)
    return null
  })
