// functions/src/algoliaSync.ts
// Keeps Algolia index in sync with Firestore listings collection.
// Deploy: firebase deploy --only functions:onListingWrite

import * as functions from "firebase-functions"
import * as admin from "firebase-admin"
import algoliasearch from "algoliasearch"

if (!admin.apps.length) admin.initializeApp()

const algolia = algoliasearch(
  functions.config().algolia.app_id,
  functions.config().algolia.admin_key   // Admin key — server only, never in client
)
const index = algolia.initIndex("zamorax_listings")

export const onListingWrite = functions.firestore
  .document("listings/{listingId}")
  .onWrite(async (change, context) => {
    const listingId = context.params.listingId

    // Document deleted — remove from Algolia
    if (!change.after.exists) {
      await index.deleteObject(listingId)
      console.log(`Deleted ${listingId} from Algolia`)
      return null
    }

    const data = change.after.data()!

    // Only index active listings
    if (!data.isActive || data.status !== "active") {
      // If it was previously active, remove it
      if (change.before.exists) {
        const before = change.before.data()!
        if (before.isActive && before.status === "active") {
          await index.deleteObject(listingId)
          console.log(`De-indexed ${listingId} (no longer active)`)
        }
      }
      return null
    }

    const record = {
      objectID: listingId,
      title: data.title || "",
      description: (data.description || "").slice(0, 500), // truncate for Algolia limits
      categorySlug: data.categorySlug || "",
      categoryName: data.categoryName || "",
      listingType: data.listingType || "sale",
      condition: data.condition || "",
      priceSale: data.priceSale || 0,
      priceRentDaily: data.priceRentDaily || null,
      nigerianState: data.nigerianState || "",
      city: data.city || "",
      images: data.images?.slice(0, 3) || [],  // store max 3 for bandwidth
      isHubVerified: data.isHubVerified || false,
      isBoosted: data.isBoosted || false,
      sellerName: data.sellerName || "",
      sellerRating: data.sellerRating || 0,
      sellerVerified: data.sellerVerified || false,
      status: data.status,
      createdAtTimestamp: data.createdAt?.seconds || Math.floor(Date.now() / 1000),
    }

    await index.saveObject(record)
    console.log(`Indexed listing ${listingId}`)
    return null
  })

// One-time bulk index of all active listings
// Call via: firebase functions:shell → bulkIndexListings()
export const bulkIndexListings = functions.https.onRequest(async (req, res) => {
  const db = admin.firestore()
  const snap = await db.collection("listings")
    .where("isActive", "==", true)
    .where("status", "==", "active")
    .get()

  const records = snap.docs.map(doc => {
    const data = doc.data()
    return {
      objectID: doc.id,
      title: data.title || "",
      description: (data.description || "").slice(0, 500),
      categorySlug: data.categorySlug || "",
      listingType: data.listingType || "sale",
      condition: data.condition || "",
      priceSale: data.priceSale || 0,
      nigerianState: data.nigerianState || "",
      city: data.city || "",
      images: data.images?.slice(0, 3) || [],
      isHubVerified: data.isHubVerified || false,
      isBoosted: data.isBoosted || false,
      sellerName: data.sellerName || "",
      sellerRating: data.sellerRating || 0,
      sellerVerified: data.sellerVerified || false,
      status: data.status,
      createdAtTimestamp: data.createdAt?.seconds || 0,
    }
  })

  // Algolia batch limit is 1000 records per call
  const chunks = []
  for (let i = 0; i < records.length; i += 1000) {
    chunks.push(records.slice(i, i + 1000))
  }
  for (const chunk of chunks) {
    await index.saveObjects(chunk)
  }

  res.json({ success: true, indexed: records.length })
})
