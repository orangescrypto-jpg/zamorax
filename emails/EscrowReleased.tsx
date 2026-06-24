// emails/EscrowReleased.tsx
// Sent to SELLER when buyer confirms receipt and escrow is released to wallet.
// Shows net payout breakdown clearly — commission, arbitration pool, net amount.

import { Section, Text, Hr, Link, Row, Column } from "@react-email/components"
import { EmailBase, styles } from "./layouts/EmailBase"

interface EscrowReleasedEmailProps {
  sellerName:      string
  itemTitle:       string
  orderId:         string
  grossAmount:     string   // e.g. "₦150,000"
  commissionAmt:   string   // e.g. "₦6,000"
  commissionPct:   string   // e.g. "4"
  arbitrationAmt:  string   // e.g. "₦750"
  arbitrationPct:  string   // e.g. "0.5"
  withdrawalFee:   string   // e.g. "₦150" or "₦0"
  netPayout:       string   // e.g. "₦143,100"
  walletUrl:       string
  supportEmail:    string
}

export default function EscrowReleasedEmail({
  sellerName     = "Seller",
  itemTitle      = "iPhone 14 Pro Max",
  orderId        = "ORD-ABC123",
  grossAmount    = "₦150,000",
  commissionAmt  = "₦6,000",
  commissionPct  = "4",
  arbitrationAmt = "₦750",
  arbitrationPct = "0.5",
  withdrawalFee  = "₦150",
  netPayout      = "₦143,100",
  walletUrl      = "https://zamorax.com/dashboard/seller/wallet",
  supportEmail   = "support@zamorax.com",
}: EscrowReleasedEmailProps) {
  return (
    <EmailBase preview={`💰 ${netPayout} has been credited to your Zamorax wallet!`}>
      <Section style={styles.body_content}>
        <Text style={styles.h1}>Funds released to your wallet 💰</Text>
        <Text style={styles.subtitle}>
          Hi {sellerName}, the buyer has confirmed receipt of "{itemTitle}".
          Your payout has been credited to your Zamorax wallet.
        </Text>

        {/* Payout breakdown */}
        <Section style={styles.card}>
          <Text style={{
            color: "#374151",
            fontSize: "12px",
            fontWeight: "700",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            margin: "0 0 12px",
          }}>
            Payout Breakdown
          </Text>

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

          <Hr style={{ ...styles.divider, margin: "12px 0" }} />

          <Row style={{ margin: "6px 0" }}>
            <Column><Text style={{ ...styles.cardLabel, margin: 0 }}>Buyer paid</Text></Column>
            <Column><Text style={{ ...styles.cardValue, margin: 0 }}>{grossAmount}</Text></Column>
          </Row>
          <Row style={{ margin: "6px 0" }}>
            <Column>
              <Text style={{ ...styles.cardLabel, color: "#EF4444", margin: 0 }}>
                Platform fee ({commissionPct}%)
              </Text>
            </Column>
            <Column>
              <Text style={{ ...styles.cardValue, color: "#EF4444", margin: 0 }}>
                -{commissionAmt}
              </Text>
            </Column>
          </Row>
          <Row style={{ margin: "6px 0" }}>
            <Column>
              <Text style={{ ...styles.cardLabel, color: "#EF4444", margin: 0 }}>
                Arbitration pool ({arbitrationPct}%)
              </Text>
            </Column>
            <Column>
              <Text style={{ ...styles.cardValue, color: "#EF4444", margin: 0 }}>
                -{arbitrationAmt}
              </Text>
            </Column>
          </Row>
          {withdrawalFee !== "₦0" && (
            <Row style={{ margin: "6px 0" }}>
              <Column>
                <Text style={{ ...styles.cardLabel, color: "#EF4444", margin: 0 }}>
                  Withdrawal fee (on payout)
                </Text>
              </Column>
              <Column>
                <Text style={{ ...styles.cardValue, color: "#EF4444", margin: 0 }}>
                  -{withdrawalFee}
                </Text>
              </Column>
            </Row>
          )}

          <Hr style={{ ...styles.divider, margin: "12px 0" }} />

          <Row>
            <Column>
              <Text style={{ color: "#0A1628", fontSize: "15px", fontWeight: "800", margin: 0 }}>
                Your net payout
              </Text>
            </Column>
            <Column>
              <Text style={{ color: "#059669", fontSize: "18px", fontWeight: "800", textAlign: "right", margin: 0 }}>
                {netPayout}
              </Text>
            </Column>
          </Row>
        </Section>

        {/* Arbitration note */}
        <Section style={{
          ...styles.card,
          backgroundColor: "#F0FDF4",
          border: "1px solid #BBF7D0",
        }}>
          <Text style={{ color: "#065F46", fontSize: "12px", margin: 0, lineHeight: "1.6" }}>
            ℹ️ The <strong>arbitration pool ({arbitrationPct}%)</strong> is held separately to fund dispute
            resolution. Since this order completed without a dispute, the arbitration pool has been
            released back into platform reserves.
          </Text>
        </Section>

        {/* CTA */}
        <Section style={{ textAlign: "center", margin: "28px 0 8px" }}>
          <Link href={walletUrl} style={styles.ctaButton}>
            View My Wallet →
          </Link>
        </Section>

        <Hr style={styles.divider} />

        <Text style={{ color: "#9CA3AF", fontSize: "12px", textAlign: "center", margin: 0 }}>
          Questions about your payout? Contact{" "}
          <Link href={`mailto:${supportEmail}`} style={{ color: "#D4A017" }}>
            {supportEmail}
          </Link>
        </Text>
      </Section>
    </EmailBase>
  )
}
