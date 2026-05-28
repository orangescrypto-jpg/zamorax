import type { Metadata } from "next"
import { where } from "@/src/services"

export const metadata: Metadata = {
  title: "How It Works — Zamorax",
  description: "Step-by-step guide to buying, selling, and renting on Zamorax. Understand fees, boosts, subscriptions, and escrow.",
}

export default function HowItWorksPage() {
  return (
    <div className="container py-12 max-w-4xl space-y-8">
      <h1 className="text-3xl md:text-4xl font-heading font-bold">How Zamorax Works</h1>
      <p className="text-lg text-muted-foreground">A secure, transparent marketplace built for Nigeria. No hidden fees. No upfront risk. Just trust.</p>

      <section className="space-y-6">
        <h2 className="text-xl font-semibold">🛒 For Buyers</h2>
        <ol className="space-y-4">
          <li className="p-4 border rounded-lg bg-muted/20"><strong>1. Browse or Search:</strong> Filter by category, state, price, or condition. Use “Verified Sellers Only” for extra peace of mind.</li>
          <li className="p-4 border rounded-lg bg-muted/20"><strong>2. Pay via Escrow:</strong> Checkout securely with Paystack/Flutterwave. Your money is held safely until you confirm delivery.</li>
          <li className="p-4 border rounded-lg bg-muted/20"><strong>3. Inspect on Delivery:</strong> You have 24 hours to verify the item matches the listing. Test phones, boot laptops, check seals.</li>
          <li className="p-4 border rounded-lg bg-muted/20"><strong>4. Confirm or Dispute:</strong> Satisfied? Click “Release Funds”. Issue? Open a dispute with photos/videos. Admin resolves fairly.</li>
        </ol>
      </section>

      <section className="space-y-6">
        <h2 className="text-xl font-semibold">📦 For Sellers</h2>
        <ol className="space-y-4">
          <li className="p-4 border rounded-lg bg-muted/20"><strong>1. Verify & Choose Plan:</strong> Complete NIN/BVN check. Start free (5 listings) or upgrade to Starter/Pro for more slots & boosts.</li>
          <li className="p-4 border rounded-lg bg-muted/20"><strong>2. Post with Details:</strong> Upload real photos, mandatory videos (for used items), and accurate specs. Set sale/rent price & location.</li>
          <li className="p-4 border rounded-lg bg-muted/20"><strong>3. Get Paid Securely:</strong> Buyer pays into escrow. Ship or hand over. Once confirmed, funds release to your bank (minus 3.5%/8% + ₦100 withdrawal).</li>
          <li className="p-4 border rounded-lg bg-muted/20"><strong>4. Boost Visibility:</strong> Optional ₦500–₦3,000 boosts push your listing higher. Free monthly boosts included on Starter/Pro.</li>
        </ol>
      </section>

      <section className="space-y-6">
        <h2 className="text-xl font-semibold">🔄 For Renters</h2>
        <p>Rentals work like sales but include a security deposit and return timeline:</p>
        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
          <li>Pay rental fee + deposit upfront (held in escrow).</li>
          <li>Use item for agreed duration (days/weeks).</li>
          <li>Return in original condition. Dry-cleaning/cleaning fees apply where noted.</li>
          <li>Deposit released after inspection. Deductions apply for damage or late return.</li>
          <li>Note: Rentals blocked for Health/Beauty, Baby Food, Groceries, Sporting Goods for hygiene & safety reasons.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">💰 Fee Transparency</h2>
        <p>We believe in zero surprises. Every fee is shown before checkout:</p>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div className="p-4 border rounded-lg"><strong>Sales:</strong> 3.5% platform fee</div>
          <div className="p-4 border rounded-lg"><strong>Rentals:</strong> 8% platform fee</div>
          <div className="p-4 border rounded-lg"><strong>Insurance:</strong> 0.5% (auto-deducted)</div>
          <div className="p-4 border rounded-lg"><strong>Withdrawals:</strong> ₦100 flat</div>
          <div className="p-4 border rounded-lg"><strong>Boosts:</strong> ₦500–₦3,000/7 days</div>
          <div className="p-4 border rounded-lg"><strong>Hub Verify:</strong> ₦1,000/listing</div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">❓ Frequently Asked Questions</h2>
        {[ 
          { q: "What if the seller doesn't ship?", a: "Escrow holds funds. If not shipped within 48hrs, you get a full auto-refund." },
          { q: "Can I negotiate price?", a: "Use in-app chat. Never pay outside Zamorax. All agreed prices must be updated via official order modification." },
          { q: "How do boosts work?", a: "Boosted listings appear higher in category grids & search. Standard = top 10, Premium = top 3, Category Top = #1 spot for 7 days." },
          { q: "What happens if I break a rented item?", a: "Deducted from your deposit. If deposit covers less, a separate invoice is issued via escrow dispute resolution." }
        ].map((item, i) => (
          <details key={i} className="border rounded-lg p-4 bg-background group cursor-pointer">
            <summary className="font-medium list-none flex justify-between items-center">
              {item.q}
              <span className="text-primary text-lg group-open:rotate-180 transition-transform">+</span>
            </summary>
            <p className="mt-2 text-sm text-muted-foreground">{item.a}</p>
          </details>
        ))}
      </section>

      <div className="text-center pt-6">
        <p className="text-muted-foreground">Ready to start? <a href="/register" className="text-primary font-medium underline">Create your free account</a> today.</p>
      </div>
    </div>
  )
}
