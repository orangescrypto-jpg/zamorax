import type { Metadata } from "next"
import { PageContentRenderer } from "@/components/PageContentRenderer"
import { JoinCta } from "@/components/JoinCta"

export const metadata: Metadata = {
  title: "How It Works — Zamorax",
  description: "Step-by-step guide to buying, selling, and renting on Zamorax.",
}

const DEFAULT_HTML = `
<div class="space-y-8">
  <h1 class="text-3xl md:text-4xl font-heading font-bold">How Zamorax Works</h1>
  <p class="text-lg text-muted-foreground">A secure, transparent marketplace built for Nigeria. No hidden fees. No upfront risk. Just trust.</p>
  <section class="space-y-4">
    <h2 class="text-xl font-semibold">For Buyers</h2>
    <ol class="list-decimal pl-6 space-y-2 text-muted-foreground">
      <li>Create a free account and browse verified listings.</li>
      <li>Place your order — payment is held in escrow, not sent to the seller yet.</li>
      <li>Seller ships or hands over the item.</li>
      <li>Inspect the item within the inspection window.</li>
      <li>Confirm receipt to release payment. If there's a problem, file a dispute.</li>
    </ol>
  </section>
  <section class="space-y-4">
    <h2 class="text-xl font-semibold">For Sellers</h2>
    <ol class="list-decimal pl-6 space-y-2 text-muted-foreground">
      <li>Verify your identity (NIN + BVN) — one-time process.</li>
      <li>Create listings with photos, price, and condition details.</li>
      <li>Receive orders and deliver within agreed timelines.</li>
      <li>Get paid automatically once the buyer confirms receipt.</li>
    </ol>
  </section>
  <section class="space-y-4">
    <h2 class="text-xl font-semibold">For Renters</h2>
    <p>Browse rental listings, pay securely via escrow, and return the item in agreed condition. Deposits are held and released based on inspection outcome.</p>
  </section>
  <section class="space-y-4">
    <h2 class="text-xl font-semibold">Fees</h2>
    <ul class="list-disc pl-6 space-y-2 text-muted-foreground">
      <li><strong>Sales:</strong> 1.5% platform fee + 0.5% insurance contribution</li>
      <li><strong>Rentals:</strong> 4% platform fee + 0.5% insurance contribution</li>
      <li><strong>Withdrawals:</strong> ₦100 flat fee per withdrawal</li>
    </ul>
  </section>
</div>
`

export default function HowItWorksPage() {
  return (
    <div className="container py-12 max-w-4xl space-y-8">
      <PageContentRenderer slug="how-it-works" defaultHtml={DEFAULT_HTML} />
      <div className="pt-6 border-t text-center">
        <JoinCta />
      </div>
    </div>
  )
}
