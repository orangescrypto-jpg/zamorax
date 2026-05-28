import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Terms of Service — Zamorax",
  description: "Clear, fair rules for buying, selling, and renting on Zamorax. Understand escrow, fees, verification, and dispute resolution.",
}

export default function TermsPage() {
  return (
    <div className="container py-12 max-w-4xl space-y-8">
      <h1 className="text-3xl md:text-4xl font-heading font-bold">Terms of Service</h1>
      <p className="text-muted-foreground">Effective Date: May 2026</p>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">1. Acceptance of Terms</h2>
        <p>By accessing or using Zamorax ("Platform"), you agree to be bound by these Terms. If you do not agree, please do not use our services. These terms apply to all visitors, buyers, sellers, and renters.</p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">2. Eligibility & Accounts</h2>
        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
          <li>You must be at least 18 years old and a resident of Nigeria to create an account.</li>
          <li>One account per verified identity (NIN). Duplicate or fraudulent accounts will be suspended.</li>
          <li>You are responsible for maintaining the confidentiality of your login credentials and all activity under your account.</li>
          <li>Sellers must complete NIN + BVN verification before withdrawing funds or posting commercial listings.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">3. Listing & Transaction Rules</h2>
        <p><strong>Listings:</strong> Must be accurate, lawful, and photographed by the uploader. Stock images are prohibited in Fashion. Used electronics require boot/power-on videos. Groceries must come from verified partner stores and display expiry dates.</p>
        <p><strong>Prohibited Items:</strong> Weapons, illegal drugs, counterfeit goods, stolen electronics (IMEI flagged), unsealed food/medicine, live animals, adult content, and underwear for rent.</p>
        <p><strong>Rentals:</strong> Subject to deposit requirements (typically 20–50%). Renters must return items in original condition. Cleaning/damage fees may apply. Large appliances & generators are pickup-only.</p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">4. Escrow & Payment Mechanics</h2>
        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
          <li>All purchases and rentals are processed through Zamorax Escrow.</li>
          <li>Funds are held securely until the buyer confirms receipt and condition within a 24-hour inspection window.</li>
          <li>If no dispute is raised within 24 hours of delivery confirmation, funds auto-release to the seller.</li>
          <li>Rental deposits are held until item return. Deductions apply for damage or late returns.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">5. Fee Schedule</h2>
        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
          <li>Sales Commission: 3.5% of item price</li>
          <li>Rental Commission: 8% of rental fee</li>
          <li>Insurance Pool: 0.5% of transaction value</li>
          <li>Withdrawal to Bank: ₦100 flat fee per payout</li>
          <li>Listing Boosts: ₦500 (Standard), ₦1,500 (Premium), ₦3,000 (Category Top) for 7 days</li>
          <li>Subscriptions: Starter ₦1,500/mo, Pro ₦3,500/mo</li>
          <li>Hub Verification: ₦1,000 per verified listing</li>
        </ul>
        <p>Fees are deducted transparently before seller payout. All prices are in Nigerian Naira (₦).</p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">6. Dispute Resolution</h2>
        <p>If a transaction goes wrong, buyers may open a dispute within 24 hours of delivery. Zamorax admin will review evidence (photos, videos, IMEI status, condition reports) and issue one of three resolutions: full refund to buyer, release to seller, or split payout based on fault. Insurance pool covers verified platform-side losses. Fraudulent dispute claims may result in account suspension.</p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">7. Limitation of Liability</h2>
        <p>Zamorax acts as an intermediary marketplace. We do not own, store, or guarantee the quality of listed items. We facilitate secure payments and verification but are not liable for indirect, incidental, or consequential damages arising from user transactions, provided we have acted in good faith and followed published safety protocols.</p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">8. Governing Law & Jurisdiction</h2>
        <p>These Terms are governed by the laws of the Federal Republic of Nigeria. Any disputes shall be resolved in the courts of Lagos State. We encourage mediation before litigation.</p>
      </section>

      <div className="pt-6 border-t">
        <p className="text-muted-foreground">Legal Inquiries: <strong>legal@zamorax.ng</strong></p>
      </div>
    </div>
  )
}
