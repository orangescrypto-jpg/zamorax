// lib/server/order-lookup.ts
// Indexed order lookups for server routes. Replaces the pattern
//   AdminService.getCollection("orders") + .find()/.filter()
// which loaded EVERY order into memory on each payment call.
// Requires migrations/0014_orders_payment_reference_index.sql.

import { d1Query } from "@/lib/d1"

export async function findOrdersByPaymentReference(
  reference: string,
  nativeDB?: unknown,
): Promise<Record<string, unknown>[]> {
  const res = await d1Query(
    // Cart orders stamp payment_reference too (see cart/create-pending-orders),
    // so this single indexed column covers both Buy Now and cart orders.
    "SELECT * FROM orders WHERE payment_reference = ?",
    [reference],
    nativeDB,
  )
  return ((res as any)?.results ?? []) as Record<string, unknown>[]
}

export async function findOrderIdByPaymentReference(
  reference: string,
  nativeDB?: unknown,
): Promise<string | null> {
  const res = await d1Query(
    "SELECT id FROM orders WHERE payment_reference = ? LIMIT 1",
    [reference],
    nativeDB,
  )
  const row = ((res as any)?.results ?? [])[0] as { id?: string } | undefined
  return row?.id ? String(row.id) : null
}
