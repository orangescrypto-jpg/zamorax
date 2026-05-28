// src/services/index.ts
// ─────────────────────────────────────────────────────────────────
// Single import point for all services.
//
// Usage in any file:
//   import { AuthService, ListingsService, OrdersService , query , limit , orderBy , where , Timestamp , serverTimestamp , onSnapshot , collection } from "@/src/services"
//
// ─────────────────────────────────────────────────────────────────

export { AuthService }         from "./auth"
export { ListingsService }     from "./listings"
export { OrdersService }       from "./orders"
export { UsersService }        from "./users"
export { StorageService }      from "./storage"
export { ChatService }         from "./chat"
export { DisputesService }     from "./disputes"
export { OffersService }       from "./offers"
export { WalletService }       from "./wallet"
export { NotificationsService } from "./notifications"
export { ReferralsService }    from "./referrals"

// Re-export interfaces for type-checking
export type { IAuthService }          from "./auth"
export type { IListingsService }      from "./listings"
export type { IOrdersService }        from "./orders"
export type { IUsersService }         from "./users"
export type { IStorageService }       from "./storage"
export type { IChatService }          from "./chat"
export type { IDisputesService }      from "./disputes"
export type { IOffersService }        from "./offers"
export type { IWalletService }        from "./wallet"
export type { INotificationsService } from "./notifications"
export type { IReferralsService }     from "./referrals"

// ─── Blog ─────────────────────────────────────────────────────────
export { BlogService }         from "./blog"
export type { IBlogService }   from "./blog"

// ─── Admin ───────────────────────────────────────────────────────────────────
export { AdminService } from "./admin"
export type { IAdminService } from "./admin"

// ─── Firestore query helpers re-exported via service layer ─────────────────
// Pages and hooks import these from @/src/services, never directly from firebase
export { where, orderBy, limit, query, collection, onSnapshot, serverTimestamp, Timestamp } from "firebase/firestore"
export { arrayUnion, arrayRemove, increment, writeBatch, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, setDoc, DocumentData } from "firebase/firestore"
export type { QueryConstraint, DocumentSnapshot } from "firebase/firestore"
