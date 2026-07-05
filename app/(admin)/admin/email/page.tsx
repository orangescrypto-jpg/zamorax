"use client"
// app/(admin)/admin/email/page.tsx
// Dedicated email settings page — separate from the massive settings/page.tsx.
// Saves to Firestore: config/email — read by /api/email/send on every send.
//
// Admin controls:
//   - Master on/off toggle
//   - Resend API key
//   - From name + from email
//   - Support email (shown in footers)
//   - Per-email toggles
//   - Send a test email

import { useEffect, useState } from "react"
import { AdminService, serverTimestamp } from "@/src/services"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import {
  Mail, Save, Loader2, Send, Eye, EyeOff,
  ShieldCheck, CheckCircle, AlertCircle, Info,
} from "lucide-react"

interface EmailConfig {
  resendApiKey:        string
  fromName:            string
  fromEmail:           string
  supportEmail:        string
  adminNotifyEmails:   string   // comma-separated — BCC'd on every order-related email
  sendOrderConfirmed:  boolean
  sendEscrowReleased:  boolean
  sendDisputeOpened:   boolean
  sendWelcome:         boolean
  enabled:             boolean
}

const DEFAULTS: EmailConfig = {
  resendApiKey:        "",
  fromName:            "Zamorax",
  fromEmail:           "noreply@zamorax.com",
  supportEmail:        "support@zamorax.com",
  adminNotifyEmails:   "",
  sendOrderConfirmed:  true,
  sendEscrowReleased:  true,
  sendDisputeOpened:   true,
  sendWelcome:         true,
  enabled:             false,
}

