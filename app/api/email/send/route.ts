// app/api/email/send/route.ts
// Central email sending API. Reads Resend API key + settings from Firestore config/email.
// Called internally by other API routes (order creation, escrow release, dispute, registration).
// Never called directly from client — always server-to-server.
//
// POST /api/email/send
// Body: { type, to, data }
//
// Types:
//   order_confirmed   → buyer
//   escrow_released   → seller
//   dispute_opened    → buyer | seller (send twice, pass role in data)
//   welcome           → buyer | seller

import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"
import { render } from "@react-email/render"
import { getAdminDb } from "@/lib/firebase/admin"

import OrderConfirmedEmail  from "@/emails/OrderConfirmed"
import EscrowReleasedEmail  from "@/emails/EscrowReleased"
import DisputeOpenedEmail   from "@/emails/DisputeOpened"
import WelcomeEmail         from "@/emails/Welcome"

// ── Email settings type (mirrors config/email in Firestore) ───────────────────

interface EmailConfig {
  resendApiKey:        string
  fromName:            string
  fromEmail:           string
  supportEmail:        string
  sendOrderConfirmed:  boolean
  sendEscrowReleased:  boolean
  sendDisputeOpened:   boolean
  sendWelcome:         boolean
  enabled:             boolean
}

const DEFAULT_CONFIG: EmailConfig = {
  resendApiKey:        "",
  fromName:            "Zamorax",
  fromEmail:           "noreply@zamorax.com",
  supportEmail:        "support@zamorax.com",
  sendOrderConfirmed:  true,
  sendEscrowReleased:  true,
  sendDisputeOpened:   true,
  sendWelcome:         true,
  enabled:             false,   // off until API key is set
}

async function getEmailConfig(): Promise<EmailConfig> {
  try {
    const db   = getAdminDb()
    const snap = await db.collection("config").doc("email").get()
    if (snap.exists) return { ...DEFAULT_CONFIG, ...snap.data() } as EmailConfig
  } catch {}
  return DEFAULT_CONFIG
}

// ── Template renderer ──────────────────────────────────────────────────────────

async function renderTemplate(type: string, data: any, config: EmailConfig): Promise<{
  subject: string
  html:    string
} | null> {
  switch (type) {
    case "order_confirmed":
      return {
        subject: `Your order is confirmed — ${data.itemTitle}`,
        html: await render(OrderConfirmedEmail({
          buyerName:    data.buyerName,
          itemTitle:    data.itemTitle,
          orderId:      data.orderId,
          totalAmount:  data.totalAmount,
          sellerName:   data.sellerName,
          orderUrl:     `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/buyer/orders/${data.orderId}`,
          supportEmail: config.supportEmail,
        })),
      }

    case "escrow_released":
      return {
        subject: `💰 ${data.netPayout} credited to your wallet — ${data.itemTitle}`,
        html: await render(EscrowReleasedEmail({
          sellerName:     data.sellerName,
          itemTitle:      data.itemTitle,
          orderId:        data.orderId,
          grossAmount:    data.grossAmount,
          commissionAmt:  data.commissionAmt,
          commissionPct:  data.commissionPct,
          arbitrationAmt: data.arbitrationAmt,
          arbitrationPct: data.arbitrationPct,
          withdrawalFee:  data.withdrawalFee,
          netPayout:      data.netPayout,
          walletUrl:      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/seller/wallet`,
          supportEmail:   config.supportEmail,
        })),
      }

    case "dispute_opened":
      return {
        subject: `⚠️ Dispute opened on order ${data.orderId} — action required`,
        html: await render(DisputeOpenedEmail({
          recipientName: data.recipientName,
          role:          data.role,
          itemTitle:     data.itemTitle,
          orderId:       data.orderId,
          reason:        data.reason,
          orderUrl:      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/${data.role}/orders/${data.orderId}`,
          supportEmail:  config.supportEmail,
        })),
      }

    case "welcome":
      return {
        subject: `Welcome to Zamorax, ${data.name}! 🎉`,
        html: await render(WelcomeEmail({
          name:         data.name,
          role:         data.role,
          dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/${data.role}`,
          supportEmail: config.supportEmail,
        })),
      }

    default:
      return null
  }
}

// ── Toggle guards ──────────────────────────────────────────────────────────────

function isToggled(type: string, config: EmailConfig): boolean {
  const map: Record<string, keyof EmailConfig> = {
    order_confirmed: "sendOrderConfirmed",
    escrow_released: "sendEscrowReleased",
    dispute_opened:  "sendDisputeOpened",
    welcome:         "sendWelcome",
  }
  const key = map[type]
  return key ? Boolean(config[key]) : true
}

// ── Handler ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { type, to, data } = await req.json()

    if (!type || !to) {
      return NextResponse.json({ error: "Missing type or to" }, { status: 400 })
    }

    const config = await getEmailConfig()

    // Kill switch — if email not enabled or no API key, silently succeed
    if (!config.enabled || !config.resendApiKey) {
      console.log(`[email] Skipped (disabled or no API key): ${type} → ${to}`)
      return NextResponse.json({ skipped: true })
    }

    // Per-email toggle
    if (!isToggled(type, config)) {
      console.log(`[email] Skipped (toggled off): ${type} → ${to}`)
      return NextResponse.json({ skipped: true })
    }

    const template = await renderTemplate(type, data, config)
    if (!template) {
      return NextResponse.json({ error: `Unknown email type: ${type}` }, { status: 400 })
    }

    const resend = new Resend(config.resendApiKey)
    const from   = `${config.fromName} <${config.fromEmail}>`

    const result = await resend.emails.send({
      from,
      to:      Array.isArray(to) ? to : [to],
      subject: template.subject,
      html:    template.html,
    })

    if (result.error) {
      console.error("[email] Resend error:", result.error)
      return NextResponse.json({ error: result.error.message }, { status: 500 })
    }

    console.log(`[email] Sent: ${type} → ${to} (id: ${result.data?.id})`)
    return NextResponse.json({ success: true, id: result.data?.id })

  } catch (err: any) {
    console.error("[email] Unexpected error:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
