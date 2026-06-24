import type { Metadata } from "next"
import { PageContentRenderer } from "@/components/PageContentRenderer"

export const metadata: Metadata = {
  title: "Disclaimer — Zamorax",
  description: "Important legal notices regarding platform liability, user-generated content, and third-party links.",
}

const DEFAULT_HTML = `
<div class="space-y-8">
  <h1 class="text-3xl md:text-4xl font-heading font-bold">Disclaimer</h1>
  <p class="text-muted-foreground">Last Updated: May 2026</p>
  <section class="space-y-4">
    <h2 class="text-xl font-semibold">Platform Liability</h2>
    <p>Zamorax is a marketplace platform. We facilitate transactions between buyers and sellers but are not a party to the underlying sale or rental agreement. We are not liable for product defects, late deliveries, or misrepresentation beyond the scope of our escrow protection.</p>
  </section>
  <section class="space-y-4">
    <h2 class="text-xl font-semibold">User-Generated Content</h2>
    <p>Listings, reviews, and messages are created by users. Zamorax does not endorse any user-generated content. We remove content that violates our policies but cannot guarantee the accuracy of all listings.</p>
  </section>
  <section class="space-y-4">
    <h2 class="text-xl font-semibold">Third-Party Links</h2>
    <p>Our platform may contain links to external sites. We have no control over and take no responsibility for the content or privacy practices of those sites.</p>
  </section>
  <section class="space-y-4">
    <h2 class="text-xl font-semibold">Financial Advice</h2>
    <p>Nothing on Zamorax constitutes financial, legal, or investment advice. Platform fee structures are subject to change with notice.</p>
  </section>
</div>
`

export default function DisclaimerPage() {
  return (
    <div className="container py-12 max-w-4xl">
      <PageContentRenderer slug="disclaimer" defaultHtml={DEFAULT_HTML} />
    </div>
  )
}
