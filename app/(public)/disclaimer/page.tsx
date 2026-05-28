import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Disclaimer — Zamorax",
  description: "Important legal notices regarding platform liability, user-generated content, third-party links, and financial advice.",
}

export default function DisclaimerPage() {
  return (
    <div className="container py-12 max-w-4xl space-y-8">
      <h1 className="text-3xl md:text-4xl font-heading font-bold">Legal Disclaimer</h1>
      
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">1. Platform as an Intermediary</h2>
        <p>Zamorax is a digital marketplace that facilitates connections between independent buyers, sellers, and renters. We do not own, store, manufacture, or guarantee the quality, authenticity, or availability of any items listed on our platform. All listings are created and managed solely by users. Zamorax acts strictly as a secure transaction facilitator and communication channel.</p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">2. User-Generated Content</h2>
        <p>Photos, descriptions, videos, and reviews are provided by users and have not been independently verified by Zamorax prior to publication. While we employ AI moderation, manual review, and verification badges to reduce risk, we cannot guarantee absolute accuracy. Users are solely responsible for the truthfulness of their listings and compliance with applicable Nigerian laws.</p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">3. No Financial or Legal Advice</h2>
        <p>All content on Zamorax, including pricing guides, fee schedules, safety tips, and marketplace analytics, is provided for informational purposes only. It does not constitute financial, legal, or tax advice. Users should consult qualified professionals before making significant purchasing, rental, or business decisions based on platform data.</p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">4. Third-Party Links & Services</h2>
        <p>Our platform may contain links to external websites, payment gateways (Paystack, Flutterwave), logistics providers (GIGL, Kwik), or verification services. Zamorax does not control, endorse, or assume responsibility for the content, privacy practices, or terms of these third parties. Interactions with external services are at your own risk.</p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">5. Limitation of Liability</h2>
        <p>To the fullest extent permitted by Nigerian law, Zamorax, its directors, employees, and partners shall not be liable for any direct, indirect, incidental, or consequential damages arising from:
        <ul className="list-disc pl-6 mt-2 space-y-1 text-muted-foreground">
          <li>Use or inability to use the platform</li>
          <li>Transaction disputes, delivery delays, or item condition mismatches</li>
          <li>Third-party payment processing or logistics failures</li>
          <li>Unauthorized account access or user-generated fraud</li>
        </ul>
        Our liability is limited to the transaction fees collected on the specific order in question, provided we have acted in good faith and followed published safety protocols.</p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">6. Force Majeure</h2>
        <p>Zamorax shall not be held liable for delays or failures in performance resulting from circumstances beyond reasonable control, including but not limited to: natural disasters, telecommunications failures, government restrictions, banking system outages, strikes, or pandemics.</p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">7. Right to Modify</h2>
        <p>Zamorax reserves the right to update, suspend, or discontinue any feature, fee structure, or policy at any time without prior notice, provided such changes comply with applicable consumer protection regulations. Material changes will be communicated via email or in-app notification.</p>
      </section>

      <div className="pt-6 border-t">
        <p className="text-muted-foreground">This disclaimer is incorporated into and governed by our <a href="/terms" className="text-primary underline">Terms of Service</a>.</p>
        <p className="text-muted-foreground mt-2">Questions? Contact <strong>legal@zamorax.ng</strong></p>
      </div>
    </div>
  )
}
