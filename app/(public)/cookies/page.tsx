import type { Metadata } from "next"
export const metadata: Metadata = { title: "Cookie Policy — Zamorax", description: "How Zamorax uses cookies and tracking technologies." }

export default function CookiePolicyPage() {
  return (
    <div className="container max-w-3xl py-12">
      <h1 className="text-3xl font-bold mb-2">Cookie Policy</h1>
      <p className="text-sm text-muted-foreground mb-8">Last updated: January 2025</p>
      <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
        <section>
          <h2 className="text-lg font-semibold mb-2">What Are Cookies?</h2>
          <p className="text-sm text-muted-foreground">Cookies are small text files stored on your device when you visit a website. They help us remember your preferences, keep you signed in, and improve your experience on Zamorax.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold mb-2">Cookies We Use</h2>
          <div className="space-y-3">
            {[
              { name: "Essential Cookies", desc: "Required for authentication, session management, and security. Cannot be disabled.", required: true },
              { name: "Preference Cookies", desc: "Remember your settings such as dark/light theme, language, and Nigerian state filter.", required: false },
              { name: "Analytics Cookies", desc: "Help us understand how users navigate Zamorax so we can improve the platform. No personal data is sold.", required: false },
              { name: "Firebase Authentication", desc: "Used by Google Firebase to manage secure login sessions across Zamorax.", required: true },
            ].map(c => (
              <div key={c.name} className="border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold">{c.name}</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${c.required ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {c.required ? "Required" : "Optional"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{c.desc}</p>
              </div>
            ))}
          </div>
        </section>
        <section>
          <h2 className="text-lg font-semibold mb-2">Third-Party Services</h2>
          <p className="text-sm text-muted-foreground">Zamorax uses Google Firebase (authentication & database), Paystack (payment processing), and Cloudinary (image hosting). Each service has its own cookie policy.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold mb-2">Your Choices</h2>
          <p className="text-sm text-muted-foreground">You can clear cookies through your browser settings at any time. Note that disabling essential cookies will sign you out and may limit platform functionality. Zamorax respects Nigeria's NDPR data privacy regulations.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold mb-2">Contact</h2>
          <p className="text-sm text-muted-foreground">For cookie-related questions, contact us at <a href="mailto:privacy@zamorax.ng" className="text-primary underline">privacy@zamorax.ng</a></p>
        </section>
      </div>
    </div>
  )
}
