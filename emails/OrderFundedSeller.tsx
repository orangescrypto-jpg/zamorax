// emails/OrderFundedSeller.tsx
// Sent to SELLER the moment admin confirms buyer payment (escrow funded).
// Includes the buyer's phone number so the seller can call/WhatsApp
// immediately — in Nigeria, deals move by phone, not by checking email.

import { Section, Text, Hr, Link, Row, Column } from "@react-email/components"
import { EmailBase, styles } from "./layouts/EmailBase"

interface OrderFundedSellerEmailProps {
  sellerName:   string
  itemTitle:    string
  orderId:      string
  totalAmount:  string   // formatted e.g. "₦150,000"
  buyerName:    string
  buyerPhone:   string   // may be empty — omit contact card if so
  orderUrl:     string
  supportEmail: string
}

export default function OrderFundedSellerEmail({
  sellerName   = "there",
  itemTitle    = "iPhone 14 Pro Max",
  orderId      = "ORD-ABC123",
  totalAmount  = "₦150,000",
  buyerName    = "A buyer",
  buyerPhone   = "",
  orderUrl     = "https://zamorax.com/dashboard/seller/orders/abc123",
  supportEmail = "support@zamorax.com",
}: OrderFundedSellerEmailProps) {
  return (
    <EmailBase preview={`Payment confirmed for "${itemTitle}" — time to ship. ${buyerPhone ? `Buyer: ${buyerPhone}` : ""}`}>
      <Section style={styles.body_content}>
        <Text style={styles.h1}>💰 Payment confirmed — ship it!</Text>
        <Text style={styles.subtitle}>
          Hi {sellerName}, {buyerName} has paid for "{itemTitle}" and the funds are now held
          safely in Zamorax escrow. Please prepare and ship the item as soon as possible.
        </Text>

        {/* Order card */}
        <Section style={styles.card}>
          <Row>
            <Column>
              <Text style={{ ...styles.cardLabel, margin: "0 0 2px" }}>Order ID</Text>
              <Text style={{ ...styles.cardValue, fontFamily: "monospace", margin: 0 }}>{orderId}</Text>
            </Column>
          </Row>
          <Hr style={{ ...styles.divider, margin: "12px 0" }} />
          <Row style={{ margin: "6px 0" }}>
            <Column><Text style={{ ...styles.cardLabel, margin: 0 }}>Item</Text></Column>
            <Column><Text style={{ ...styles.cardValue, margin: 0 }}>{itemTitle}</Text></Column>
          </Row>
          <Row style={{ margin: "6px 0" }}>
            <Column><Text style={{ ...styles.cardLabel, margin: 0 }}>Amount in Escrow</Text></Column>
            <Column>
              <Text style={{ ...styles.cardValue, color: "#059669", margin: 0 }}>{totalAmount}</Text>
            </Column>
          </Row>
          <Row style={{ margin: "6px 0" }}>
            <Column><Text style={{ ...styles.cardLabel, margin: 0 }}>Status</Text></Column>
            <Column>
              <Text style={{ ...styles.badge("#065F46", "#D1FAE5"), margin: 0 }}>
                🔒 Funded — Ready to Ship
              </Text>
            </Column>
          </Row>
        </Section>

        {/* Buyer contact — the whole point of this email in Nigeria */}
        {buyerPhone && (
          <Section style={{
            ...styles.card,
            backgroundColor: "#FFFBEB",
            border: "1px solid #FDE68A",
          }}>
            <Text style={{ color: "#92400E", fontSize: "13px", fontWeight: "700", margin: "0 0 6px" }}>
              📞 Reach the buyer directly
            </Text>
            <Text style={{ color: "#92400E", fontSize: "13px", margin: 0, lineHeight: "1.6" }}>
              {buyerName} — {buyerPhone}
            </Text>
            <Text style={{ color: "#92400E", fontSize: "12px", margin: "6px 0 0", lineHeight: "1.6" }}>
              Call or WhatsApp to confirm delivery details. Keep all payment discussion on
              Zamorax escrow — never accept payment outside the platform.
            </Text>
          </Section>
        )}

        {/* CTA */}
        <Section style={{ textAlign: "center", margin: "28px 0 8px" }}>
          <Link href={orderUrl} style={styles.ctaButton}>
            View Order & Ship →
          </Link>
        </Section>

        <Hr style={styles.divider} />

        <Text style={{ color: "#9CA3AF", fontSize: "12px", textAlign: "center", margin: 0 }}>
          Questions? Reply to this email or contact{" "}
          <Link href={`mailto:${supportEmail}`} style={{ color: "#D4A017" }}>
            {supportEmail}
          </Link>
        </Text>
      </Section>
    </EmailBase>
  )
}
