"use client"
// app/(seller)/dashboard/seller/withdraw/page.tsx
// Consolidated into /dashboard/seller/earnings, which already has the
// same WithdrawalForm + live balance. Redirecting (not deleting) so any
// existing bookmarks/links to this URL still land somewhere useful.
import { redirect } from "next/navigation"

export default function WithdrawRedirectPage() {
  redirect("/dashboard/seller/earnings")
}
