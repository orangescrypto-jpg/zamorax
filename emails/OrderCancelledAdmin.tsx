// emails/OrderCancelledAdmin.tsx
// Sent to BOTH buyer and seller when an ADMIN cancels an order outright
// (distinct from a buyer's own self-serve cancellation, which already has
// its own flow/copy elsewhere). role: "buyer" | "seller" controls wording.

import { Section, Text, Hr, Link, Row, Column } from "@react-email/components"
import { EmailBase, styles } from "./layouts/EmailBase"

interface OrderCancelledAdminEmailProps {
  recipientName: string
  role:          "buyer" | "seller"
  itemTitle:     string
  orderId:       string
  amount:        string
  reason:        string
  ordersUrl:     string
  supportEmail:  string
}

export default function OrderCancelledAdminEmail({
  recipientName = "there",
  role          = "buyer",
  itemTitle     = "iPhone 14 Pro Max",
  orderId       = "ORD-ABC123",
  amount        = "₦12,000",
  reason        = "Unable to verify payment after multiple attempts",
  ordersUrl     = "https://zamorax.com/dashboard/buyer/orders",
  supportEmail  = "support@zamorax.com",
}: OrderCancelledAdminEmailProps) {
  const isBuyer = role === "buyer"

  return (
    <EmailBase preview={`Order ${orderId} has been cancelled by Zamorax`}>
      <Section style={styles.body_content}>
        {/* Grey/neutral alert strip — cancellation isn't an error state like
            rejection, just a closed order, so this intentionally avoids the
            red used for PaymentRejected/DisputeOpened. */}
        <Section style={{
          backgroundColor: "#F3F4F6",
          border: "1px solid #E5E7EB",
          borderRadius: "8px",
          padding: "12px 16px",
          marginBottom: "20px",
        }}>
          <Text style={{ color: "#374151", fontSize: "14px", fontWeight: "700", margin: 0 }}>
            🚫 Order Cancelled
          </Text>
        </Section>

        <Text style={styles.h1}>
          {isBuyer ? "Your order has been cancelled" : "An order has been cancelled"}
        </Text>
        <Text style={styles.subtitle}>
          {isBuyer
            ? `Hi ${recipientName}, our team has cancelled the order below. See the reason from admin below. If you already paid and this wasn't refunded automatically, contact support with your Order ID.`
            : `Hi ${recipientName}, our team has cancelled one of your orders. See the reason below. No further action is needed on your end for this order.`
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
              <Text style={{ ...styles.cardValue, color: "#374151", margin: 0 }}>{reason}</Text>
            </Column>
          </Row>
        </Section>

        {/* CTA */}
        <Section style={{ textAlign: "center", margin: "28px 0 8px" }}>
          <Link href={ordersUrl} style={styles.ctaButtonNavy}>
            View My Orders →
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
