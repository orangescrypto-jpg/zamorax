import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "About Us — Zamorax",
  description: "Zamorax is rebuilding trust in Nigerian commerce. Verified sellers, secure escrow, and transparent pricing.",
}

export default function AboutPage() {
  return (
    <div className="container py-12 max-w-4xl space-y-8">
      <h1 className="text-3xl md:text-4xl font-heading font-bold">About Zamorax</h1>
      
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Our Mission</h2>
        <p className="text-lg text-muted-foreground">To make buying, selling, and renting across Nigeria safe, transparent, and accessible to everyone. We believe trust shouldn't be a luxury—it should be built into every transaction.</p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">The Problem We Solve</h2>
        <p>Nigerian e-commerce has grown rapidly, but friction remains: fake listings, payment scams, unverified sellers, unclear return policies, and zero accountability. Buyers hesitate. Sellers struggle to stand out. Renters risk deposit theft. Traditional marketplaces prioritize volume over verification.</p>
        <p>Zamorax flips the script. We don't just connect people—we protect them.</p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Our Solution</h2>
        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
          <li><strong>Verified Identities:</strong> NIN + BVN validation ensures you're dealing with real people, not anonymous profiles.</li>
          <li><strong>Secure Escrow:</strong> Funds are held safely until you confirm the item matches the listing. No upfront risk.</li>
          <li><strong>Category-Specific Safety:</strong> IMEI checks for phones, boot videos for laptops, expiry validation for groceries, hygiene seals for fashion rentals.</li>
          <li><strong>Transparent Fees:</strong> No hidden charges. 3.5% sales, 8% rentals, 0.5% insurance. Everything shown before checkout.</li>
          <li><strong>Community Trust Pool:</strong> 0.5% of every transaction funds an insurance pool that covers verified losses. You can see it in real-time.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Built for Nigeria, Ready for Africa</h2>
        <p>We started in Lagos because we know the market intimately, but our architecture is designed for pan-African expansion. Multi-currency readiness, localized logistics integrations, and mobile-first design ensure Zamorax scales without losing its core promise: trust first.</p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Our Values</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="p-4 border rounded-lg bg-muted/20"><h3 className="font-medium mb-2">🤝 Trust</h3><p className="text-sm text-muted-foreground">Verification, escrow, and transparency aren't features. They're our foundation.</p></div>
          <div className="p-4 border rounded-lg bg-muted/20"><h3 className="font-medium mb-2">⚖️ Fairness</h3><p className="text-sm text-muted-foreground">Clear rules, unbiased dispute resolution, and equal opportunity for small sellers.</p></div>
          <div className="p-4 border rounded-lg bg-muted/20"><h3 className="font-medium mb-2">🚀 Simplicity</h3><p className="text-sm text-muted-foreground">Complex problems, simple interfaces. Post, pay, protect. No jargon. No friction.</p></div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Meet the Team</h2>
        <p className="text-muted-foreground">We're a team of builders, engineers, logistics experts, and former marketplace operators who've seen how broken trust stalls economic growth. We're not just building an app—we're rebuilding commerce, one verified transaction at a time.</p>
        <p className="text-muted-foreground italic">Team profiles & photos coming soon.</p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Press & Partnerships</h2>
        <p>For media inquiries, brand collaborations, or logistics partnerships, reach out to our team.</p>
        <p><strong>Email:</strong> press@zamorax.ng</p>
        <p><strong>WhatsApp:</strong> [+234 XXX XXX XXXX]</p>
      </section>

      <div className="pt-6 border-t text-center">
        <p className="text-muted-foreground">Join thousands of verified Nigerians trading safely every day.</p>
        <a href="/register" className="inline-block mt-4 px-6 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition">Start Trading on Zamorax</a>
      </div>
    </div>
  )
}
