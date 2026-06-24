// emails/OrderConfirmed.tsx
// Sent to BUYER when order is placed and payment is received.
// Shows order details, escrow protection notice, and link to track order.

import { Section, Text, Hr, Link, Row, Column } from "@react-email/components"
import { EmailBase, styles } from "./layouts/EmailBase"

interface OrderConfirmedEmailProps {
  buyerName:    string
  itemTitle:    string
  orderId:      string
  totalAmount:  string   // formatted e.g. "₦150,000"
  sellerName:   string
  orderUrl:     string
  supportEmail: string
}

export default function OrderConfirmedEmail({
  buyerName    = "there",
  itemTitle    = "iPhone 14 Pro Max",
  orderId      = "ORD-ABC123",
  totalAmount  = "₦150,000",
  sellerName   = "TechStore NG",
  orderUrl     = "https://zamorax.com/dashboard/buyer/orders/abc123",
  supportEmail = "support@zamorax.com",
}: OrderConfirmedEmailProps) {
  return (
    <EmailBase preview={`Your order for "${itemTitle}" is confirmed and protected by Zamorax escrow.`}>
      <Section style={styles.body_content}>
        {/* Greeting */}
        <Text style={styles.h1}>Your order is confirmed ✅</Text>
        <Text style={styles.subtitle}>
          Hi {buyerName}, your payment has been received and is now held safely in escrow.
          The seller will be notified to prepare your item.
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
            <Column><Text style={{ ...styles.cardLabel, margin: 0 }}>Seller</Text></Column>
            <Column><Text style={{ ...styles.cardValue, margin: 0 }}>{sellerName}</Text></Column>
          </Row>
          <Row style={{ margin: "6px 0" }}>
            <Column><Text style={{ ...styles.cardLabel, margin: 0 }}>Amount Paid</Text></Column>
            <Column>
              <Text style={{ ...styles.cardValue, color: "#059669", margin: 0 }}>{totalAmount}</Text>
            </Column>
          </Row>
          <Row style={{ margin: "6px 0" }}>
            <Column><Text style={{ ...styles.cardLabel, margin: 0 }}>Status</Text></Column>
            <Column>
              <Text style={{ ...styles.badge("#065F46", "#D1FAE5"), margin: 0 }}>
                🔒 In Escrow
              </Text>
            </Column>
          </Row>
        </Section>

        {/* Escrow notice */}
        <Section style={{
          ...styles.card,
          backgroundColor: "#EFF6FF",
          border: "1px solid #BFDBFE",
        }}>
          <Text style={{ color: "#1E40AF", fontSize: "13px", fontWeight: "700", margin: "0 0 6px" }}>
            🛡️ Your money is protected
          </Text>
          <Text style={{ color: "#1E40AF", fontSize: "12px", margin: 0, lineHeight: "1.6" }}>
            Your payment is held in Zamorax escrow — not released to the seller until you confirm
            you've received your item in good condition. If anything goes wrong, our dispute team
            is here to help.
          </Text>
        </Section>

        {/* CTA */}
        <Section style={{ textAlign: "center", margin: "28px 0 8px" }}>
          <Link href={orderUrl} style={styles.ctaButton}>
            Track My Order →
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
