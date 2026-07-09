"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useToast } from "@/components/ui/use-toast"
import { formatPrice } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Wallet, ArrowLeft, Loader2, CheckCircle, Building2, AlertTriangle } from "lucide-react"
import { useRouter } from "next/navigation"

const NIGERIAN_BANKS = [
  "Access Bank", "First Bank", "GTBank", "UBA", "Zenith Bank",
  "Fidelity Bank", "FCMB", "Union Bank", "Sterling Bank", "Stanbic IBTC",
  "Opay", "Palmpay", "Kuda Bank", "Moniepoint", "Wema Bank",
]

const MIN_WITHDRAWAL = 500000 // ₦5,000 in kobo

type AgentWallet = { balance: number; totalEarned: number }

export default function AgentWithdrawPage() {
  const { user } = useAuth()
  const router = useRouter()
  const { toast } = useToast()

  const [wallet, setWallet] = useState<AgentWallet>({ balance: 0, totalEarned: 0 })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const [bank, setBank] = useState("")
  const [accountNumber, setAccountNumber] = useState("")
  const [accountName, setAccountName] = useState("")
  const [amount, setAmount] = useState("")

  useEffect(() => {
    if (!user?.uid) return
    fetch("/api/agent/wallet")
      .then(res => res.json())
      .then(data => {
        const w = data?.wallet
        if (w) setWallet({ balance: w.balance ?? 0, totalEarned: w.total_earned ?? 0 })
      })
      .catch(() => { /* leave defaults on failure */ })
      .finally(() => setLoading(false))
  }, [user?.uid])

  const amountKobo = Math.round(parseFloat(amount || "0") * 100)
  const canSubmit = bank && accountNumber.length === 10 && accountName.trim() && amountKobo >= MIN_WITHDRAWAL && amountKobo <= wallet.balance

  const handleSubmit = async () => {
    if (!user?.uid || !canSubmit) return
    setSubmitting(true)
    try {
      const res = await fetch("/api/agent/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountKobo,
          bankName: bank,
          accountNumber,
          accountName: accountName.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? "Something went wrong")

      setDone(true)
      toast({ title: "Withdrawal Requested ✅", description: "Admin will process within 24hrs.", variant: "success" })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally { setSubmitting(false) }
  }

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>

  if (done) return (
    <div className="container max-w-md py-16 text-center space-y-4">
      <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center mx-auto">
        <CheckCircle className="h-10 w-10 text-green-600" />
      </div>
      <h1 className="text-2xl font-heading font-bold">Request Submitted!</h1>
      <p className="text-muted-foreground text-sm">
        Your withdrawal of <strong>{formatPrice(amountKobo)}</strong> to {bank} ({accountNumber}) is being processed.
        Expect payment within <strong>24 hours</strong>.
      </p>
      <Button onClick={() => router.push("/dashboard/agent")} className="w-full bg-primary text-white">
        Back to Agent Dashboard
      </Button>
    </div>
  )

  return (
    <main className="container max-w-md py-6 pb-24 space-y-5">
      <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-1 -ml-2">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      <div>
        <h1 className="text-xl font-heading font-bold flex items-center gap-2">
          <Wallet className="h-5 w-5" /> Withdraw Agent Earnings
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">Minimum withdrawal: {formatPrice(MIN_WITHDRAWAL)}</p>
      </div>

      {/* Balance card */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Available Balance</p>
            <p className="text-3xl font-bold text-primary">{formatPrice(wallet.balance)}</p>
          </div>
          <Wallet className="h-8 w-8 text-primary/30" />
        </CardContent>
      </Card>

      {wallet.balance < MIN_WITHDRAWAL && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-700 text-sm">
            Your balance is below the minimum withdrawal of {formatPrice(MIN_WITHDRAWAL)}.
            Keep sharing your referral link to earn more!
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4" /> Bank Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Bank Name</Label>
            <Select value={bank} onValueChange={setBank}>
              <SelectTrigger><SelectValue placeholder="Select your bank" /></SelectTrigger>
              <SelectContent>
                {NIGERIAN_BANKS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Account Number</Label>
            <Input
              placeholder="10-digit NUBAN account number"
              value={accountNumber}
              onChange={e => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
              maxLength={10}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Account Name</Label>
            <Input
              placeholder="As it appears on your bank statement"
              value={accountName}
              onChange={e => setAccountName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Amount to Withdraw (₦)</Label>
            <Input
              type="number"
              placeholder={`Min ₦${(MIN_WITHDRAWAL / 100).toLocaleString()}`}
              value={amount}
              onChange={e => setAmount(e.target.value)}
              min={MIN_WITHDRAWAL / 100}
              max={wallet.balance / 100}
            />
            {amountKobo > wallet.balance && (
              <p className="text-xs text-red-500">Amount exceeds your available balance.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Button
        className="w-full h-12 bg-primary hover:bg-primary/90 text-white text-base"
        onClick={handleSubmit}
        disabled={!canSubmit || submitting}
      >
        {submitting
          ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting...</>
          : <>Request Withdrawal of {amount ? formatPrice(amountKobo) : "—"}</>}
      </Button>
    </main>
  )
}
