"use client"

import { SellerOffersInbox } from "@/components/offers/SellerOffersInbox"
import { Tag } from "lucide-react"

export default function SellerOffersPage() {
  return (
    <main className="container max-w-lg py-6 pb-24 space-y-4">
      <h1 className="text-xl font-heading font-bold flex items-center gap-2">
        <Tag className="h-5 w-5" /> Offers Received
      </h1>
      <SellerOffersInbox />
    </main>
  )
}
