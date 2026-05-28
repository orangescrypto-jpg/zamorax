// src/services/providers/firebase/listings.ts
import {
  collection, query, where, orderBy, limit, startAfter,
  getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc,
  serverTimestamp, onSnapshot, DocumentData, QueryConstraint,
  DocumentSnapshot,
} from "firebase/firestore"
import { db } from "@/lib/firebase/config"
import type { IListingsService } from "@/src/services/listings"
import type { Listing, ListingFilters, PaginatedResult, Category } from "@/src/types"

// ── Helpers ──────────────────────────────────────────────────────

function toIso(ts: TimestampLike): string {
  if (!ts) return new Date().toISOString()
  if (ts?.toDate) return ts.toDate().toISOString()
  return new Date(ts).toISOString()
}

function mapListing(id: string, data: DocumentData): Listing {
  return {
    ...data,
    id,
    createdAt:    toIso(data.createdAt),
    updatedAt:    toIso(data.updatedAt),
    boostExpiresAt: data.boostExpiresAt ? toIso(data.boostExpiresAt) : undefined,
    flashDeal: data.flashDeal
      ? {
          ...data.flashDeal,
          expiresAt: toIso(data.flashDeal.expiresAt),
          createdAt: toIso(data.flashDeal.createdAt),
        }
      : null,
  } as Listing
}

// ── Implementation ───────────────────────────────────────────────

