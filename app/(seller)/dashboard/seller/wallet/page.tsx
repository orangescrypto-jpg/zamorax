"use client"

import {AdminService, query, limit, orderBy, onSnapshot, where} from "@/src/services"
// app/(seller)/dashboard/seller/wallet/page.tsx

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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { formatPrice } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"

import {
  Wallet, ArrowDownRight, ArrowUpRight, Clock, CheckCircle,
  Loader2, AlertTriangle, Banknote, Shield } from "lucide-react"

const NIGERIAN_BANKS = [
  "Access Bank", "GTBank", "First Bank", "UBA", "Zenith Bank",
  "Stanbic IBTC", "Sterling Bank", "Union Bank", "Wema Bank",
  "Polaris Bank", "Keystone Bank", "Fidelity Bank", "FCMB", "Opay", "Palmpay",
]

type TxType = "credit" | "debit" | "payout" | "refund"
const TX_CONFIG: Record<TxType, { label: string; color: string; sign: string }> = {
  credit:  { label: "Order Payment",  color: "text-emerald-600", sign: "+" },
  debit:   { label: "Platform Fee",   color: "text-red-500",     sign: "-" },
  payout:  { label: "Payout",         color: "text-blue-600",    sign: "-" },
  refund:  { label: "Refund Issued",  color: "text-orange-500",  sign: "-" } }

export default function SellerWalletPage() {
  const { user } = useAuth()
  const { toast } = useToast()

  const [wallet, setWallet]           = useState<any>(null)
  const [transactions, setTransactions] = useState<any[]>([])
  const [payouts, setPayouts]         = useState<any[]>([])
  const [loading, setLoading]         = useState(true)
  const [payoutOpen, setPayoutOpen]   = useState(false)
  const [submitting, setSubmitting]   = useState(false)

  // Payout form state
  const [amount, setAmount]           = useState("")
  const [bankName, setBankName]       = useState("")
  const [accountNumber, setAccountNumber] = useState("")
  const [accountName, setAccountName] = useState("")

  useEffect(() => {
    if (!user?.uid) return

    // Real-time wallet balance
    const walletUnsub = AdminService.subscribeToDoc("sellerWallets", user.uid, snap => {
      setWallet(snap.exists() ? snap.data() : { balance: 0, pendingBalance: 0, totalEarned: 0 })
      setLoading(false)
    })

    // Transactions
    const txQ = AdminService._ref_("walletTransactions", [where("sellerId", "==", user.uid]),
      orderBy("createdAt", "desc"),
      limit(30)
    )
    const txUnsub = onSnapshot(txQ, snap => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })

    // Payout history
    const poQ = AdminService._ref_("payoutRequests", [where("sellerId", "==", user.uid]),
      orderBy("createdAt", "desc"),
      limit(10)
    )
    const poUnsub = onSnapshot(poQ, snap => {
      setPayouts(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })

    return () => { walletUnsub(); txUnsub(); poUnsub() }
  }, [user?.uid])

  const availableBalance = wallet?.balance || 0
  const pendingBalance   = wallet?.pendingBalance || 0
  const totalEarned      = wallet?.totalEarned || 0

  const MIN_PAYOUT = 100000   // ₦1,000 in kobo
  const MAX_PAYOUT = availableBalance

  const handlePayout = async () => {
    if (!user?.uid) return
    const amountKobo = Math.round(parseFloat(amount) * 100)

    if (!bankName)                   { toast({ title: "Select a bank", variant: "destructive" }); return }
    if (!accountNumber || accountNumber.length !== 10) {
      toast({ title: "Enter a valid 10-digit account number", variant: "destructive" }); return
    }
    if (!accountName.trim())         { toast({ title: "Enter account name", variant: "destructive" }); return }
    if (amountKobo < MIN_PAYOUT)    { toast({ title: `Minimum payout is ${formatPrice(MIN_PAYOUT)}`, variant: "destructive" }); return }
    if (amountKobo > MAX_PAYOUT)    { toast({ title: "Insufficient wallet balance", variant: "destructive" }); return }

    setSubmitting(true)
    try {
      const res = await fetch("/api/payment/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sellerId: user.uid,
          amountKobo,
          bankName,
          accountNumber,
          accountName: accountName.trim() }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Payout failed")

      toast({
        title: "Payout request submitted!",
        description: data.instant
          ? "Your money is on the way — usually arrives within minutes."
          : "We'll process this within 24 hours.",
        variant: "success" })
      setPayoutOpen(false)
      setAmount(""); setBankName(""); setAccountNumber(""); setAccountName("")
    } catch (e: any) {
      toast({ title: "Payout failed", description: e.message, variant: "destructive" })
    } finally { setSubmitting(false) }
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
    failed:     "bg-red-100 text-red-800" }

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

      {/* Verified seller instant payout notice */}
      {user?.ninVerified && (
        <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <Shield className="h-4 w-4 text-emerald-600 shrink-0" />
          <p className="text-sm text-emerald-800">
            <span className="font-semibold">Instant Payouts enabled</span> — your NIN is verified, so withdrawals land in your account within minutes.
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
          ) : transactions.map(tx => {
            const cfg = TX_CONFIG[tx.type as TxType] || TX_CONFIG.credit
            return (
              <div key={tx.id} className="flex items-center gap-3 p-3.5 border border-border rounded-xl">
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
                  <p className="text-xs text-muted-foreground truncate">{tx.description || tx.orderId || ""}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-bold ${cfg.color}`}>
                    {cfg.sign}{formatPrice(tx.amount)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {tx.createdAt?.toDate ? formatDistanceToNow(tx.createdAt.toDate(), { addSuffix: true }) : ""}
                  </p>
                </div>
              </div>
            )
          })}
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
                <p className="text-sm font-medium">{p.bankName} · {p.accountNumber}</p>
                <p className="text-xs text-muted-foreground">{p.accountName}</p>
              </div>
              <div className="text-right shrink-0 space-y-1">
                <p className="text-sm font-bold">{formatPrice(p.amountKobo)}</p>
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

            <div className="space-y-1.5">
              <Label>Amount (₦)</Label>
              <Input
                type="number"
                placeholder={`Min ₦${(MIN_PAYOUT / 100).toLocaleString()}`}
                value={amount}
                onChange={e => setAmount(e.target.value)}
              />
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
