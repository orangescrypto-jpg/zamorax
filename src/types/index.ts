// src/types/index.ts
// ─────────────────────────────────────────────────────────────────
// ALL shared types for Zamorax — zero Firebase/Firestore imports.
// Timestamps are plain ISO strings so every backend can satisfy them.
// ─────────────────────────────────────────────────────────────────

export type { OrderStatus, EscrowStatus, DisputeStatus, TxType, PayoutStatus } from "@/constants/status"

// ─── User ────────────────────────────────────────────────────────
export interface User {
  uid: string
  email: string | null
  phone: string | null
  fullName: string
  username: string
  role: "buyer" | "seller" | "both" | "admin" | "moderator"
  plan: "free" | "starter" | "pro"
  planExpiresAt: string | null          // ISO string
  verificationLevel: "none" | "phone" | "nin" | "nin_bvn"
  verificationStatus?: "pending_review" | "approved" | "rejected" | null
  proVerificationStatus?: "pending_review" | "approved" | "rejected" | null
  ninVerified: boolean
  bvnVerified: boolean
  phoneVerified: boolean
  isBanned: boolean
  banReason?: string | null
  sellerRating: number
  totalSales: number
  totalRentals: number
  activeListingCount: number
  isSellerReady: boolean
  storeName?: string
  storeDescription?: string
  storeLogoUrl?: string
  storeBannerUrl?: string
  storeCategory?: string
  storeState?: string
  storeCity?: string
  storeWhatsApp?: string
  storeInstagram?: string
  profilePhoto?: string
  fcmToken?: string
  badges?: string[]
  createdAt: string | FirestoreTimestamp                     // ISO string
  updatedAt: string | FirestoreTimestamp                     // ISO string
}

export interface RegisterData {
  email: string
  password: string
  fullName: string
  username: string
  phone?: string
  role?: "buyer" | "seller" | "both"
}

// ─── Listing ─────────────────────────────────────────────────────
export type ListingType      = "sale" | "rent" | "both"
export type ListingCondition = "brand_new" | "open_box" | "grade_a" | "grade_b"
export type ListingStatus    = "draft" | "pending" | "active" | "sold" | "rented" | "paused" | "suspended" | "rejected"
export type BoostType        = "standard" | "premium" | "category_top" | null

export interface Listing {
  id: string
  sellerId: string
  categoryId: string
  categorySlug: string
  title: string
  slug: string
  description: string
  listingType: ListingType
  condition: ListingCondition
  priceSale: number                     // kobo
  priceRentDaily?: number
  priceRentWeekly?: number
  depositAmount?: number
  images: string[]
  verificationVideo?: string
  attributes: Record<string, any>
  isHubVerified: boolean
  isActive: boolean
  isBoosted: boolean
  boostType: BoostType
  boostExpiresAt?: string               // ISO string
  status: ListingStatus
  rejectionReason?: string
  nigerianState: string
  city: string
  deliveryNationwide: boolean
  views: number
  saves: number
  inquiries: number
  sellerName?: string
  sellerPlan?: "free" | "starter" | "pro"
  sellerRating?: number
  sellerVerified?: boolean
  flashDeal?: {
    discountPercent: number
    expiresAt: string | FirestoreTimestamp                   // ISO string
    createdAt: string | FirestoreTimestamp
  } | null
  createdAt: string | FirestoreTimestamp                     // ISO string
  updatedAt: string | FirestoreTimestamp                     // ISO string
}

export interface ListingFilters {
  category?: string
  listingType?: ListingType
  condition?: ListingCondition
  nigerianState?: string
  minPrice?: number
  maxPrice?: number
  verified?: boolean
  q?: string
  sort?: "price_asc" | "price_desc" | "newest"
}

export interface PaginatedResult<T> {
  items: T[]
  nextCursor: unknown | null            // opaque — pass back to next call
  hasMore: boolean
}

// ─── Category ────────────────────────────────────────────────────
export interface Category {
  id: string
  name: string
  slug: string
  icon?: string
  phase?: number
  order: number
}

// ─── Order ───────────────────────────────────────────────────────
export type OrderType = "purchase" | "rental"