export const ListingsService: IListingsService = {

  async getListings(filters: ListingFilters = {}, cursor?: unknown): Promise<PaginatedResult<Listing>> {
    const PAGE_SIZE = 20
    let constraints: QueryConstraint[] = [
      where("isActive", "==", true),
      where("status",   "==", "active"),
      orderBy("isBoosted", "desc"),
      orderBy("createdAt", "desc"),
      limit(PAGE_SIZE),
    ]

    if (filters.category)     constraints.unshift(where("categorySlug",   "==", filters.category))
    if (filters.listingType)  constraints.unshift(where("listingType",    "==", filters.listingType))
    if (filters.condition)    constraints.unshift(where("condition",      "==", filters.condition))
    if (filters.nigerianState)constraints.unshift(where("nigerianState",  "==", filters.nigerianState))
    if (filters.verified)     constraints.unshift(where("sellerVerified", "==", true))
    if (filters.minPrice !== undefined) constraints.unshift(where("priceSale", ">=", filters.minPrice))
    if (filters.maxPrice !== undefined) constraints.unshift(where("priceSale", "<=", filters.maxPrice))
    if (filters.q) {
      const s = filters.q.toLowerCase()
      constraints.unshift(
        where("searchableTitle", ">=", s),
        where("searchableTitle", "<=", s + "\uf8ff"),
      )
    }

    const q = cursor
      ? query(collection(db, "listings"), ...constraints, startAfter(cursor as DocumentSnapshot))
      : query(collection(db, "listings"), ...constraints)

    const snap = await getDocs(q)
    return {
      items:      snap.docs.map(d => mapListing(d.id, d.data())),
      nextCursor: snap.docs[snap.docs.length - 1] ?? null,
      hasMore:    snap.docs.length === PAGE_SIZE,
    }
  },

  async getListingById(id) {
    const snap = await getDoc(doc(db, "listings", id))
    if (!snap.exists()) return null
    return mapListing(snap.id, snap.data())
  },

  async getListingsByIds(ids) {
    const results: Listing[] = []
    // Firestore "in" supports max 30 items — chunk if needed
    const chunks = Array.from({ length: Math.ceil(ids.length / 30) }, (_, i) =>
      ids.slice(i * 30, i * 30 + 30),
    )
    for (const chunk of chunks) {
      const q = query(collection(db, "listings"), where("__name__", "in", chunk))
      const snap = await getDocs(q)
      snap.docs.forEach(d => results.push(mapListing(d.id, d.data())))
    }
    return results
  },

  async getCategories(phase) {
    let q = query(collection(db, "categories"), orderBy("order", "asc"))
    if (phase !== undefined) q = query(q, where("phase", "==", phase))
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Category))
  },

  async getCategoryBySlug(slug) {
    const q = query(collection(db, "categories"), where("slug", "==", slug), limit(1))
    const snap = await getDocs(q)
    if (snap.empty) return null
    return { id: snap.docs[0].id, ...snap.docs[0].data() } as Category
  },

  async createListing(data, sellerId) {
    const ref = await addDoc(collection(db, "listings"), {
      ...data,
      sellerId,
      isActive:   false,
      status:     "pending",
      views:      0,
      saves:      0,
      inquiries:  0,
      createdAt:  serverTimestamp(),
      updatedAt:  serverTimestamp(),
    })
    return { id: ref.id }
  },

  async updateListing(id, data) {
    await updateDoc(doc(db, "listings", id), { ...data, updatedAt: serverTimestamp() })
  },

  async deleteListing(id) {
    await deleteDoc(doc(db, "listings", id))
  },

  async pauseListing(id) {
    await updateDoc(doc(db, "listings", id), {
      isActive:  false,
      status:    "paused",
      updatedAt: serverTimestamp(),
    })
  },

  async resumeListing(id) {
    await updateDoc(doc(db, "listings", id), {
      isActive:  true,
      status:    "active",
      updatedAt: serverTimestamp(),
    })
  },

  async saveListing(listingId, userId) {
    await addDoc(collection(db, "savedListings"), {
      userId, listingId, createdAt: serverTimestamp(),
    })
    await updateDoc(doc(db, "listings", listingId), {
      saves: (await getDoc(doc(db, "listings", listingId))).data()?.saves + 1 || 1,
    })
  },

  async unsaveListing(listingId, userId) {
    const q = query(
      collection(db, "savedListings"),
      where("userId",    "==", userId),
      where("listingId", "==", listingId),
      limit(1),
    )
    const snap = await getDocs(q)
    if (!snap.empty) await deleteDoc(snap.docs[0].ref)
  },

  async getSavedListings(userId) {
    const q = query(collection(db, "savedListings"), where("userId", "==", userId))
    const snap = await getDocs(q)
    const ids = snap.docs.map(d => d.data().listingId as string)
    if (!ids.length) return []
    return this.getListingsByIds(ids)
  },

  async createFlashDeal(listingId, discountPercent, hours) {
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000)
    await updateDoc(doc(db, "listings", listingId), {
      flashDeal: { discountPercent, expiresAt, createdAt: serverTimestamp() },
      updatedAt: serverTimestamp(),
    })
  },

  async cancelFlashDeal(listingId) {
    await updateDoc(doc(db, "listings", listingId), {
      flashDeal: null, updatedAt: serverTimestamp(),
    })
  },

  async approveListing(listingId, adminUid) {
    await updateDoc(doc(db, "listings", listingId), {
      status:          "active",
      isActive:        true,
      approvedBy:      adminUid,
      approvedAt:      serverTimestamp(),
      rejectionReason: null,
      updatedAt:       serverTimestamp(),
    })
  },

  async rejectListing(listingId, adminUid, reason) {
    if (!reason.trim()) throw new Error("Rejection reason is required")
    await updateDoc(doc(db, "listings", listingId), {
      status:          "rejected",
      isActive:        false,
      rejectedBy:      adminUid,
      rejectedAt:      serverTimestamp(),
      rejectionReason: reason.trim(),
      updatedAt:       serverTimestamp(),
    })
  },

  isFlashDealActive(listing: Listing): boolean {
    if (!listing?.flashDeal?.expiresAt) return false
    const exp = listing.flashDeal.expiresAt?.toDate?.() || new Date(listing.flashDeal.expiresAt)
    return exp > new Date()
  },

  getFlashPrice(originalKobo: number, discountPercent: number): number {
    return Math.round(originalKobo * (1 - discountPercent / 100))
  },

  subscribeToInsurancePool(callback) {
    const currentMonth = new Date().toISOString().slice(0, 7)
    return onSnapshot(doc(db, "insurancePool", currentMonth), snap => {
      callback(snap.exists() ? (snap.data()?.netBalance ?? 0) : 0)
    })
  },
}
