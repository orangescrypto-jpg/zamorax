"use client"

import { AdminService, query, limit, orderBy, onSnapshot, where } from "@/src/services"
// app/(seller)/dashboard/seller/wallet/page.tsx
// Seller wallet — shows net amount first, expandable breakdown per transaction.
// Reads withdrawal fee live from useFeeSettings() so it always reflects admin setting.

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useToast } from "@/components/ui/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { formatPrice } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import { useFeeSettings } from "@/hooks/useFeeSettings"
import { usePlatformSettings } from "@/hooks/usePlatformSettings"
import {
  Wallet, ArrowDownRight, ArrowUpRight, Clock, CheckCircle,
  Loader2, AlertTriangle, Banknote, Shield, ChevronDown, ChevronUp, Info,
} from "lucide-react"

const NIGERIAN_BANKS = [
  "Access Bank", "GTBank", "First Bank", "UBA", "Zenith Bank",
  "Stanbic IBTC", "Sterling Bank", "Union Bank", "Wema Bank",
  "Polaris Bank", "Keystone Bank", "Fidelity Bank", "FCMB", "Opay", "Palmpay",
]

type TxType = "credit" | "debit" | "payout" | "refund"
const TX_CONFIG: Record<TxType, { label: string; color: string; sign: string }> = {
  credit: { label: "Order Payment",  color: "text-emerald-600", sign: "+" },
  debit:  { label: "Platform Fee",   color: "text-red-500",     sign: "-" },
  payout: { label: "Payout",         color: "text-blue-600",    sign: "-" },
  refund: { label: "Refund Issued",  color: "text-orange-500",  sign: "-" },
}

// ── Expandable transaction row ────────────────────────────────────────────────