function ToggleRow({
  label, desc, checked, onChange,
}: {
  label: string; desc?: string; checked: boolean; onChange: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {desc && <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

export default function AdminEmailPage() {
  const { toast } = useToast()
  const [cfg,       setCfg]       = useState<EmailConfig>(DEFAULTS)
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [showKey,   setShowKey]   = useState(false)
  const [testEmail, setTestEmail] = useState("")
  const [testing,   setTesting]   = useState(false)
  const [testType,  setTestType]  = useState("order_confirmed")

  useEffect(() => {
    AdminService.getDoc("config", "email")
      .then(doc => { if (doc) setCfg(prev => ({ ...prev, ...(doc as Partial<EmailConfig>) })) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      await AdminService.setDoc(
        "config", "email",
        { ...cfg, updatedAt: serverTimestamp() },
        { merge: true }
      )
      toast({ title: "✅ Email settings saved" })
    } catch {
      toast({ title: "Error saving", variant: "destructive" })
    } finally { setSaving(false) }
  }

  const sendTest = async () => {
    if (!testEmail) {
      toast({ title: "Enter a test email address", variant: "destructive" }); return
    }
    if (!cfg.resendApiKey) {
      toast({ title: "Add your Resend API key first", variant: "destructive" }); return
    }
    setTesting(true)
    try {
      const testData: Record<string, any> = {
        order_confirmed: {
          buyerName: "Test Buyer", itemTitle: "Test Item", orderId: "TEST-001",
          totalAmount: "₦50,000", sellerName: "Test Seller",
        },
        escrow_released: {
          sellerName: "Test Seller", itemTitle: "Test Item", orderId: "TEST-001",
          grossAmount: "₦50,000", commissionAmt: "₦2,000", commissionPct: "4",
          arbitrationAmt: "₦250", arbitrationPct: "0.5",
          withdrawalFee: "₦150", netPayout: "₦47,600",
        },
        dispute_opened: {
          recipientName: "Test User", role: "buyer", itemTitle: "Test Item",
          orderId: "TEST-001", reason: "Item not as described",
        },
        welcome: { name: "Test User", role: "buyer" },
      }

      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: testType, to: testEmail, data: testData[testType] }),
      })
      const result = await res.json()
      if (result.skipped) {
        toast({
          title: "Email skipped",
          description: "Email is disabled or API key not set. Save settings and enable email first.",
          variant: "destructive",
        })
      } else if (result.success) {
        toast({ title: `✅ Test email sent to ${testEmail}` })
      } else {
        toast({ title: "Send failed", description: result.error, variant: "destructive" })
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally { setTesting(false) }
  }

  if (loading) return (
    <div className="flex h-[60vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )

  const isReady = cfg.enabled && cfg.resendApiKey && cfg.fromEmail

  return (
    <div className="container py-8 max-w-2xl space-y-6 pb-32">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <Mail className="h-6 w-6 text-primary" /> Email Settings
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Branded transactional emails via Resend — order confirmations, payouts, disputes.
          </p>
        </div>
        <Button onClick={save} disabled={saving} className="bg-primary text-white">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-2" />Save</>}
        </Button>
      </div>

      {/* Status banner */}
      {isReady ? (
        <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
          <p className="text-sm text-emerald-800 font-medium">Emails are active — Zamorax is sending branded emails via Resend.</p>
        </div>
      ) : (
        <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-amber-800 font-medium">Emails are not active yet</p>
            <p className="text-xs text-amber-700 mt-0.5">
              {!cfg.resendApiKey ? "Add your Resend API key below and enable emails." : "Toggle email on to start sending."}
            </p>
          </div>
        </div>
      )}

      {/* Master toggle */}
      <Card className={cfg.enabled ? "border-primary/30 ring-1 ring-primary/10" : ""}>
        <CardContent className="p-4">
          <ToggleRow
            label="Enable email sending"
            desc="Master switch — turn off to pause all transactional emails without losing settings"
            checked={cfg.enabled}
            onChange={() => setCfg(p => ({ ...p, enabled: !p.enabled }))}
          />
        </CardContent>
      </Card>

      {/* Resend config */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Resend Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
            <Info className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-700">
              Get your API key from{" "}
              <a href="https://resend.com/api-keys" target="_blank" className="font-semibold underline">
                resend.com/api-keys
              </a>
              . Use a domain-verified sending address for best deliverability.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Resend API Key</Label>
            <div className="flex gap-2">
              <Input
                type={showKey ? "text" : "password"}
                value={cfg.resendApiKey}
                onChange={e => setCfg(p => ({ ...p, resendApiKey: e.target.value }))}
                placeholder="re_xxxxxxxxxxxxxxxxxxxx"
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowKey(s => !s)}
                className="shrink-0"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>From Name</Label>
              <Input
                value={cfg.fromName}
                onChange={e => setCfg(p => ({ ...p, fromName: e.target.value }))}
                placeholder="Zamorax"
              />
            </div>
            <div className="space-y-1.5">
              <Label>From Email</Label>
              <Input
                type="email"
                value={cfg.fromEmail}
                onChange={e => setCfg(p => ({ ...p, fromEmail: e.target.value }))}
                placeholder="noreply@zamorax.com"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Support Email</Label>
            <Input
              type="email"
              value={cfg.supportEmail}
              onChange={e => setCfg(p => ({ ...p, supportEmail: e.target.value }))}
              placeholder="support@zamorax.com"
            />
            <p className="text-xs text-muted-foreground">Shown in email footers and dispute emails.</p>
          </div>

          <div className="space-y-1.5">
            <Label>Admin Notification Email(s)</Label>
            <Input
              value={cfg.adminNotifyEmails}
              onChange={e => setCfg(p => ({ ...p, adminNotifyEmails: e.target.value }))}
              placeholder="admin@zamorax.com, ops@zamorax.com"
            />
            <p className="text-xs text-muted-foreground">
              Comma-separated. BCC'd on every order email (order confirmed, payment funded, escrow released, dispute opened) so admin sees every order in real time. Leave blank to disable.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Per-email toggles */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            Email Types
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ToggleRow
            label="Order Confirmed (Buyer)"
            desc="Sent to buyer when payment is received and escrow is active"
            checked={cfg.sendOrderConfirmed}
            onChange={() => setCfg(p => ({ ...p, sendOrderConfirmed: !p.sendOrderConfirmed }))}
          />
          <Separator />
          <ToggleRow
            label="Escrow Released (Seller)"
            desc="Sent to seller with full payout breakdown when buyer confirms receipt"
            checked={cfg.sendEscrowReleased}
            onChange={() => setCfg(p => ({ ...p, sendEscrowReleased: !p.sendEscrowReleased }))}
          />
          <Separator />
          <ToggleRow
            label="Dispute Opened (Buyer + Seller)"
            desc="Sent to both parties when a dispute is raised — includes next steps"
            checked={cfg.sendDisputeOpened}
            onChange={() => setCfg(p => ({ ...p, sendDisputeOpened: !p.sendDisputeOpened }))}
          />
          <Separator />
          <ToggleRow
            label="Welcome Email (New Users)"
            desc="Sent on registration — tailored for buyer vs seller role"
            checked={cfg.sendWelcome}
            onChange={() => setCfg(p => ({ ...p, sendWelcome: !p.sendWelcome }))}
          />
        </CardContent>
      </Card>

      {/* Test email */}
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Send className="h-4 w-4 text-primary" />
            Send Test Email
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Preview exactly how emails will look. Save your settings first before testing.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Email Type</Label>
              <select
                value={testType}
                onChange={e => setTestType(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="order_confirmed">Order Confirmed (Buyer)</option>
                <option value="escrow_released">Escrow Released (Seller)</option>
                <option value="dispute_opened">Dispute Opened</option>
                <option value="welcome">Welcome Email</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Send To</Label>
              <Input
                type="email"
                value={testEmail}
                onChange={e => setTestEmail(e.target.value)}
                placeholder="your@email.com"
              />
            </div>
          </div>
          <Button
            onClick={sendTest}
            disabled={testing || !testEmail}
            variant="outline"
            className="w-full"
          >
            {testing
              ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Sending…</>
              : <><Send className="h-4 w-4 mr-2" />Send Test Email</>
            }
          </Button>
        </CardContent>
      </Card>

      {/* Sticky save */}
      <div className="sticky bottom-4 flex justify-end">
        <Button
          onClick={save}
          disabled={saving}
          size="lg"
          className="bg-primary text-white shadow-lg min-w-40"
        >
          {saving
            ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving…</>
            : <><Save className="h-4 w-4 mr-2" />Save Email Settings</>
          }
        </Button>
      </div>
    </div>
  )
}
