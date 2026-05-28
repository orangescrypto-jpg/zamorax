import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Safety Guidelines — Zamorax",
  description: "Learn how Zamorax protects you with escrow, verification, category-specific checks, and our insurance pool.",
}

export default function SafetyPage() {
  return (
    <div className="container py-12 max-w-4xl space-y-8">
      <h1 className="text-3xl md:text-4xl font-heading font-bold">Safety & Trust Guidelines</h1>
      
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">How Our Escrow Protects You</h2>
        <p>Zamorax never sends money directly to sellers upfront. Every payment is held in a secure escrow account until you confirm the item matches the listing. This means you can inspect phones, laptops, or rentals with zero financial risk.</p>
        <ol className="list-decimal pl-6 space-y-2 text-muted-foreground">
          <li>You pay → funds enter escrow.</li>
          <li>Seller ships/hands over item.</li>
          <li>You have 24 hours to inspect.</li>
          <li>If satisfied → click "Confirm Receipt" → funds release to seller.</li>
          <li>If not → open dispute → admin reviews evidence → resolves fairly.</li>
        </ol>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Verification Levels Explained</h2>
        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
          <li><strong>🟢 NIN Verified:</strong> Government ID confirmed. Basic trust tier.</li>
          <li><strong>🟡 NIN + BVN Verified:</strong> Full identity & banking link. Required for sellers. Enables withdrawals & higher listing limits.</li>
          <li><strong>🟠 Hub Verified:</strong> Physical item inspection completed by Zamorax partner. Highest trust badge for premium listings.</li>
          <li><strong>🔵 Partner Store:</strong> Officially registered grocery/retail merchant. All stock is sealed & expiry-validated.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Category-Specific Safety Tips</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-4 border rounded-lg bg-muted/20">
            <h3 className="font-medium mb-2">📱 Phones & Electronics</h3>
            <p className="text-sm text-muted-foreground">Always verify IMEI matches the box & settings. Watch the mandatory power-on/boot video before buying. Flagged IMEIs are blocked automatically.</p>
          </div>
          <div className="p-4 border rounded-lg bg-muted/20">
            <h3 className="font-medium mb-2">💻 Laptops & Computing</h3>
            <p className="text-sm text-muted-foreground">Request boot video for used devices. Check serial number matches chassis. Verify RAM/storage specs in OS settings before confirming receipt.</p>
          </div>
          <div className="p-4 border rounded-lg bg-muted/20">
            <h3 className="font-medium mb-2">👗 Fashion & Apparel</h3>
            <p className="text-sm text-muted-foreground">Only real photos allowed. AI flags stock images. Rentals include hygiene seals & dry-cleaning fee transparency. Swimwear/underwear rentals are blocked.</p>
          </div>
          <div className="p-4 border rounded-lg bg-muted/20">
            <h3 className="font-medium mb-2">🔌 Generators & Large Appliances</h3>
            <p className="text-sm text-muted-foreground">Mandatory cold-start video required. Pickup-only policy for items over 50kg. Verify fuel type & voltage compatibility before purchase.</p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">How to Spot & Avoid Scams</h2>
        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
          <li>Never communicate or pay outside Zamorax. Off-platform transactions void all protection.</li>
          <li>Beware of "too good to be true" pricing. Cross-check with fair price indicators on listings.</li>
          <li>Ignore requests to click external payment links. All payments happen inside our secure checkout.</li>
          <li>Verify seller badges & join date. New accounts with high-value listings are flagged for review.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Our Insurance Pool</h2>
        <p>0.5% of every transaction funds a transparent insurance pool. This covers verified losses from fraud, shipping damage, or seller non-delivery. You can view live pool balances on our homepage and admin dashboard. Claims are audited and resolved within 72 hours.</p>
      </section>

      <div className="pt-6 border-t">
        <p className="text-muted-foreground">Report Fraud or Safety Concerns: <strong>safety@zamorax.ng</strong></p>
        <p className="text-muted-foreground">Emergency WhatsApp Support: [+234 XXX XXX XXXX] (Business Hours: 8AM–8PM WAT)</p>
      </div>
    </div>
  )
}