function TransactionRow({ tx }: { tx: any }) {
  const [expanded, setExpanded] = useState(false)
  const cfg = TX_CONFIG[tx.type as TxType] || TX_CONFIG.credit

  // Only show breakdown for credit (order payment) transactions
  const hasBreakdown = tx.type === "credit" && (tx.grossAmount || tx.platformFee || tx.arbitrationFee)

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <div
        className="flex items-center gap-3 p-3.5 cursor-pointer"
        onClick={() => hasBreakdown && setExpanded(e => !e)}
      >
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
          tx.type === "credit" ? "bg-emerald-100" : "bg-red-100"
        }`}>
          {tx.type === "credit"
            ? <ArrowDownRight className="h-4 w-4 text-emerald-600" />
            : <ArrowUpRight className="h-4 w-4 text-red-500" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{cfg.label}</p>
          <p className="text-xs text-muted-foreground truncate">
            {tx.description || tx.orderId || ""}
          </p>
        </div>
        <div className="text-right shrink-0 flex items-center gap-2">
          <div>
            <p className={`text-sm font-bold ${cfg.color}`}>
              {cfg.sign}{formatPrice(tx.amount)}
            </p>
            <p className="text-xs text-muted-foreground">
              {tx.createdAt?.toDate
                ? formatDistanceToNow(tx.createdAt.toDate(), { addSuffix: true })
                : ""}
            </p>
          </div>
          {hasBreakdown && (
            expanded
              ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
              : <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Expandable breakdown */}
      {expanded && hasBreakdown && (
        <div className="border-t bg-muted/30 px-4 py-3 space-y-2 text-xs">
          <p className="font-semibold text-muted-foreground uppercase tracking-wide text-[10px]">
            Fee Breakdown
          </p>
          {tx.grossAmount && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Listing price</span>
              <span>{formatPrice(tx.grossAmount)}</span>
            </div>
          )}
          {tx.platformFee > 0 && (
            <div className="flex justify-between text-red-500">
              <span>Platform commission</span>
              <span>-{formatPrice(tx.platformFee)}</span>
            </div>
          )}
          {tx.arbitrationFee > 0 && (
            <div className="flex justify-between text-red-500">
              <span>Arbitration pool</span>
              <span>-{formatPrice(tx.arbitrationFee)}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between font-semibold">
            <span>Net credited to wallet</span>
            <span className="text-emerald-600">{formatPrice(tx.amount)}</span>
          </div>
          <div className="flex items-start gap-1.5 pt-1">
            <Info className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-[10px] text-muted-foreground">
              The arbitration pool funds dispute resolution. It is held separately and returned if no dispute is raised.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SellerWalletPage() {
  const { user }     = useAuth()
  const { toast }    = useToast()
  const { settings } = usePlatformSettings()
  const { fees }     = useFeeSettings()

  const [wallet,       setWallet]       = useState<any>(null)
  const [transactions, setTransactions] = useState<any[]>([])
  const [payouts,      setPayouts]      = useState<any[]>([])
  const [loading,      setLoading]      = useState(true)
  const [payoutOpen,   setPayoutOpen]   = useState(false)
  const [submitting,   setSubmitting]   = useState(false)

  // Payout form state
  const [amount,        setAmount]        = useState("")
  const [bankName,      setBankName]      = useState("")
  const [accountNumber, setAccountNumber] = useState("")
  const [accountName,   setAccountName]   = useState("")

  useEffect(() => {
    if (!user?.uid) return

    const walletUnsub = AdminService.subscribeToDoc("seller_wallets", user.uid, docs => {
      setWallet(docs !== null ? docs : { balance: 0, pendingBalance: 0, totalEarned: 0 })
      setLoading(false)
    })

    const txQ = AdminService._ref_("wallet_transactions", [
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(30),
    ])
    const txUnsub = onSnapshot(txQ, snap => {
      setTransactions(snap.docs.map((d: any) => ({ id: d.id, ...d.data() })))
    })

    const poQ = AdminService._ref_("withdrawals", [
      where("sellerId", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(10),
    ])
    const poUnsub = onSnapshot(poQ, snap => {
      setPayouts(snap.docs.map((d: any) => ({ id: d.id, ...d.data() })))
    })

    return () => { walletUnsub(); txUnsub(); poUnsub() }
  }, [user?.uid])

  const availableBalance = wallet?.balance ?? 0
  const pendingBalance   = (wallet?.pendingBalance ?? wallet?.pending_balance) || 0
  const totalEarned      = (wallet?.totalEarned ?? wallet?.total_earned) || 0

  const MIN_PAYOUT = 100000  // ₦1,000 kobo
  const MAX_PAYOUT = availableBalance

  // Withdrawal fee read live from admin settings
  const withdrawalFeeKobo = fees.withdrawalFee
  const withdrawalFeeNaira = withdrawalFeeKobo / 100

  const handlePayout = async () => {
    if (!user?.uid) return
    const amountKobo = Math.round(parseFloat(amount) * 100)

    if (!bankName) {
      toast({ title: "Select a bank", variant: "destructive" }); return
    }
    if (!accountNumber || accountNumber.length !== 10) {
      toast({ title: "Enter a valid 10-digit account number", variant: "destructive" }); return
    }
    if (!accountName.trim()) {
      toast({ title: "Enter account name", variant: "destructive" }); return
    }
    if (amountKobo < MIN_PAYOUT) {
      toast({ title: `Minimum payout is ${formatPrice(MIN_PAYOUT)}`, variant: "destructive" }); return
    }
    if (amountKobo > MAX_PAYOUT) {
      toast({ title: "Insufficient wallet balance", variant: "destructive" }); return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/seller/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountKobo,
          bankName,
          accountNumber,
          accountName: accountName.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Payout failed")

      toast({
        title: "Withdrawal requested! 💸",
        description: `We'll process your ₦${(amountKobo / 100).toLocaleString()} transfer within ${settings.payoutProcessingHours} hours.`,
        variant: "success",
      })
      setPayoutOpen(false)
      setAmount(""); setBankName(""); setAccountNumber(""); setAccountName("")
    } catch (e: any) {
      toast({ title: "Payout failed", description: e.message, variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-7 w-7 animate-spin text-primary" />
    </div>
  )

  const statusColors: Record<string, string> = {
    pending:    "bg-amber-100 text-amber-800",
    processing: "bg-blue-100 text-blue-800",
    completed:  "bg-emerald-100 text-emerald-800",
    failed:     "bg-red-100 text-red-800",
  }

  return (
    <div className="container max-w-3xl py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <Wallet className="h-6 w-6 text-primary" /> Seller Wallet
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Your earnings, transactions, and payouts.</p>
      </div>

      {/* Balance cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-2 border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium">Available</p>
            <p className="text-2xl font-bold text-primary mt-1">{formatPrice(availableBalance)}</p>
            <Button
              size="sm"
              className="mt-3 w-full bg-primary text-white hover:bg-primary/90 h-8 text-xs"
              onClick={() => setPayoutOpen(true)}
              disabled={availableBalance < MIN_PAYOUT}
            >
              <ArrowUpRight className="h-3.5 w-3.5 mr-1" /> Withdraw
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium">Pending</p>
            <p className="text-xl font-bold mt-1">{formatPrice(pendingBalance)}</p>
            <p className="text-xs text-muted-foreground mt-1">In escrow</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium">Total Earned</p>
            <p className="text-xl font-bold mt-1">{formatPrice(totalEarned)}</p>
            <p className="text-xs text-muted-foreground mt-1">All time</p>
          </CardContent>
        </Card>
      </div>

      {/* Fee info banner */}
      <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
        <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700">
          Platform fees are deducted before crediting your wallet. Tap any "Order Payment" transaction to see the full breakdown.
          {withdrawalFeeKobo > 0 && (
            <> A <strong>₦{withdrawalFeeNaira.toLocaleString()} withdrawal fee</strong> applies per payout request.</>
          )}
        </p>
      </div>

      {/* Verified seller instant payout notice */}
      {user?.ninVerified && settings.instantPayoutEnabled && (
        <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <Shield className="h-4 w-4 text-emerald-600 shrink-0" />
          <p className="text-sm text-emerald-800">
            <span className="font-semibold">Instant Payouts enabled</span> — your NIN is verified, so withdrawals land in your account within minutes.
          </p>
        </div>
      )}
      {!settings.instantPayoutEnabled && (
        <div className="flex items-center gap-2.5 bg-muted border rounded-xl px-4 py-3">
          <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
          <p className="text-sm text-muted-foreground">
            Payouts are processed within <span className="font-semibold">{settings.payoutProcessingHours} hours</span> of request.
          </p>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="transactions">
        <TabsList>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="payouts">Payout History</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="mt-4 space-y-2">
          {transactions.length === 0 ? (
            <div className="border border-dashed rounded-xl py-12 text-center text-muted-foreground text-sm">
              No transactions yet.
            </div>
          ) : transactions.map(tx => (
            <TransactionRow key={tx.id} tx={tx} />
          ))}
        </TabsContent>

        <TabsContent value="payouts" className="mt-4 space-y-2">
          {payouts.length === 0 ? (
            <div className="border border-dashed rounded-xl py-12 text-center text-muted-foreground text-sm">
              No payouts yet.
            </div>
          ) : payouts.map(p => (
            <div key={p.id} className="flex items-center gap-3 p-3.5 border border-border rounded-xl">
              <Banknote className="h-5 w-5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{p.bankName ?? p.bank_name} · {p.accountNumber ?? p.account_number}</p>
                <p className="text-xs text-muted-foreground">{p.accountName ?? p.account_name}</p>
              </div>
              <div className="text-right shrink-0 space-y-1">
                <p className="text-sm font-bold">{formatPrice(p.amount ?? p.amountKobo ?? 0)}</p>
                <Badge className={`text-[10px] ${statusColors[p.status] || "bg-gray-100"}`}>
                  {p.status === "completed" && <CheckCircle className="h-3 w-3 mr-0.5" />}
                  {p.status === "pending"   && <Clock className="h-3 w-3 mr-0.5" />}
                  {p.status}
                </Badge>
              </div>
            </div>
          ))}
        </TabsContent>
      </Tabs>

      {/* Payout Dialog */}
      <Dialog open={payoutOpen} onOpenChange={setPayoutOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpRight className="h-4 w-4 text-primary" /> Withdraw Funds
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="bg-muted/50 rounded-lg px-4 py-3 flex justify-between items-center">
              <p className="text-sm text-muted-foreground">Available balance</p>
              <p className="font-bold text-primary">{formatPrice(availableBalance)}</p>
            </div>

            {/* Withdrawal fee notice — live from admin */}
            {withdrawalFeeKobo > 0 && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                <Info className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700">
                  A <strong>₦{withdrawalFeeNaira.toLocaleString()} withdrawal fee</strong> will be deducted from your payout amount.
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Amount (₦)</Label>
              <Input
                type="number"
                placeholder={`Min ₦${(MIN_PAYOUT / 100).toLocaleString()}`}
                value={amount}
                onChange={e => setAmount(e.target.value)}
              />
              {amount && withdrawalFeeKobo > 0 && (
                <p className="text-xs text-muted-foreground">
                  You will receive <strong>{formatPrice(Math.max(0, Math.round(parseFloat(amount) * 100) - withdrawalFeeKobo))}</strong> after the withdrawal fee.
                </p>
              )}
              <button
                className="text-xs text-primary hover:underline"
                onClick={() => setAmount(String(availableBalance / 100))}
              >
                Withdraw all
              </button>
            </div>

            <div className="space-y-1.5">
              <Label>Bank</Label>
              <select
                value={bankName}
                onChange={e => setBankName(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select bank</option>
                {NIGERIAN_BANKS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>Account Number</Label>
              <Input
                placeholder="10-digit account number"
                value={accountNumber}
                onChange={e => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
                maxLength={10}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Account Name</Label>
              <Input
                placeholder="As on your bank account"
                value={accountName}
                onChange={e => setAccountName(e.target.value)}
              />
            </div>

            {!user?.ninVerified && (
              <div className="flex gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">
                  Verify your NIN to unlock <strong>instant payouts</strong>. Unverified sellers are processed within 24 hours.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPayoutOpen(false)}>Cancel</Button>
            <Button
              className="bg-primary text-white hover:bg-primary/90"
              onClick={handlePayout}
              disabled={submitting}
            >
              {submitting
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <><ArrowUpRight className="h-3.5 w-3.5 mr-1.5" /> Withdraw</>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
