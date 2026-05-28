import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Privacy Policy — Zamorax",
  description: "Learn how Zamorax collects, secures, and protects your data. We prioritize transparency, NDPR compliance, and end-to-end encryption.",
}

export default function PrivacyPage() {
  return (
    <div className="container py-12 max-w-4xl space-y-8">
      <h1 className="text-3xl md:text-4xl font-heading font-bold">Privacy Policy</h1>
      <p className="text-muted-foreground">Last Updated: May 2026</p>
      
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">1. Who We Are</h2>
        <p>Zamorax is a Nigerian-first marketplace built on trust, transparency, and secure transactions. We connect buyers, sellers, and renters across Nigeria with verified identities, protected payments, and clear dispute resolution. This policy explains how we collect, use, store, and protect your personal data in compliance with the Nigeria Data Protection Regulation (NDPR).</p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">2. Information We Collect</h2>
        <p>We only collect what's necessary to keep our platform secure and functional:</p>
        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
          <li><strong>Account Information:</strong> Full name, email address, phone number, and username.</li>
          <li><strong>Identity Verification:</strong> National Identification Number (NIN) and Bank Verification Number (BVN) for sellers and high-trust accounts. These are encrypted at rest using AES-256 and are never displayed publicly or shared with other users.</li>
          <li><strong>Transaction Data:</strong> Order history, payment references, delivery addresses, and chat logs related to transactions.</li>
          <li><strong>Listing & Media:</strong> Photos, videos, descriptions, and item specifications you upload.</li>
          <li><strong>Device & Usage Data:</strong> IP address, browser type, device model, and anonymized interaction metrics to improve performance and detect fraud.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">3. How We Use Your Data</h2>
        <p>Your data powers our trust infrastructure. We use it to:</p>
        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
          <li>Verify identities and prevent fraud or duplicate accounts.</li>
          <li>Process payments, hold escrow funds, and release payouts securely.</li>
          <li>Facilitate buyer-seller communication and rental handovers.</li>
          <li>Enforce category-specific safety rules (e.g., IMEI checks, expiry validation, hygiene seals).</li>
          <li>Improve search, personalize recommendations, and fix technical issues.</li>
        </ul>
        <p><strong>We never sell, rent, or trade your personal data to third parties.</strong></p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">4. Third-Party Processors</h2>
        <p>We partner with trusted, regulated companies to deliver our services:</p>
        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
          <li><strong>Payments:</strong> Paystack & Flutterwave handle all financial transactions. They comply with PCI-DSS standards.</li>
          <li><strong>Logistics:</strong> GIGL, Kwik, and Sendbox manage delivery tracking and address routing.</li>
          <li><strong>Identity Verification:</strong> NIBSS/Smile ID validate NIN and BVN securely.</li>
          <li><strong>Communications:</strong> Termii/Africa's Talking deliver SMS OTPs and WhatsApp notifications.</li>
        </ul>
        <p>Each partner is contractually bound to use your data only for the specific service requested.</p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">5. Data Security & Retention</h2>
        <p>We employ industry-standard security measures:</p>
        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
          <li>All sensitive identifiers (NIN/BVN) are encrypted using AES-256 at rest and TLS 1.3 in transit.</li>
          <li>Access is strictly role-based. Only authorized compliance staff can view verification data, and all access is logged.</li>
          <li>Inactive accounts are archived after 24 months of no activity. You may request immediate deletion at any time.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">6. Your Rights Under NDPR</h2>
        <p>You have the right to:</p>
        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
          <li>Access, correct, or update your personal information.</li>
          <li>Request a full export of your data.</li>
          <li>Request permanent deletion of your account and associated data (subject to legal/financial retention requirements).</li>
          <li>Withdraw consent for marketing communications without affecting core platform functionality.</li>
        </ul>
        <p>To exercise these rights, contact <strong>privacy@zamorax.ng</strong> with your registered email. We respond within 14 business days.</p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">7. Cookies & Local Storage</h2>
        <p>We use essential cookies for authentication, session management, and security tokens. We may use analytics cookies to understand feature usage. You can disable non-essential cookies in your browser settings, but core app functionality requires session cookies to remain active.</p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">8. Updates to This Policy</h2>
        <p>We may update this policy to reflect product changes, legal requirements, or security improvements. We will notify users via email or in-app notice for material changes. Continued use of Zamorax after updates constitutes acceptance of the revised terms.</p>
      </section>

      <div className="pt-6 border-t">
        <p className="text-muted-foreground">For privacy inquiries, contact: <strong>privacy@zamorax.ng</strong></p>
        <p className="text-muted-foreground">Mailing: Zamorax Compliance Team, [Your Office Address], Lagos, Nigeria.</p>
      </div>
    </div>
  )
}
