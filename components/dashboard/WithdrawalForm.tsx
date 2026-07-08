"use client"

import { useEffect, useState } from "react"
import { useAuthStore } from "@/store/authStore"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Loader2, Banknote, Info, CheckCircle2, XCircle } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { useFeeSettings } from "@/hooks/useFeeSettings"

interface Bank {
  name: string
  code: string
}

export function WithdrawalForm({ amount }: { amount: number }) {
  const uid = useAuthStore((s) => s.user?.uid)
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const [banks, setBanks] = useState<Bank[]>([])
  const [banksLoading, setBanksLoading] = useState(true)
  const [banksError, setBanksError] = useState(false)

  const [bankCode, setBankCode] = useState("")
  const [bankName, setBankName] = useState("")
  const [accountNumber, setAccountNumber] = useState("")
  const [accountName, setAccountName] = useState("")
  const [resolving, setResolving] = useState(false)
  const [resolved, setResolved] = useState(false)
  const [resolveError, setResolveError] = useState("")

  // FIX: this was hardcoded to ₦100 (10000 kobo), completely ignoring the
  // admin's actual "Withdrawal Fee (Fixed)" setting on /admin/fees — which
  // is where the Fee Breakdown card on this same page correctly reads ₦0
  // from. Wiring this to the same useFeeSettings() source everything else
  // uses means this form and the Fee Breakdown card can never show two
  // different numbers for the same fee again, and the server-side deduction
  // (POST /api/seller/withdraw) now agrees with what's shown here too.
  const { fees } = useFeeSettings()
  const WITHDRAWAL_FEE = fees.withdrawalFee
  const MIN_WITHDRAWAL = 100000 // ₦1,000 in kobo
  const netAmount = amount - WITHDRAWAL_FEE

  // Load the bank list once on mount — used to populate the dropdown and to
  // get the bank_code Paystack's API needs (a free-text bank name isn't enough).
  useEffect(() => {
    fetch("/api/payment/banks")
      .then(res => res.json())
      .then(data => {
        if (data.banks) setBanks(data.banks)
        else setBanksError(true)
      })
      .catch(() => setBanksError(true))
      .finally(() => setBanksLoading(false))
  }, [])

  // Re-verify the account name whenever bank or account number changes and
  // the account number looks complete. This catches typos before submission
  // — e.g. the wrong account number for the right bank — same protection
  // whether the platform is in manual or Paystack payout mode.
  useEffect(() => {
    setResolved(false)
    setResolveError("")
    setAccountName("")

    if (!bankCode || accountNumber.length !== 10) return

    let cancelled = false
    setResolving(true)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/payment/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider: "paystack", accountNumber, bankCode }),
        })
        const data = await res.json()
        if (cancelled) return
        if (!res.ok || !data.accountName) {
          setResolveError(data.error || "Could not verify this account. Double-check the number and bank.")
          return
        }
        setAccountName(data.accountName)
        setResolved(true)
      } catch {
        if (!cancelled) setResolveError("Could not verify account — check your connection and try again.")
      } finally {
        if (!cancelled) setResolving(false)
      }
    }, 500) // debounce so we don't hit the API on every keystroke

    return () => { cancelled = true; clearTimeout(timer) }
  }, [bankCode, accountNumber])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uid) return

    if (amount < MIN_WITHDRAWAL) {
      toast({ title: "Minimum Not Met", description: "You need at least ₦1,000 to withdraw.", variant: "destructive" })
      return
    }
    if (!bankCode || accountNumber.length !== 10 || !accountName) {
      toast({ title: "Missing Fields", description: "Select your bank, enter a valid account number, and wait for name verification.", variant: "destructive" })
      return
    }
    if (!resolved) {
      toast({ title: "Account Not Verified", description: "We couldn't confirm this account belongs to you. Please check the details.", variant: "destructive" })
      return
    }

    setLoading(true)
    try {
      // Goes through the real withdraw API — validates balance, deducts the
      // wallet, creates the withdrawal record, and notifies you. (Previously
      // this form wrote straight to the withdrawals table and skipped all
      // of that — fixed now.)
      const res = await fetch("/api/seller/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountKobo: amount,
          bankName,
          bankCode,
          accountNumber,
          accountName,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Could not process withdrawal.")

      toast({ title: "Withdrawal Requested", description: "We'll notify you once it's paid out.", variant: "success" })
      setBankCode("")
      setBankName("")
      setAccountNumber("")
      setAccountName("")
      setResolved(false)
    } catch (err: any) {
      toast({ title: "Failed", description: err.message || "Could not process withdrawal.", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  if (amount <= 0) return <Alert><Info className="h-4 w-4" /><AlertDescription>No available balance to withdraw.</AlertDescription></Alert>

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Bank</Label>
        {banksError ? (
          <Alert variant="destructive"><AlertDescription>Could not load bank list. Please try again shortly.</AlertDescription></Alert>
        ) : (
          <Select
            value={bankCode}
            onValueChange={(code) => {
              setBankCode(code)
              setBankName(banks.find(b => b.code === code)?.name ?? "")
            }}
            disabled={banksLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder={banksLoading ? "Loading banks..." : "Select your bank"} />
            </SelectTrigger>
            <SelectContent>
              {banks.map(b => (
                <SelectItem key={b.code} value={b.code}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="space-y-2">
        <Label>Account Number</Label>
        <Input
          value={accountNumber}
          onChange={e => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
          placeholder="10 digits"
          maxLength={10}
          inputMode="numeric"
        />
      </div>

      <div className="space-y-2">
        <Label>Account Name</Label>
        <div className="relative">
          <Input value={accountName} placeholder="Auto-verified from bank + account number" readOnly disabled />
          {resolving && <Loader2 className="h-4 w-4 animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />}
          {resolved && !resolving && <CheckCircle2 className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600" />}
          {resolveError && !resolving && <XCircle className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 text-destructive" />}
        </div>
        {resolveError && <p className="text-xs text-destructive">{resolveError}</p>}
        {resolved && <p className="text-xs text-emerald-600">Account verified ✓ — this is who will receive the payout.</p>}
      </div>

      <div className="p-3 bg-muted/50 rounded text-sm space-y-1">
        <div className="flex justify-between"><span>Withdrawal Amount</span><span>{formatPrice(amount)}</span></div>
        <div className="flex justify-between text-destructive"><span>Processing Fee</span><span>- {formatPrice(WITHDRAWAL_FEE)}</span></div>
        <div className="flex justify-between font-bold pt-2 border-t"><span>You'll Receive</span><span className="text-accent">{formatPrice(netAmount)}</span></div>
      </div>

      <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-white" disabled={loading || !resolved}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Banknote className="h-4 w-4 mr-2" />}
        Withdraw {formatPrice(netAmount)}
      </Button>
    </form>
  )
}
