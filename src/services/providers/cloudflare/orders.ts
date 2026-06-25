// src/services/providers/cloudflare/orders.ts
// WAS FIREBASE/FIRESTORE → NOW CLOUDFLARE D1
import { AdminService } from "@/src/services/admin"
import type { IOrdersService } from "@/src/services/orders"
import type { Order, PaginatedResult } from "@/src/types"

const PAGE_SIZE = 20

function mapRow(row: Record<string, unknown>): Order {
  const parse = (v: unknown) => { try { return v ? JSON.parse(v as string) : undefined } catch { return undefined } }
  return {
    ...row,
    id:              String(row.id),
    listingId:       String(row.listing_id ?? row.listingId ?? ""),
    buyerId:         String(row.buyer_id   ?? row.buyerId   ?? ""),
    sellerId:        String(row.seller_id  ?? row.sellerId  ?? ""),
    itemTitle:       String(row.item_title ?? row.itemTitle ?? row.listing_title ?? ""),
    itemImage:       row.item_image ?? row.itemImage ?? row.listing_image
                       ? String(row.item_image ?? row.itemImage ?? row.listing_image)
                       : undefined,
    totalAmount:     Number(row.total_amount ?? row.totalAmount ?? row.amount ?? 0),
    platformFee:     Number(row.platform_fee  ?? row.platformFee  ?? 0),
    sellerPayout:    Number(row.seller_payout ?? row.sellerPayout ?? 0),
    orderType:       String(row.order_type ?? row.orderType ?? "sale") as Order["orderType"],
    status:          String(row.status ?? "pending"),
    escrowStatus:    String(row.escrow_status ?? row.escrowStatus ?? "held"),
    escrowReleaseAt: row.escrow_release_at ? String(row.escrow_release_at) : undefined,
    trackingNumber:  row.tracking_number   ? String(row.tracking_number)   : undefined,
    disputeId:       row.dispute_id        ? String(row.dispute_id)        : undefined,
    rentalStart:     row.rental_start      ? String(row.rental_start)      : undefined,
    rentalEnd:       row.rental_end        ? String(row.rental_end)        : undefined,
    completedAt:     row.completed_at      ? String(row.completed_at)      : undefined,
    deliveredAt:     row.delivered_at      ? String(row.delivered_at)      : undefined,
    refundedAt:      row.refunded_at       ? String(row.refunded_at)       : undefined,
    lineItems:       parse(row.line_items ?? row.lineItems),
    createdAt:       String(row.created_at ?? new Date().toISOString()),
    updatedAt:       String(row.updated_at ?? new Date().toISOString()),
  } as Order
}

export const OrdersService: IOrdersService = {

  async getOrderById(id) {
    const row = await AdminService.getDoc("orders", id)
    if (!row) return null
    return mapRow(row as Record<string, unknown>)
  },

  async getOrdersByBuyer(buyerId, _cursor) {
    const all = (await AdminService.getCollection("orders")) as Record<string, unknown>[]
    const filtered = all
      .filter(r => String(r.buyer_id ?? r.buyerId) === buyerId)
      .sort((a: any, b: any) => new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime())
    const page = filtered.slice(0, PAGE_SIZE)
    return { items: page.map(mapRow), nextCursor: null, hasMore: filtered.length > PAGE_SIZE }
  },

  async getOrdersBySeller(sellerId, _cursor) {
    const all = (await AdminService.getCollection("orders")) as Record<string, unknown>[]
    const filtered = all
      .filter(r => String(r.seller_id ?? r.sellerId) === sellerId)
      .sort((a: any, b: any) => new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime())
    const page = filtered.slice(0, PAGE_SIZE)
    return { items: page.map(mapRow), nextCursor: null, hasMore: filtered.length > PAGE_SIZE }
  },

  async createOrder(data) {
    return AdminService.addDoc("orders", {
      listing_id:      data.listingId,
      buyer_id:        data.buyerId,
      seller_id:       data.sellerId,
      item_title:      data.itemTitle      ?? null,
      item_image:      data.itemImage      ?? null,
      total_amount:    data.totalAmount,
      platform_fee:    data.platformFee    ?? 0,
      seller_payout:   data.sellerPayout   ?? 0,
      order_type:      data.orderType      ?? "sale",
      rental_start:    data.rentalStart    ?? null,
      rental_end:      data.rentalEnd      ?? null,
      status:          "pending",
      escrow_status:   "held",
      line_items:      data.lineItems ? JSON.stringify(data.lineItems) : null,
    })
  },

  async updateOrderStatus(orderId, status, extra = {}) {
    await AdminService.updateDoc("orders", orderId, { status, ...extra })
  },

  async confirmDelivery(orderId, _buyerId) {
    const escrowReleaseAt = new Date(Date.now() + 48 * 3600000).toISOString()
    await AdminService.updateDoc("orders", orderId, {
      status:            "inspecting",
      delivered_at:      new Date().toISOString(),
      escrow_release_at: escrowReleaseAt,
    })
  },

  async releaseEscrow(orderId, _buyerId) {
    await AdminService.updateDoc("orders", orderId, {
      status:             "completed",
      escrow_status:      "released_to_seller",
      released_to_seller: true,
      completed_at:       new Date().toISOString(),
    })
  },

  // WAS: onSnapshot → NOW: poll every 15s
  subscribeToOrder(orderId, callback) {
    let active = true
    const run = async () => {
      if (!active) return
      try {
        const row = await AdminService.getDoc("orders", orderId)
        callback(row ? mapRow(row as Record<string, unknown>) : null)
      } catch { /* ignore */ }
      if (active) setTimeout(run, 15_000)
    }
    run()
    return () => { active = false }
  },

  subscribeToAllOrders(callback) {
    let active = true
    const run = async () => {
      if (!active) return
      try {
        const all = (await AdminService.getCollection("orders")) as Record<string, unknown>[]
        callback(all.map(mapRow))
      } catch { /* ignore */ }
      if (active) setTimeout(run, 30_000)
    }
    run()
    return () => { active = false }
  },

  async getAllOrders() {
    const all = (await AdminService.getCollection("orders")) as Record<string, unknown>[]
    return all.map(mapRow)
  },
}
