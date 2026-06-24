// src/services/orders.ts
// WAS FIREBASE → NOW CLOUDFLARE D1
import type { Order, PaginatedResult } from "@/src/types"
export { OrdersService } from "@/src/services/providers/cloudflare/orders"
export interface IOrdersService {
  getOrderById(id: string): Promise<Order | null>
  getOrdersByBuyer(buyerId: string, cursor?: unknown): Promise<PaginatedResult<Order>>
  getOrdersBySeller(sellerId: string, cursor?: unknown): Promise<PaginatedResult<Order>>
  createOrder(data: Omit<Order, "id" | "createdAt" | "updatedAt">): Promise<{ id: string }>
  updateOrderStatus(orderId: string, status: string, extra?: Record<string, unknown>): Promise<void>
  confirmDelivery(orderId: string, buyerId: string): Promise<void>
  releaseEscrow(orderId: string, buyerId: string): Promise<void>
  subscribeToOrder(orderId: string, callback: (order: Order | null) => void): () => void
  subscribeToAllOrders(callback: (orders: Order[]) => void): () => void
  getAllOrders(): Promise<Order[]>
}
