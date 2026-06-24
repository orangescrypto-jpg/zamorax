// src/services/admin.ts
// ─────────────────────────────────────────────────────────────────
// WAS FIREBASE/FIRESTORE → NOW CLOUDFLARE D1
// Admin-only service for platform statistics and dashboard.
// ─────────────────────────────────────────────────────────────────

// ── Switch provider here ─────────────────────────────────────────
// WAS: export { AdminService } from "@/src/services/providers/firebase/admin"
export { AdminService } from "@/src/services/providers/cloudflare/admin"
// ─────────────────────────────────────────────────────────────────

import type {
  User, Listing, Dispute, PayoutRequest, FirestoreDoc,
} from "@/src/types"

// Local admin-specific type aliases
export type AdminSubscription = FirestoreDoc
export type AdminBoost        = FirestoreDoc
export type AdminWithdrawal   = FirestoreDoc
export type AdminReport       = FirestoreDoc
export type AdminSearchAlert  = FirestoreDoc
export type AdminBundle       = FirestoreDoc

export interface FeaturedBanner {
  id:       string
  tag:      string
  title:    string
  subtitle: string
  href:     string
  color:    string
  icon:     string
  order:    number
  active:   boolean
}

export interface IAdminService {
  subscribeToFeaturedBanners(callback: (banners: FeaturedBanner[]) => void): () => void
  subscribeToUsers(callback: (users: User[]) => void): () => void
  subscribeToListings(callback: (listings: Listing[]) => void): () => void
  subscribeToDisputes(callback: (disputes: Dispute[]) => void): () => void
  subscribeToSubscriptions(callback: (subs: AdminSubscription[]) => void): () => void
  subscribeToBoosts(callback: (boosts: AdminBoost[]) => void): () => void
  subscribeToWithdrawals(callback: (withdrawals: AdminWithdrawal[]) => void): () => void
  subscribeToPendingPayouts(callback: (payouts: PayoutRequest[]) => void): () => void
  subscribeToPendingReports(callback: (reports: AdminReport[]) => void): () => void
  subscribeToSearchAlerts(callback: (alerts: AdminSearchAlert[]) => void): () => void
  subscribeToActiveBundles(callback: (bundles: AdminBundle[]) => void): () => void
  subscribeToCollection(path: string, callback: (docs: FirestoreDoc[]) => void, constraints?: unknown[]): () => void
  subscribeToCollectionWhere(path: string, field: string, op: string, value: unknown, callback: (docs: FirestoreDoc[]) => void): () => void
  subscribeToDoc(path: string, docId: string, callback: (doc: FirestoreDoc | null) => void, onError?: (e: Error) => void): () => void
  _ref_(path: string, constraints?: unknown[]): unknown
  getCollection(path: string, constraints?: unknown[]): Promise<FirestoreDoc[]>
  updateDoc(collectionPath: string, docId: string, data: Record<string, unknown>): Promise<void>
  addDoc(collectionPath: string, data: Record<string, unknown>): Promise<{ id: string }>
  deleteDoc(collectionPath: string, docId: string): Promise<void>
  generateId(): string
  setDoc(collectionPath: string, docId: string, data: Record<string, unknown>, options?: { merge?: boolean }): Promise<void>
  getDoc(collectionPath: string, docId: string): Promise<FirestoreDoc | null>
  batch(): any
}
