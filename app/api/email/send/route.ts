// app/api/email/send/route.ts
// Central email sending API. Reads Resend API key + settings from env.
// SECURITY: this route is NOT meant to be called directly from arbitrary
// browser sessions — without a gate, anyone could hit it repeatedly and
// burn through the Resend quota/cost (no rate limiting on Resend's side
// stops you from being billed or hitting your plan's sending cap).
//
// Allowed callers:
//   1. Internal server-to-server calls (other API routes, via
//      src/services/email.ts) — authenticated with INTERNAL_EMAIL_SECRET,
//      a server-only env var the browser never sees.
//   2. The admin email test page — authenticated with a real admin/mod
//      Supabase session (requireAdmin-equivalent check below).
// Anything else is rejected with 401/403 before any Resend call is made.
//
// On top of that, a simple in-memory per-recipient rate limit caps how
// many emails of the same type can be sent to the same address in a
// rolling window, so even a misbehaving internal caller (e.g. a retry
// loop bug) can't spam one inbox or blow through quota silently.
//
// Types:
//   order_confirmed   → buyer
//   escrow_released   → seller
//   dispute_opened    → buyer | seller (send twice, pass role in data)
//   welcome           → buyer | seller

import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"
import { render } from "@react-email/render"
import { requireAdmin } from "@/lib/auth-server"
import OrderConfirmedEmail  from "@/emails/OrderConfirmed"
import EscrowReleasedEmail  from "@/emails/EscrowReleased"
import DisputeOpenedEmail   from "@/emails/DisputeOpened"
import WelcomeEmail         from "@/emails/Welcome"
import OrderFundedSellerEmail from "@/emails/OrderFundedSeller"

// ── Rate limiting (in-memory, per server instance) ─────────────────────────
// Not perfectly distributed across serverless instances, but it's a real
// backstop against bursts/loops, which is the actual risk here — a single
// instance handling a retry storm is the common failure mode, not a
// coordinated multi-region attack (which the auth gate above already blocks).
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 1 hour
const RATE_LIMIT_MAX_PER_RECIPIENT = 5      // max emails of one type per recipient per window

const sendLog = new Map<string, number[]>() // key: `${type}:${to}` → timestamps

function isRateLimited(type: string, to: string): boolean {
  const key = `${type}:${to.toLowerCase()}`
  const now = Date.now()
  const timestamps = (sendLog.get(key) ?? []).filter(t => now - t < RATE_LIMIT_WINDOW_MS)
  if (timestamps.length >= RATE_LIMIT_MAX_PER_RECIPIENT) {
    sendLog.set(key, timestamps)
    return true
  }
  timestamps.push(now)
  sendLog.set(key, timestamps)
  return false
}

// ── Email settings type ────────────────────────────────────────────────────

interface EmailConfig {
  resendApiKey:        string
  fromName:            string
  fromEmail:           string
  supportEmail:        string
  sendOrderConfirmed:  boolean
  sendEscrowReleased:  boolean
  sendDisputeOpened:   boolean
  sendWelcome:         boolean
  sendOrderFundedSeller: boolean
  enabled:             boolean
}

const DEFAULT_CONFIG: EmailConfig = {
  resendApiKey:        "",
  fromName:            "Zamorax",
  fromEmail:           "noreply@mail.zamorax.com",
  supportEmail:        "support@zamorax.com",
  sendOrderConfirmed:  true,
  sendEscrowReleased:  true,
  sendDisputeOpened:   true,
  sendWelcome:         true,
  sendOrderFundedSeller: true,
  enabled:             false,   // off until API key is set
}

async function getEmailConfig(): Promise<EmailConfig> {
  // Firebase has been removed — config is driven by environment variables
  const resendApiKey = process.env.RESEND_API_KEY ?? ""
  return {
    ...DEFAULT_CONFIG,
    resendApiKey,
    enabled: resendApiKey.length > 0,
  }
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

    case "order_funded_seller":
      return {
        subject: data.buyerPhone
          ? `💰 Payment confirmed — ${data.itemTitle} (buyer: ${data.buyerPhone})`
          : `💰 Payment confirmed — ${data.itemTitle}`,
        html: await render(OrderFundedSellerEmail({
          sellerName:   data.sellerName,
          itemTitle:    data.itemTitle,
          orderId:      data.orderId,
          totalAmount:  data.totalAmount,
          buyerName:    data.buyerName,
          buyerPhone:   data.buyerPhone ?? "",
          orderUrl:     `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/seller/orders/${data.orderId}`,
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
    order_funded_seller: "sendOrderFundedSeller",
  }
  const key = map[type]
  return key ? Boolean(config[key]) : true
}

// ── Handler ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // ── Auth gate: internal secret OR admin/moderator session ─────
    const internalSecret = req.headers.get("x-internal-secret") ?? ""
    const expectedSecret = process.env.INTERNAL_EMAIL_SECRET ?? ""
    const isInternalCall = expectedSecret.length > 0 && internalSecret === expectedSecret

    if (!isInternalCall) {
      const auth = await requireAdmin(req)
      if (!auth.ok) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
    }

    const { type, to, data } = await req.json()

    if (!type || !to) {
      return NextResponse.json({ error: "Missing type or to" }, { status: 400 })
    }

    // ── Rate limit: cap repeated sends of the same type to the same address ──
    const recipients = Array.isArray(to) ? to : [to]
    for (const recipient of recipients) {
      if (isRateLimited(type, String(recipient))) {
        console.warn(`[email] Rate limited: ${type} → ${recipient}`)
        return NextResponse.json({ error: "Rate limit exceeded for this recipient." }, { status: 429 })
      }
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
