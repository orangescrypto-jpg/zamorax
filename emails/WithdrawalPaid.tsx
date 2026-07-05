// emails/WithdrawalPaid.tsx
// Sent to the SELLER when admin marks a withdrawal as paid — includes the
// transfer reference and a link to the payment proof admin attached, so
// the seller doesn't have to log in and dig through the wallet tab to find
// evidence the transfer actually happened.

import { Section, Text, Hr, Link, Row, Column } from "@react-email/components"
import { EmailBase, styles } from "./layouts/EmailBase"

interface WithdrawalPaidEmailProps {
  sellerName:    string
  amount:        string
  bankName:      string
  accountNumber: string
  reference:     string
  proofUrl:      string | null
  walletUrl:     string
  supportEmail:  string
}

export default function WithdrawalPaidEmail({
  sellerName    = "there",
  amount        = "₦10,000.00",
  bankName      = "Opay",
  accountNumber = "7052254869",
  reference     = "TRF-ABC123",
  proofUrl      = null,
  walletUrl     = "https://zamorax.com/dashboard/seller/wallet",
  supportEmail  = "support@zamorax.com",
}: WithdrawalPaidEmailProps) {
  return (
    <EmailBase preview={`Payout completed — ${amount} sent to your bank`}>
      <Section style={styles.body_content}>
        <Section style={{
          backgroundColor: "#ECFDF5",
          border: "1px solid #A7F3D0",
          borderRadius: "8px",
          padding: "12px 16px",
          marginBottom: "20px",
        }}>
          <Text style={{ color: "#065F46", fontSize: "14px", fontWeight: "700", margin: 0 }}>
            ✅ Payout Completed
          </Text>
        </Section>

        <Text style={styles.h1}>Your withdrawal has been paid</Text>
        <Text style={styles.subtitle}>
          Hi {sellerName}, {amount} has been sent to your {bankName} account ending in{" "}
          {accountNumber.slice(-4)}. See the transfer reference and proof of payment below.
        </Text>

        <Section style={styles.card}>
          <Row style={{ margin: "6px 0" }}>
            <Column><Text style={{ ...styles.cardLabel, margin: 0 }}>Amount</Text></Column>
            <Column><Text style={{ ...styles.cardValue, margin: 0 }}>{amount}</Text></Column>
          </Row>
          <Row style={{ margin: "6px 0" }}>
            <Column><Text style={{ ...styles.cardLabel, margin: 0 }}>Bank</Text></Column>
            <Column><Text style={{ ...styles.cardValue, margin: 0 }}>{bankName} — {accountNumber}</Text></Column>
          </Row>
          <Row style={{ margin: "6px 0" }}>
            <Column><Text style={{ ...styles.cardLabel, margin: 0 }}>Reference</Text></Column>
            <Column>
              <Text style={{ ...styles.cardValue, fontFamily: "monospace", margin: 0 }}>{reference}</Text>
            </Column>
          </Row>
        </Section>

        {proofUrl && (
          <Section style={{ textAlign: "center", margin: "20px 0 8px" }}>
            <Link href={proofUrl} style={styles.ctaButtonNavy}>View Payment Proof →</Link>
          </Section>
        )}

        <Section style={{ textAlign: "center", margin: "12px 0 8px" }}>
          <Link href={walletUrl} style={{ color: "#D4A017", fontSize: "13px" }}>
            View full transaction history →
          </Link>
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
