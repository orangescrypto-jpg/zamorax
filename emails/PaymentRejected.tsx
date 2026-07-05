// emails/PaymentRejected.tsx
// Sent to BOTH buyer and seller when admin rejects a manual bank transfer
// proof on an order. role: "buyer" | "seller" — controls which message and
// CTA is shown. Mirrors the buyer/seller split used in DisputeOpened.tsx.

import { Section, Text, Hr, Link, Row, Column } from "@react-email/components"
import { EmailBase, styles } from "./layouts/EmailBase"

interface PaymentRejectedEmailProps {
  recipientName: string
  role:          "buyer" | "seller"
  itemTitle:     string
  orderId:       string
  amount:        string
  reason:        string
  retryUrl:      string   // buyer: retry-payment link. seller: order link.
  supportEmail:  string
}

export default function PaymentRejectedEmail({
  recipientName = "there",
  role          = "buyer",
  itemTitle     = "iPhone 14 Pro Max",
  orderId       = "ORD-ABC123",
  amount        = "₦12,000",
  reason        = "The transfer amount doesn't match the order total",
  retryUrl      = "https://zamorax.com/dashboard/buyer/orders/abc123",
  supportEmail  = "support@zamorax.com",
}: PaymentRejectedEmailProps) {
  const isBuyer = role === "buyer"

  return (
    <EmailBase preview={`Payment could not be confirmed for order ${orderId} — action needed`}>
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
            ❌ Payment Not Confirmed
          </Text>
        </Section>

        <Text style={styles.h1}>
          {isBuyer ? "We couldn't confirm your payment" : "A buyer's payment could not be confirmed"}
        </Text>
        <Text style={styles.subtitle}>
          {isBuyer
            ? `Hi ${recipientName}, our team reviewed the payment proof you submitted for the order below and could not confirm it. See the reason below — you can fix this and resubmit on the same order without starting over.`
            : `Hi ${recipientName}, the buyer's payment proof for one of your orders could not be confirmed by our team. This order will not proceed until the buyer resubmits a valid payment. No action is needed from you right now.`
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
            <Column><Text style={{ ...styles.cardLabel, margin: 0 }}>Amount</Text></Column>
            <Column><Text style={{ ...styles.cardValue, margin: 0 }}>{amount}</Text></Column>
          </Row>
          <Row style={{ margin: "6px 0" }}>
            <Column><Text style={{ ...styles.cardLabel, margin: 0 }}>Reason</Text></Column>
            <Column>
              <Text style={{ ...styles.cardValue, color: "#B91C1C", margin: 0 }}>{reason}</Text>
            </Column>
          </Row>
        </Section>

        {/* What happens next */}
        {isBuyer && (
          <Section style={{
            ...styles.card,
            backgroundColor: "#FFFBEB",
            border: "1px solid #FDE68A",
          }}>
            <Text style={{ color: "#92400E", fontSize: "13px", fontWeight: "700", margin: "0 0 8px" }}>
              What to do next
            </Text>
            <Text style={{ color: "#92400E", fontSize: "12px", margin: 0, lineHeight: "1.8" }}>
              1. Open your order and tap "Retry Payment"{"\n"}
              2. Double-check the amount and reference, then upload a fresh screenshot{"\n"}
              3. Our team will review it again — no need to place a new order
            </Text>
          </Section>
        )}

        {/* CTA */}
        <Section style={{ textAlign: "center", margin: "28px 0 8px" }}>
          <Link href={retryUrl} style={styles.ctaButtonNavy}>
            {isBuyer ? "Retry Payment →" : "View Order →"}
          </Link>
        </Section>

        <Hr style={styles.divider} />

        <Text style={{ color: "#9CA3AF", fontSize: "12px", textAlign: "center", margin: 0 }}>
          Questions? Email{" "}
          <Link href={`mailto:${supportEmail}`} style={{ color: "#D4A017" }}>
            {supportEmail}
          </Link>
          {" "}and reference your Order ID.
        </Text>
      </Section>
    </EmailBase>
  )
}
