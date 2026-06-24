// emails/Welcome.tsx
// Sent to new users on registration — buyer or seller.
// role: "buyer" | "seller" — shows tailored next steps for each.

import { Section, Text, Hr, Link, Row, Column } from "@react-email/components"
import { EmailBase, styles } from "./layouts/EmailBase"

interface WelcomeEmailProps {
  name:         string
  role:         "buyer" | "seller"
  dashboardUrl: string
  supportEmail: string
}

export default function WelcomeEmail({
  name         = "there",
  role         = "buyer",
  dashboardUrl = "https://zamorax.com/dashboard",
  supportEmail = "support@zamorax.com",
}: WelcomeEmailProps) {
  const isSeller = role === "seller"

  const steps = isSeller
    ? [
        { icon: "✅", title: "Verify your identity", desc: "Submit your NIN to unlock instant payouts and higher trust badges." },
        { icon: "📦", title: "Create your first listing", desc: "List any item for sale or rent — it's free to list, we only charge on a successful sale." },
        { icon: "💰", title: "Get paid via escrow", desc: "When a buyer pays, funds are held in escrow and released to your wallet once they confirm receipt." },
      ]
    : [
        { icon: "🔍", title: "Browse listings", desc: "Find items for sale or rent from verified sellers across Nigeria." },
        { icon: "🛡️", title: "Buy with escrow protection", desc: "Your payment is never released to the seller until you confirm your item arrived safely." },
        { icon: "💬", title: "Chat before you buy", desc: "Message sellers directly to negotiate, ask questions, or arrange meetups." },
      ]

  return (
    <EmailBase preview={`Welcome to Zamorax, ${name}! Nigeria's most trusted escrow marketplace.`}>
      <Section style={styles.body_content}>
        {/* Hero */}
        <Section style={{
          backgroundColor: "#0A1628",
          borderRadius: "10px",
          padding: "28px 24px",
          textAlign: "center",
          marginBottom: "24px",
        }}>
          <Text style={{ color: "#D4A017", fontSize: "28px", margin: "0 0 6px" }}>🎉</Text>
          <Text style={{ color: "#ffffff", fontSize: "20px", fontWeight: "800", margin: "0 0 6px" }}>
            Welcome to Zamorax, {name}!
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: "13px", margin: 0, lineHeight: "1.5" }}>
            {isSeller
              ? "You're now set up as a seller. Start listing and earn with escrow protection."
              : "You're all set. Buy anything, safely, with full escrow protection."}
          </Text>
        </Section>

        <Text style={{ ...styles.h1, fontSize: "16px" }}>
          {isSeller ? "Here's how to get started as a seller:" : "Here's how Zamorax protects you:"}
        </Text>

        {/* Steps */}
        <Section style={{ margin: "16px 0" }}>
          {steps.map((step, i) => (
            <Section key={i} style={{
              ...styles.card,
              margin: "10px 0",
              display: "flex",
            }}>
              <Row>
                <Column style={{ width: "36px", verticalAlign: "top" }}>
                  <Text style={{ fontSize: "20px", margin: 0 }}>{step.icon}</Text>
                </Column>
                <Column style={{ paddingLeft: "12px" }}>
                  <Text style={{ color: "#0A1628", fontSize: "13px", fontWeight: "700", margin: "0 0 3px" }}>
                    {step.title}
                  </Text>
                  <Text style={{ color: "#6B7280", fontSize: "12px", margin: 0, lineHeight: "1.5" }}>
                    {step.desc}
                  </Text>
                </Column>
              </Row>
            </Section>
          ))}
        </Section>

        {/* Trust badge */}
        <Section style={{
          ...styles.card,
          backgroundColor: "#F0FDF4",
          border: "1px solid #BBF7D0",
          textAlign: "center",
        }}>
          <Text style={{ color: "#065F46", fontSize: "13px", fontWeight: "700", margin: "0 0 4px" }}>
            🔒 Every transaction is escrow-protected
          </Text>
          <Text style={{ color: "#065F46", fontSize: "12px", margin: 0 }}>
            Money only moves when both parties are satisfied.
          </Text>
        </Section>

        {/* CTA */}
        <Section style={{ textAlign: "center", margin: "28px 0 8px" }}>
          <Link href={dashboardUrl} style={styles.ctaButton}>
            {isSeller ? "Go to My Dashboard →" : "Start Browsing →"}
          </Link>
        </Section>

        <Hr style={styles.divider} />

        <Text style={{ color: "#9CA3AF", fontSize: "12px", textAlign: "center", margin: 0 }}>
          Need help getting started? We're at{" "}
          <Link href={`mailto:${supportEmail}`} style={{ color: "#D4A017" }}>
            {supportEmail}
          </Link>
        </Text>
      </Section>
    </EmailBase>
  )
}
