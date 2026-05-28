// src/services/orders.ts
// ─────────────────────────────────────────────────────────────────
// Orders + Escrow service — public interface.
// ─────────────────────────────────────────────────────────────────

import type { Order, PaginatedResult } from "@/src/types"

// ── Switch provider here ─────────────────────────────────────────
export { OrdersService } from "@/src/services/providers/firebase/orders"
// ─────────────────────────────────────────────────────────────────

export interface IOrdersService {
  getOrderById(id: string): Promise<Order | null>
  getOrdersByBuyer(buyerId: string, cursor?: unknown): Promise<PaginatedResult<Order>>
  getOrdersBySeller(sellerId: string, cursor?: unknown): Promise<PaginatedResult<Order>>

  /** Create order after successful Paystack payment */
  createOrder(data: Omit<Order, "id" | "createdAt" | "updatedAt">): Promise<{ id: string }>

  updateOrderStatus(orderId: string, status: string, extra?: Record<string, unknown>): Promise<void>

  /** Buyer confirms item received — triggers escrow release timer */
  confirmDelivery(orderId: string, buyerId: string): Promise<void>

  /** Manual early escrow release by buyer */
  releaseEscrow(orderId: string, buyerId: string): Promise<void>

  /** Subscribe to a single order in real-time */
  subscribeToOrder(orderId: string, callback: (order: Order | null) => void): () => void

  /** Admin: subscribe to all orders for real-time stats */
  subscribeToAllOrders(callback: (orders: Order[]) => void): () => void

  /** Admin: get all orders for stats */
  getAllOrders(): Promise<Order[]>
}
