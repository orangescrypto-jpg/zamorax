// emails/BuybackRejected.tsx
// Sent when an admin/moderator marks a buyback_requests row "rejected"
// after physical inspection. Points the seller toward listing the device
// themselves instead (Path B), pre-filled from the same submission.

import { Section, Text, Hr, Link } from "@react-email/components"
import { EmailBase, styles } from "./layouts/EmailBase"

interface BuybackRejectedEmailProps {
  contactName:  string
  brand:        string
  model:        string
  listUrl:      string
  supportEmail: string
}

export default function BuybackRejectedEmail({
  contactName  = "there",
  brand        = "Samsung",
  model        = "Galaxy A13",
  listUrl      = "https://zamorax.com/sell-for-cash",
  supportEmail = "support@zamorax.com",
}: BuybackRejectedEmailProps) {
  return (
    <EmailBase preview={`We could not buy your ${brand} ${model} after inspection`}>
      <Section style={styles.body_content}>
        <Text style={styles.h1}>We could not buy this device</Text>
        <Text style={styles.subtitle}>
          Hi {contactName}, after inspecting your {brand} {model}, we are not able to buy it at the
          estimated price. You can still list it yourself on Zamorax and sell it to another buyer.
        </Text>

        <Section style={{ textAlign: "center", margin: "28px 0 8px" }}>
          <Link href={listUrl} style={styles.ctaButtonNavy}>
            List It Myself →
          </Link>
        </Section>

        <Hr style={styles.divider} />

        <Text style={{ color: "#9CA3AF", fontSize: "12px", textAlign: "center", margin: 0 }}>
          Questions? Email{" "}
          <Link href={`mailto:${supportEmail}`} style={{ color: "#D4A017" }}>
            {supportEmail}
          </Link>
        </Text>
      </Section>
    </EmailBase>
  )
}
