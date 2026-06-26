"use client"
// components/admin/BankDetailsSettings.tsx
// Reads/writes platform bank details via API

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { Landmark, Loader2, Save, CheckCircle2, AlertCircle } from "lucide-react"
import type { BankDetails } from "@/src/types/payment"

const NIGERIAN_BANKS = [
  "Access Bank", "Fidelity Bank", "FCMB", "First Bank",
  "GTBank", "Keystone Bank", "Kuda Bank", "Moniepoint",
  "Opay", "Palmpay", "Polaris Bank", "Stanbic IBTC",
  "Sterling Bank", "UBA", "Union Bank", "Wema Bank", "Zenith Bank",
]

const BANK_CODES: Record<string, string> = {
  "Access Bank": "044", "GTBank": "058", "First Bank": "011",
  "UBA": "033", "Zenith Bank": "057", "Stanbic IBTC": "221",
  "Sterling Bank": "232", "Union Bank": "032", "Wema Bank": "035",
  "Polaris Bank": "076", "Keystone Bank": "082", "Fidelity Bank": "070",
  "FCMB": "214", "Opay": "999992", "Palmpay": "999991",
  "Moniepoint": "50515", "Kuda Bank": "50211",
}

export function BankDetailsSettings() {
  const { toast } = useToast()
  const [bankName, setBankName]           = useState("")
  const [accountNumber, setAccountNumber] = useState("")
  const [accountName, setAccountName]     = useState("")
  const [loading, setLoading]             = useState(true)
  const [saving, setSaving]               = useState(false)
  const [lastSaved, setLastSaved]         = useState<BankDetails | null>(null)

  useEffect(() => {
    fetch("/api/payment/bank-details")
      .then(r => r.json())
      .then(data => {
        if (data.bankDetails) {
          const d = data.bankDetails as BankDetails
          setBankName(d.bankName || "")
          setAccountNumber(d.accountNumber || "")
          setAccountName(d.accountName || "")
          setLastSaved(d)
        }
      })
      .catch(err => console.error("BankDetailsSettings: load error", err))
      .finally(() => setLoading(false))
  }, [])

  const isConfigured = lastSaved?.bankName && lastSaved?.accountNumber && lastSaved?.accountName

  const handleSave = async () => {
    if (!bankName.trim() || !accountNumber.trim() || !accountName.trim()) {
      toast({ title: "All fields are required", variant: "destructive" })
      return
    }
    if (accountNumber.length < 10) {
      toast({ title: "Account number must be at least 10 digits", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/payment/bank-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankName, accountNumber, accountName, bankCode: BANK_CODES[bankName] ?? "" }),
      })
      if (!res.ok) throw new Error("Failed to save")
      setLastSaved({ bankName, accountNumber, accountName, bankCode: BANK_CODES[bankName] ?? "" })
      toast({ title: "✅ Bank details saved", description: "Buyers will see this account for all manual payments." })
    } catch (err: any) {
      toast({ title: "Error saving bank details", description: err.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <Landmark className="h-4 w-4 text-primary" />
            Platform Bank Account
          </span>
          {isConfigured ? (
            <Badge className="bg-green-100 text-green-800 gap-1 text-xs">
              <CheckCircle2 className="h-3 w-3" /> Configured
            </Badge>
          ) : (
            <Badge className="bg-red-100 text-red-800 gap-1 text-xs">
              <AlertCircle className="h-3 w-3" /> Not configured
            </Badge>
          )}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          This is the account buyers transfer to when using manual payment.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="bankName">Bank Name</Label>
              <select
                id="bankName"
                value={bankName}
                onChange={e => setBankName(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">— Select bank —</option>
                {NIGERIAN_BANKS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="accountNumber">Account Number</Label>
              <Input
                id="accountNumber"
                placeholder="0123456789"
                value={accountNumber}
                onChange={e => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
                maxLength={10}
                inputMode="numeric"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="accountName">Account Name</Label>
              <Input
                id="accountName"
                placeholder="ZAMORAX TECHNOLOGIES LTD"
                value={accountName}
                onChange={e => setAccountName(e.target.value.toUpperCase())}
                className="font-mono uppercase"
              />
            </div>
            <Button
              onClick={handleSave}
              disabled={saving || !bankName || !accountNumber || !accountName}
              className="w-full bg-primary text-white hover:bg-primary/90"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save Bank Details
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
