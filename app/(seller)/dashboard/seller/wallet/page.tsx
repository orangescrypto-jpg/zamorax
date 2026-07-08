"use client"
// app/(seller)/dashboard/seller/wallet/page.tsx
// Consolidated into /dashboard/seller/earnings — that page already shows
// live D1 balance + full transaction history for both manual and Paystack
// orders. This route is kept only because it's linked from notifications,
// transactional emails (WithdrawalRequested, EscrowReleased, WithdrawalPaid),
// the seller sidebar, dashboard tiles, and settings copy — redirecting here
// instead of deleting the page avoids breaking any of those existing links.
import { redirect } from "next/navigation"

export default function WalletRedirectPage() {
  redirect("/dashboard/seller/earnings")
}
