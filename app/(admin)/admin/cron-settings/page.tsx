"use client"
// app/(admin)/admin/cron-settings/page.tsx
// Admin generates or views the secret used by cron-job.org (or any other
// scheduler) to call the layaway-sweep and escrow-release endpoints.
import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, ArrowLeft, RefreshCw, Copy, ShieldCheck } from "lucide-react"
import { adminFetch } from "@/lib/admin-fetch"
import { useToast } from "@/components/ui/use-toast"

export default function AdminCronSettingsPage() {
  const { toast } = useToast()
  const [secret, setSecret] = useState<string | null>(null)
  const [source, setSource] = useState<string>("none")
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [siteUrl, setSiteUrl] = useState("https://zamorax.com")

  useEffect(() => {
    adminFetch("/api/admin/cron-settings")
      .then(r => r.json())
      .then(json => {
        setSecret(json.secret)
        setSource(json.source)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const generate = async () => {
    setGenerating(true)
    try {
      const res = await adminFetch("/api/admin/cron-settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to generate")
      setSecret(json.secret)
      setSource("database")
      toast({ title: "New cron secret generated", description: "Update your cron-job.org URLs with the new secret." })
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setGenerating(false)
    }
  }

  const copy = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({ title: "Copied" })
  }

  if (loading) return (
    <div className="flex h-[60vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )

  const layawayUrl = secret ? `${siteUrl}/api/cron/layaway-sweep?secret=${secret}` : ""
  const escrowUrl = secret ? `${siteUrl}/api/cron/escrow-release?secret=${secret}` : ""

  return (
    <div className="container py-8 max-w-2xl space-y-5 pb-32">
      <div>
        <Link href="/admin" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1">
          <ArrowLeft className="h-3 w-3" /> Back to Admin
        </Link>
        <h1 className="text-2xl font-heading font-bold">Cron Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Generate the secret used to authorise scheduled jobs, then paste the URLs below into cron-job.org.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className={`h-4 w-4 ${secret ? "text-emerald-600" : "text-muted-foreground"}`} />
            Cron Secret
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {secret ? (
            <div className="space-y-2">
              <Label className="text-xs">Current secret ({source === "database" ? "saved here" : "from environment variable"})</Label>
              <div className="flex gap-2">
                <Input readOnly value={secret} className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={() => copy(secret)}><Copy className="h-4 w-4" /></Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No secret set yet. Generate one below.</p>
          )}
          <Button onClick={generate} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Generate New Secret
          </Button>
        </CardContent>
      </Card>

      {secret && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Cron-job.org URLs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Site URL</Label>
              <Input value={siteUrl} onChange={e => setSiteUrl(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Layaway Sweep (run daily)</Label>
              <div className="flex gap-2">
                <Input readOnly value={layawayUrl} className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={() => copy(layawayUrl)}><Copy className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Escrow Release (run every 6 hours)</Label>
              <div className="flex gap-2">
                <Input readOnly value={escrowUrl} className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={() => copy(escrowUrl)}><Copy className="h-4 w-4" /></Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