export interface Order {
  id: string
  buyerId: string
  sellerId: string
  listingId: string
  itemTitle: string
  itemImage?: string
  sellerName?: string
  sellerStoreName?: string
  buyerName?: string
  totalAmount: number                   // kobo
  sellerPayout: number                  // kobo
  platformFee: number                   // kobo
  status: string
  orderType: OrderType
  escrowStatus: string
  escrowReleaseAt?: string              // ISO string
  autoReleased?: boolean
  chatId?: string
  trackingNumber?: string
  logisticsProvider?: string
  rentalStart?: string                  // ISO string
  rentalEnd?: string                    // ISO string
  rentalDays?: number
  disputeId?: string
  createdAt: string | FirestoreTimestamp                     // ISO string
  updatedAt: string | FirestoreTimestamp                     // ISO string
  completedAt?: string
  deliveredAt?: string | FirestoreTimestamp
  refundedAt?: string
}

// ─── Dispute ─────────────────────────────────────────────────────
export type DisputeReason =
  | "item_not_received" | "item_not_as_described" | "wrong_item_sent"
  | "damaged_item" | "seller_unresponsive" | "other"

export type DisputeVerdict =
  | "refund_buyer" | "release_seller" | "partial_refund" | "escalate"

export interface Dispute {
  id: string
  orderId: string
  buyerId: string
  sellerId: string
  raisedBy: "buyer" | "seller"
  reason: DisputeReason
  description: string
  evidence?: string[]
  status: string
  verdict?: DisputeVerdict
  refundPercent?: number
  sellerResponse?: string
  sellerRespondedAt?: string            // ISO string
  moderatorId?: string
  moderatorNotes?: string
  autoResolved?: boolean
  autoResolvedAt?: string
  autoResolvedBy?: string
  autoResolvedNotes?: string
  createdAt: string | FirestoreTimestamp                     // ISO string
  updatedAt: string | FirestoreTimestamp
  resolvedAt?: string | FirestoreTimestamp
}

// ─── Offer ───────────────────────────────────────────────────────
export type OfferStatus = "pending" | "accepted" | "rejected" | "expired" | "countered" | "declined"

export interface Offer {
  id: string
  listingId: string
  listingTitle: string
  listingImage?: string
  buyerId: string
  buyerName?: string
  sellerId: string
  sellerName?: string
  originalPrice: number                 // kobo
  offerAmount: number                   // kobo
  counterAmount?: number
  message?: string
  status: OfferStatus
  expiresAt: string | FirestoreTimestamp                     // ISO string
  createdAt: string | FirestoreTimestamp                     // ISO string
  updatedAt: string | FirestoreTimestamp                     // ISO string
  respondedAt?: string
}

// ─── Wallet ──────────────────────────────────────────────────────
export interface SellerWallet {
  userId: string
  balance: number                       // kobo
  pendingBalance: number                // kobo
  totalEarned: number                   // kobo
  updatedAt: string | FirestoreTimestamp                     // ISO string
}

export interface WalletTransaction {
  id: string
  userId: string
  type: string
  amount: number                        // kobo
  balanceAfter: number                  // kobo
  description: string
  orderId?: string
  reference?: string
  createdAt: string | FirestoreTimestamp                     // ISO string
}

export interface PayoutRequest {
  id: string
  userId: string
  amount: number                        // kobo
  bankName: string
  accountNumber: string
  accountName: string
  status: string
  paystackRecipientCode?: string
  paystackReference?: string
  failureReason?: string
  createdAt: string | FirestoreTimestamp                     // ISO string
  processedAt?: string
}

// ─── Notification ────────────────────────────────────────────────
export type NotificationType =
  | "order_update" | "dispute_update" | "dispute_auto_resolved"
  | "offer_received" | "offer_accepted" | "offer_rejected"
  | "listing_approved" | "listing_rejected" | "search_alert"
  | "badge_earned" | "payout_update" | "verification_update" | "system"

export interface Notification {
  id: string
  userId: string
  type: NotificationType
  title: string
  body: string
  link?: string
  listingImage?: string
  isRead: boolean
  createdAt: string | FirestoreTimestamp                     // ISO string
}

// ─── Chat ────────────────────────────────────────────────────────
export interface ChatMessage {
  id: string
  senderId: string
  text: string
  createdAt: string | FirestoreTimestamp                     // ISO string
  isBlocked: boolean
}

export interface Chat {
  id: string
  participants: string[]
  listingId?: string
  orderId?: string
  isLocked: boolean                     // true = escrow not yet funded
  lastMessage?: string
  lastMessageAt?: string | FirestoreTimestamp
  createdAt: string | FirestoreTimestamp
}

// ─── Agent / Referral wallets ────────────────────────────────────
export interface AgentWallet {
  balance: number
  totalEarned: number
  ownerId?: string
  agentId?: string
  agentUserId?: string
  createdAt?: string | FirestoreTimestamp
}

