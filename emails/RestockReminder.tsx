// emails/RestockReminder.tsx
// Sent to a seller partway through the out-of-stock auto-delete window
// (see app/api/cron/listing-expiry-sweep/route.ts). Warns that the
// listing will be permanently deleted, images included, if not restocked
// by deleteDate.

import { Section, Text, Hr, Link } from "@react-email/components"
import { EmailBase, styles } from "./layouts/EmailBase"

interface RestockReminderEmailProps {
  sellerName:   string
  itemTitle:    string
  daysLeft:     number
  deleteDate:   string
  listingUrl:   string
  supportEmail: string
}

export default function RestockReminderEmail({
  sellerName   = "there",
  itemTitle    = "Samsung Galaxy A13",
  daysLeft     = 30,
  deleteDate   = "a future date",
  listingUrl   = "https://zamorax.com/dashboard/seller/listings",
  supportEmail = "support@zamorax.com",
}: RestockReminderEmailProps) {
  return (
    <EmailBase preview={`"${itemTitle}" will be deleted in ${daysLeft} days if not restocked`}>
      <Section style={styles.body_content}>
        <Section style={{
          backgroundColor: "#FFFBEB",
          border: "1px solid #FDE68A",
          borderRadius: "8px",
          padding: "12px 16px",
          marginBottom: "20px",
        }}>
          <Text style={{ color: "#92400E", fontSize: "14px", fontWeight: "700", margin: 0 }}>
            ⏳ Restock reminder
          </Text>
        </Section>

        <Text style={styles.h1}>Your listing is still out of stock</Text>
        <Text style={styles.subtitle}>
          Hi {sellerName}, your listing "{itemTitle}" has had 0 units in stock for a while now.
          If it is not restocked by {deleteDate}, it will be permanently deleted, including its photos.
        </Text>

        <Section style={styles.card}>
          <Text style={{ ...styles.cardLabel, margin: 0 }}>Listing</Text>
          <Text style={{ ...styles.cardValue, margin: "4px 0 0" }}>{itemTitle}</Text>
          <Text style={{ ...styles.cardLabel, margin: "12px 0 0" }}>Days remaining</Text>
          <Text style={{ ...styles.cardValue, margin: "4px 0 0" }}>{daysLeft} days</Text>
        </Section>

        <Section style={{ textAlign: "center", margin: "28px 0 8px" }}>
          <Link href={listingUrl} style={styles.ctaButtonNavy}>
            Restock Now →
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
