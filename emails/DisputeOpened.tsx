// emails/DisputeOpened.tsx
// Sent to BOTH buyer and seller when a dispute is raised on an order.
// role: "buyer" | "seller" — controls which message is shown.

import { Section, Text, Hr, Link, Row, Column } from "@react-email/components"
import { EmailBase, styles } from "./layouts/EmailBase"

interface DisputeOpenedEmailProps {
  recipientName: string
  role:          "buyer" | "seller"
  itemTitle:     string
  orderId:       string
  reason:        string
  orderUrl:      string
  supportEmail:  string
}

export default function DisputeOpenedEmail({
  recipientName = "there",
  role          = "buyer",
  itemTitle     = "iPhone 14 Pro Max",
  orderId       = "ORD-ABC123",
  reason        = "Item not as described",
  orderUrl      = "https://zamorax.com/dashboard/buyer/orders/abc123",
  supportEmail  = "support@zamorax.com",
}: DisputeOpenedEmailProps) {
  const isBuyer = role === "buyer"

  return (
    <EmailBase preview={`⚠️ A dispute has been opened on order ${orderId} — Zamorax is reviewing.`}>
      <Section style={styles.body_content}>
        {/* Red alert strip */}
        <Section style={{
          backgroundColor: "#FEF2F2",
          border: "1px solid #FECACA",
          borderRadius: "8px",
          padding: "12px 16px",
          marginBottom: "20px",
        }}>
          <Text style={{ color: "#991B1B", fontSize: "14px", fontWeight: "700", margin: 0 }}>
            ⚠️ Dispute Opened
          </Text>
        </Section>

        <Text style={styles.h1}>
          {isBuyer ? "Your dispute has been received" : "A dispute has been raised on your order"}
        </Text>
        <Text style={styles.subtitle}>
          {isBuyer
            ? `Hi ${recipientName}, we've received your dispute for the order below. Our team will review and respond within 48 hours. Your funds remain safely in escrow.`
            : `Hi ${recipientName}, the buyer has raised a dispute on one of your orders. Please review the details below. Funds will remain in escrow until the dispute is resolved.`
          }
        </Text>

        {/* Order card */}
        <Section style={styles.card}>
          <Row style={{ margin: "6px 0" }}>
            <Column><Text style={{ ...styles.cardLabel, margin: 0 }}>Order ID</Text></Column>
            <Column>
              <Text style={{ ...styles.cardValue, fontFamily: "monospace", margin: 0 }}>{orderId}</Text>
            </Column>
          </Row>
          <Row style={{ margin: "6px 0" }}>
            <Column><Text style={{ ...styles.cardLabel, margin: 0 }}>Item</Text></Column>
            <Column><Text style={{ ...styles.cardValue, margin: 0 }}>{itemTitle}</Text></Column>
          </Row>
          <Row style={{ margin: "6px 0" }}>
            <Column><Text style={{ ...styles.cardLabel, margin: 0 }}>Dispute Reason</Text></Column>
            <Column>
              <Text style={{ ...styles.cardValue, color: "#B91C1C", margin: 0 }}>{reason}</Text>
            </Column>
          </Row>
          <Row style={{ margin: "6px 0" }}>
            <Column><Text style={{ ...styles.cardLabel, margin: 0 }}>Escrow Status</Text></Column>
            <Column>
              <Text style={{ ...styles.badge("#92400E", "#FEF3C7"), margin: 0 }}>
                🔒 Held — Pending Resolution
              </Text>
            </Column>
          </Row>
        </Section>

        {/* What happens next */}
        <Section style={{
          ...styles.card,
          backgroundColor: "#FFFBEB",
          border: "1px solid #FDE68A",
        }}>
          <Text style={{ color: "#92400E", fontSize: "13px", fontWeight: "700", margin: "0 0 8px" }}>
            What happens next
          </Text>
          {isBuyer ? (
            <Text style={{ color: "#92400E", fontSize: "12px", margin: 0, lineHeight: "1.8" }}>
              1. Our dispute team will review the evidence within <strong>48 hours</strong>{"\n"}
              2. We may contact you for photos, receipts, or more info{"\n"}
              3. A resolution will be communicated to both parties{"\n"}
              4. If resolved in your favour, funds will be returned immediately
            </Text>
          ) : (
            <Text style={{ color: "#92400E", fontSize: "12px", margin: 0, lineHeight: "1.8" }}>
              1. Please gather evidence — photos, delivery proof, chats{"\n"}
              2. Our team will reach out within <strong>48 hours</strong>{"\n"}
              3. Present your case clearly through the order page{"\n"}
              4. Funds remain in escrow — protected for both parties
            </Text>
          )}
        </Section>

        {/* CTA */}
        <Section style={{ textAlign: "center", margin: "28px 0 8px" }}>
          <Link href={orderUrl} style={styles.ctaButtonNavy}>
            View Order & Dispute →
          </Link>
        </Section>

        <Hr style={styles.divider} />

        <Text style={{ color: "#9CA3AF", fontSize: "12px", textAlign: "center", margin: 0 }}>
          Need urgent help? Email{" "}
          <Link href={`mailto:${supportEmail}`} style={{ color: "#D4A017" }}>
            {supportEmail}
          </Link>
          {" "}and reference your Order ID.
        </Text>
      </Section>
    </EmailBase>
  )
}