export interface AgentWalletTransaction {
  id: string
  amount: number
  type: string
  reason: string
  fromUserId?: string
  shipmentId?: string
  createdAt: string | FirestoreTimestamp
}

// ─── Storage ─────────────────────────────────────────────────────
export interface UploadResult {
  url: string
  path: string
}

// ─── Blog ─────────────────────────────────────────────────────────
export type { BlogPost, BlogFilters, BlogStatus, BlogEditorMode, BlogCategory, PaginatedBlogResult } from "./blog"
export { BLOG_CATEGORIES } from "./blog"


// ─── From legacy types/logistics.ts ───────────────────────────────────────────
export type DeliveryMethod = "meetup" | "zamorax_logistics" | "fbz"

export type ShipmentStatus =
  | "awaiting_dropoff"      // seller has not dropped off yet
  | "dropped_off"           // seller dropped at origin agent
  | "in_transit"            // moving between agents
  | "at_destination_agent"  // arrived at buyer's nearest agent
  | "out_for_delivery"      // agent on the way to buyer (doorstep)
  | "delivered"             // buyer confirmed receipt
  | "failed_delivery"       // could not deliver — returned to agent
  | "returned"              // returned to seller's agent

export type AgentLocationType = "zamorax_agent" | "partner_hub" | "warehouse"

export interface AgentLocation {
  id: string
  name: string                   // e.g. "Ikeja Agent — Bayo Stores"
  agentUserId: string            // uid of the Zamorax agent user
  agentName: string
  agentPhone: string
  address: string
  state: string
  city: string
  lga: string
  lat: number
  lng: number
  type: AgentLocationType
  isActive: boolean
  operatingHours: string         // e.g. "Mon–Sat 8am–6pm"
  maxCapacity: number            // max parcels they can hold
  currentLoad: number            // current parcels in custody
  createdAt: string | FirestoreTimestamp
}
export interface ZamoraxShipment {
  id: string
  orderId: string
  listingId: string
  listingTitle: string
  listingImage?: string

  sellerId: string
  sellerName: string
  sellerPhone: string

  buyerId: string
  buyerName: string
  buyerPhone: string
  buyerAddress: string           // for doorstep delivery
  buyerState: string
  buyerCity: string

  originAgentId: string          // agent where seller drops off
  originAgentName: string
  destinationAgentId: string     // agent nearest to buyer
  destinationAgentName: string

  deliveryType: "agent_pickup" | "doorstep"  // buyer picks up OR we deliver to door
  deliveryFee: number            // kobo — paid by buyer at checkout

  trackingCode: string           // e.g. "ZML-ABC123"
  status: ShipmentStatus
  timeline: ShipmentEvent[]

  currentAgentId?: string        // which agent currently holds the parcel
  currentAgentName?: string

  estimatedDeliveryDays: number
  weight?: number                // kg, optional
  notes?: string

  createdAt: string | FirestoreTimestamp
  updatedAt: string | FirestoreTimestamp
  deliveredAt?: string | FirestoreTimestamp
}
export interface ShipmentEvent {
  status: ShipmentStatus
  agentId?: string
  agentName?: string
  note: string
  timestamp: string | FirestoreTimestamp
  scannedBy?: string             // agent uid who scanned
}
export type DeliveryZone = "intrastate" | "southwest" | "southeast" | "northcentral" | "northwest" | "northeast" | "southsouth"

export const ZONE_MAP: Record<string, DeliveryZone> = {
  "Lagos": "southwest", "Ogun": "southwest", "Oyo": "southwest",
  "Osun": "southwest", "Ondo": "southwest", "Ekiti": "southwest",
  "Enugu": "southeast", "Anambra": "southeast", "Imo": "southeast",
  "Abia": "southeast", "Ebonyi": "southeast",
  "Kogi": "northcentral", "Benue": "northcentral", "Nasarawa": "northcentral",
  "Plateau": "northcentral", "Niger": "northcentral", "Kwara": "northcentral", "FCT": "northcentral",
  "Kano": "northwest", "Kaduna": "northwest", "Katsina": "northwest",
  "Sokoto": "northwest", "Zamfara": "northwest", "Kebbi": "northwest", "Jigawa": "northwest",
  "Borno": "northeast", "Yobe": "northeast", "Adamawa": "northeast",
  "Gombe": "northeast", "Taraba": "northeast", "Bauchi": "northeast",
  "Rivers": "southsouth", "Delta": "southsouth", "Edo": "southsouth",
  "Bayelsa": "southsouth", "Cross River": "southsouth", "Akwa Ibom": "southsouth",
}

