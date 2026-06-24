// constants/status.ts
// Single source of truth for all status strings used across the app.
// Import these instead of writing raw strings anywhere.

export const LISTING_STATUS = {
  DRAFT:     "draft",
  PENDING:   "pending",
  ACTIVE:    "active",
  SOLD:      "sold",
  RENTED:    "rented",
  PAUSED:    "paused",
  REJECTED:  "rejected",
  SUSPENDED: "suspended",
} as const
export type ListingStatus = typeof LISTING_STATUS[keyof typeof LISTING_STATUS]

export const ORDER_STATUS = {
  PENDING:        "pending",
  PAID:           "paid",
  SHIPPED:        "shipped",
  DELIVERED:      "delivered",
  INSPECTING:     "inspecting",
  COMPLETED:      "completed",
  DISPUTED:       "disputed",
  CANCELLED:      "cancelled",
  REFUNDED:       "refunded",
  PARTIAL_REFUND: "partial_refund",
} as const
export type OrderStatus = typeof ORDER_STATUS[keyof typeof ORDER_STATUS]

export const ESCROW_STATUS = {
  HELD:               "held",
  RELEASED_TO_SELLER: "released_to_seller",
  REFUNDED_TO_BUYER:  "refunded_to_buyer",
  PARTIAL_REFUND:     "partial_refund",
} as const
export type EscrowStatus = typeof ESCROW_STATUS[keyof typeof ESCROW_STATUS]

export const DISPUTE_STATUS = {
  OPEN:         "open",
  INVESTIGATING:"investigating",
  RESOLVED:     "resolved",
  ESCALATED:    "escalated",
  AUTO_RESOLVED:"auto_resolved",
} as const
export type DisputeStatus = typeof DISPUTE_STATUS[keyof typeof DISPUTE_STATUS]

export const VERIFICATION_STATUS = {
  PENDING_REVIEW: "pending_review",
  APPROVED:       "approved",
  REJECTED:       "rejected",
} as const
export type VerificationStatus = typeof VERIFICATION_STATUS[keyof typeof VERIFICATION_STATUS]

export const ZLA_STATUS = {
  PENDING:  "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
} as const
export type ZlaStatus = typeof ZLA_STATUS[keyof typeof ZLA_STATUS]

export const USER_ROLE = {
  BUYER:     "buyer",
  SELLER:    "seller",
  BOTH:      "both",
  ADMIN:     "admin",
  MODERATOR: "moderator",
} as const
export type UserRole = typeof USER_ROLE[keyof typeof USER_ROLE]

export const PLAN = {
  FREE:    "free",
  STARTER: "starter",
  PRO:     "pro",
} as const
export type Plan = typeof PLAN[keyof typeof PLAN]

export const TX_TYPE = {
  CREDIT: "credit",
  DEBIT:  "debit",
  PAYOUT: "payout",
  REFUND: "refund",
} as const
export type TxType = typeof TX_TYPE[keyof typeof TX_TYPE]

export const PAYOUT_STATUS = {
  PENDING:    "pending",
  PROCESSING: "processing",
  COMPLETED:  "completed",
  FAILED:     "failed",
} as const
export type PayoutStatus = typeof PAYOUT_STATUS[keyof typeof PAYOUT_STATUS]

export const SHIPMENT_STATUS = {
  AWAITING_DROPOFF:     "awaiting_dropoff",
  DROPPED_OFF:          "dropped_off",
  IN_TRANSIT:           "in_transit",
  AT_DESTINATION_AGENT: "at_destination_agent",
  OUT_FOR_DELIVERY:     "out_for_delivery",
  DELIVERED:            "delivered",
  FAILED_DELIVERY:      "failed_delivery",
  RETURNED:             "returned",
} as const
export type ShipmentStatus = typeof SHIPMENT_STATUS[keyof typeof SHIPMENT_STATUS]
