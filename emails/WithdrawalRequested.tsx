// emails/WithdrawalRequested.tsx
// Sent to the SELLER the moment they submit a withdrawal request (before
// admin has acted on it) — confirms the amount was deducted and is pending
// review, so a seller isn't left wondering whether the request went through.

import { Section, Text, Hr, Link, Row, Column } from "@react-email/components"
import { EmailBase, styles } from "./layouts/EmailBase"

interface WithdrawalRequestedEmailProps {
  sellerName:     string
  amount:         string
  bankName:       string
  accountNumber:  string
  accountName:    string
  walletUrl:      string
  supportEmail:   string
}

export default function WithdrawalRequestedEmail({
  sellerName    = "there",
  amount        = "₦10,000.00",
  bankName      = "Opay",
  accountNumber = "7052254869",
  accountName   = "Alasiri Emmanuel",
  walletUrl     = "https://zamorax.com/dashboard/seller/wallet",
  supportEmail  = "support@zamorax.com",
}: WithdrawalRequestedEmailProps) {
  return (
    <EmailBase preview={`Withdrawal request received — ${amount}`}>
      <Section style={styles.body_content}>
        <Section style={{
          backgroundColor: "#EFF6FF",
          border: "1px solid #BFDBFE",
          borderRadius: "8px",
          padding: "12px 16px",
          marginBottom: "20px",
        }}>
          <Text style={{ color: "#1E40AF", fontSize: "14px", fontWeight: "700", margin: 0 }}>
            🏦 Withdrawal Requested
          </Text>
        </Section>

        <Text style={styles.h1}>Your withdrawal request was received</Text>
        <Text style={styles.subtitle}>
          Hi {sellerName}, we've received your request to withdraw {amount} from your Zamorax wallet.
          The amount has already been deducted from your available balance and is being reviewed by
          our team. You'll get another email the moment it's paid out.
        </Text>

        <Section style={styles.card}>
          <Row style={{ margin: "6px 0" }}>
            <Column><Text style={{ ...styles.cardLabel, margin: 0 }}>Amount</Text></Column>
            <Column><Text style={{ ...styles.cardValue, margin: 0 }}>{amount}</Text></Column>
          </Row>
          <Row style={{ margin: "6px 0" }}>
            <Column><Text style={{ ...styles.cardLabel, margin: 0 }}>Bank</Text></Column>
            <Column><Text style={{ ...styles.cardValue, margin: 0 }}>{bankName}</Text></Column>
          </Row>
          <Row style={{ margin: "6px 0" }}>
            <Column><Text style={{ ...styles.cardLabel, margin: 0 }}>Account</Text></Column>
            <Column>
              <Text style={{ ...styles.cardValue, margin: 0 }}>{accountNumber} — {accountName}</Text>
            </Column>
          </Row>
        </Section>

        <Section style={{ textAlign: "center", margin: "28px 0 8px" }}>
          <Link href={walletUrl} style={styles.ctaButtonNavy}>View Wallet →</Link>
        </Section>

        <Hr style={styles.divider} />

        <Text style={{ color: "#9CA3AF", fontSize: "12px", textAlign: "center", margin: 0 }}>
          Questions? Email{" "}
          <Link href={`mailto:${supportEmail}`} style={{ color: "#D4A017" }}>{supportEmail}</Link>
        </Text>
      </Section>
    </EmailBase>
  )
}