export const DELIVERY_FEES: Record<DeliveryZone, Record<DeliveryZone, number>> = {
  intrastate:   { intrastate: 500, southwest: 1500, southeast: 3000, southsouth: 3000, northwest: 4000, northeast: 5000, northcentral: 3500 },
  southwest:    { intrastate: 1500, southwest: 1500, southeast: 3000, southsouth: 3000, northwest: 4000, northeast: 5000, northcentral: 3500 },
  southeast:    { intrastate: 2500, southwest: 3000, southeast: 1500, southsouth: 2500, northwest: 5000, northeast: 4500, northcentral: 3500 },
  southsouth:   { intrastate: 2500, southwest: 3000, southeast: 2500, southsouth: 1500, northwest: 5000, northeast: 4500, northcentral: 3500 },
  northwest:    { intrastate: 3500, southwest: 4000, southeast: 5000, southsouth: 5000, northwest: 1500, northeast: 3000, northcentral: 2500 },
  northeast:    { intrastate: 4000, southwest: 5000, southeast: 4500, southsouth: 4500, northwest: 3000, northeast: 1500, northcentral: 2500 },
  northcentral: { intrastate: 3000, southwest: 3500, southeast: 3500, southsouth: 3500, northwest: 2500, northeast: 2500, northcentral: 1500 },
}

export function calculateDeliveryFee(fromState: string, toState: string): number {
  const STATE_ZONE: Record<string, DeliveryZone> = {
    "Lagos": "southwest", "Ogun": "southwest", "Oyo": "southwest", "Osun": "southwest", "Ondo": "southwest", "Ekiti": "southwest",
    "Enugu": "southeast", "Anambra": "southeast", "Imo": "southeast", "Abia": "southeast", "Ebonyi": "southeast",
    "Rivers": "southsouth", "Delta": "southsouth", "Edo": "southsouth", "Bayelsa": "southsouth", "Cross River": "southsouth", "Akwa Ibom": "southsouth",
    "Kano": "northwest", "Kaduna": "northwest", "Katsina": "northwest", "Sokoto": "northwest", "Zamfara": "northwest", "Kebbi": "northwest", "Jigawa": "northwest",
    "Borno": "northeast", "Yobe": "northeast", "Adamawa": "northeast", "Gombe": "northeast", "Taraba": "northeast", "Bauchi": "northeast",
    "Abuja": "northcentral", "Niger": "northcentral", "Kwara": "northcentral", "Kogi": "northcentral", "Benue": "northcentral", "Plateau": "northcentral", "Nasarawa": "northcentral",
  }
  const from = STATE_ZONE[fromState] ?? "southwest"
  const to   = STATE_ZONE[toState]   ?? "southwest"
  return DELIVERY_FEES[from]?.[to] ?? 3500
}

export function generateTrackingCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  const rand  = (n: number) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
  return `ZMX-${rand(4)}-${rand(6)}`
}

export const SHIPMENT_STATUS_CONFIG: Record<ShipmentStatus, { label: string; color: string; description: string }> = {
  pending:           { label: "Pending",          color: "bg-gray-100 text-gray-700",     description: "Awaiting seller action" },
  seller_confirmed:  { label: "Confirmed",        color: "bg-blue-100 text-blue-700",     description: "Seller confirmed the order" },
  dropped_off:       { label: "Dropped Off",      color: "bg-indigo-100 text-indigo-700", description: "Item at ZLA agent" },
  picked_up_by_zla:  { label: "Picked Up",        color: "bg-purple-100 text-purple-700", description: "ZLA agent collected item" },
  in_warehouse:      { label: "In Warehouse",     color: "bg-yellow-100 text-yellow-700", description: "Item at Zamorax warehouse" },
  out_for_delivery:  { label: "Out for Delivery", color: "bg-orange-100 text-orange-700", description: "On the way to buyer" },
  delivered:         { label: "Delivered",        color: "bg-green-100 text-green-700",   description: "Delivered to buyer" },
  disputed:          { label: "Disputed",         color: "bg-red-100 text-red-700",       description: "Dispute opened" },
  returned:          { label: "Returned",         color: "bg-gray-100 text-gray-600",     description: "Item returned to seller" },
}

export type FirestoreTimestamp = { toDate: () => Date; seconds: number; nanoseconds: number }
export type FirestoreDoc = { id: string; [key: string]: any }
export interface AgentWallet {
  balance: number
  totalEarned: number
  totalWithdrawn: number
  updatedAt?: string | FirestoreTimestamp | FirestoreTimestamp
}
