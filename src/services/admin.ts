// src/services/admin.ts
// Admin-only service for platform statistics and real-time dashboard monitoring.

export { AdminService } from "@/src/services/providers/firebase/admin"

import type {
  User, Listing, Dispute, PayoutRequest, FirestoreDoc,
} from "@/src/types"
import type { QueryConstraint, Query } from "firebase/firestore"

// Local admin-specific type aliases (not yet in @/src/types)
export type AdminSubscription = FirestoreDoc
export type AdminBoost        = FirestoreDoc
export type AdminWithdrawal   = FirestoreDoc
export type AdminReport       = FirestoreDoc
export type AdminSearchAlert  = FirestoreDoc
export type AdminBundle       = FirestoreDoc

export interface IAdminService {
  /** Subscribe to all users for admin stats */
  subscribeToUsers(callback: (users: User[]) => void): () => void

  /** Subscribe to all listings */
  subscribeToListings(callback: (listings: Listing[]) => void): () => void

  /** Subscribe to all disputes */
  subscribeToDisputes(callback: (disputes: Dispute[]) => void): () => void

  /** Subscribe to all subscriptions */
  subscribeToSubscriptions(callback: (subs: AdminSubscription[]) => void): () => void

  /** Subscribe to all boosts */
  subscribeToBoosts(callback: (boosts: AdminBoost[]) => void): () => void

  /** Subscribe to all withdrawals */
  subscribeToWithdrawals(callback: (withdrawals: AdminWithdrawal[]) => void): () => void

  /** Subscribe to pending payouts */
  subscribeToPendingPayouts(callback: (payouts: PayoutRequest[]) => void): () => void

  /** Subscribe to pending listing reports */
  subscribeToPendingReports(callback: (reports: AdminReport[]) => void): () => void

  /** Subscribe to search alerts */
  subscribeToSearchAlerts(callback: (alerts: AdminSearchAlert[]) => void): () => void

  /** Subscribe to active bundles */
  subscribeToActiveBundles(callback: (bundles: AdminBundle[]) => void): () => void

  /** Subscribe to a generic collection by path */
  subscribeToCollection(path: string, callback: (docs: FirestoreDoc[]) => void, constraints?: QueryConstraint[]): () => void

  /** Subscribe to a generic collection with where constraints */
  subscribeToCollectionWhere(
    path: string,
    field: string,
    op: string,
    value: unknown,
    callback: (docs: FirestoreDoc[]) => void
  ): () => void

  /** Subscribe to a single document */
  subscribeToDoc(path: string, docId: string, callback: (doc: FirestoreDoc | null) => void, onError?: (e: Error) => void): () => void

  /** Get a Firestore Query reference for use with onSnapshot */
  _ref_(path: string, constraints?: QueryConstraint[]): Query

  /** One-time get of a collection */
  getCollection(path: string, constraints?: QueryConstraint[]): Promise<FirestoreDoc[]>

  /** Update a document in any collection */
  updateDoc(collectionPath: string, docId: string, data: Record<string, unknown>): Promise<void>

  /** Add a document to any collection */
  addDoc(collectionPath: string, data: Record<string, unknown>): Promise<{ id: string }>

  /** Delete a document */
  generateId(): string
  deleteDoc(collectionPath: string, docId: string): Promise<void>

  /** Set a document */
  setDoc(collectionPath: string, docId: string, data: Record<string, unknown>, options?: { merge?: boolean }): Promise<void>

  /** Get a single document */
  getDoc(collectionPath: string, docId: string): Promise<FirestoreDoc | null>

  /** Get a Firestore WriteBatch */
  batch(): import("firebase/firestore").WriteBatch
}
