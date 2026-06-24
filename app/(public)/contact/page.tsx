"use client"

import { useState } from "react"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Mail, MessageCircle, MapPin, Clock, Loader2 } from "lucide-react"
import Link from "next/link"
import { usePlatformSettings } from "@/hooks/usePlatformSettings"

export default function ContactPage() {
  const { toast } = useToast()
  const { settings } = usePlatformSettings()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({ name: "", email: "", subject: "", message: "", type: "support" })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(formData) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to send")
      toast({ title: "Message Sent", description: "We'll reply within 24 hours.", variant: "success" })
      setFormData({ name: "", email: "", subject: "", message: "", type: "support" })
    } catch (err: any) {
      toast({ title: "Failed to send", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  // Derive the WhatsApp href — prefer the dedicated contactPhone (display-formatted),
  // fall back to whatsappSupportNumber (digits-only) for the link target.
  const waTarget = settings.whatsappSupportNumber || ""
  const waHref = waTarget
    ? `https://wa.me/${waTarget}?text=${encodeURIComponent(settings.whatsappSupportMessage || "Hi Zamorax Support")}`
    : null

  return (
    <div className="container py-12 max-w-5xl">
      <h1 className="text-3xl md:text-4xl font-heading font-bold mb-2">Contact Support</h1>
      <p className="text-muted-foreground mb-8">We're here to help. Choose the right channel for faster resolution.</p>

      <div className="grid md:grid-cols-2 gap-8">
        {/* ── Contact Form ─────────────────────────────────────────────────── */}
        <Card>
          <CardHeader><CardTitle>Send Us a Message</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  placeholder="Your Name"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  required
                />
                <Input
                  type="email"
                  placeholder="Email Address"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              <Select value={formData.type} onValueChange={v => setFormData({ ...formData, type: v })}>
                <SelectTrigger><SelectValue placeholder="Inquiry Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="support">General Support</SelectItem>
                  <SelectItem value="dispute">Transaction Dispute</SelectItem>
                  <SelectItem value="business">Business/Partnership</SelectItem>
                  <SelectItem value="press">Press/Media</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="Subject"
                value={formData.subject}
                onChange={e => setFormData({ ...formData, subject: e.target.value })}
                required
              />
              <Textarea
                placeholder="Describe your issue or question..."
                rows={5}
                value={formData.message}
                onChange={e => setFormData({ ...formData, message: e.target.value })}
                required
              />
              <Button type="submit" disabled={loading} className="w-full">
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Send Message
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* ── Contact Info Card ─────────────────────────────────────────────── */}
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6 space-y-4">
              {/* Email */}
              {settings.contactEmail && (
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-primary mt-1 shrink-0" />
                  <div>
                    <p className="font-medium">Email Support</p>
                    <a
                      href={`mailto:${settings.contactEmail}`}
                      className="text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      {settings.contactEmail}
                    </a>
                    <p className="text-xs text-muted-foreground">Response time: &lt;24 hours</p>
                  </div>
                </div>
              )}

              {/* WhatsApp */}
              {(settings.contactPhone || waTarget) && (
                <div className="flex items-start gap-3">
                  <MessageCircle className="h-5 w-5 text-green-600 mt-1 shrink-0" />
                  <div>
                    <p className="font-medium">WhatsApp Support</p>
                    {waHref ? (
                      <a
                        href={waHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-muted-foreground hover:text-primary transition-colors"
                      >
                        {settings.contactPhone || `+${waTarget}`}
                      </a>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {settings.contactPhone}
                      </p>
                    )}
                    {settings.supportHours && (
                      <p className="text-xs text-muted-foreground">Available: {settings.supportHours}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Address */}
              {settings.contactAddress && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-secondary mt-1 shrink-0" />
                  <div>
                    <p className="font-medium">Headquarters</p>
                    <p className="text-sm text-muted-foreground">{settings.contactAddress}</p>
                  </div>
                </div>
              )}

              {/* Support Hours */}
              {settings.supportHours && (
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-muted-foreground mt-1 shrink-0" />
                  <div>
                    <p className="font-medium">Support Hours</p>
                    <p className="text-sm text-muted-foreground">{settings.supportHours}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-muted/30">
            <CardContent className="p-6">
              <h3 className="font-semibold mb-3">Quick Links</h3>
              <ul className="space-y-2 text-sm text-primary">
                <li><Link href="/how-it-works">How Escrow Works</Link></li>
                <li><Link href="/safety">Safety Guidelines</Link></li>
                <li><Link href="/terms">Terms of Service</Link></li>
                <li><Link href="/pricing">Fee Schedule & Plans</Link></li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
