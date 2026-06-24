"use client"

import { AdminService , serverTimestamp } from "@/src/services"

import { useState } from "react"
import { useAuthStore } from "@/store/authStore"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Banknote, Info } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { addDoc } from "@/src/services"

export function WithdrawalForm({ amount }: { amount: number }) {
  const uid = useAuthStore((s) => s.user?.uid)
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({ bankName: "", accountNumber: "", accountName: "" })

  const WITHDRAWAL_FEE = 10000 // ₦100 in kobo
  const MIN_WITHDRAWAL = 100000 // ₦1,000 in kobo
  const netAmount = amount - WITHDRAWAL_FEE

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uid) return
    if (amount < MIN_WITHDRAWAL) {
      toast({ title: "Minimum Not Met", description: "You need at least ₦1,000 to withdraw.", variant: "destructive" })
      return
    }
    if (!formData.bankName || !formData.accountNumber || !formData.accountName) {
      toast({ title: "Missing Fields", description: "Please fill all bank details.", variant: "destructive" })
      return
    }

    setLoading(true)
    try {
      // Create withdrawal request in Firestore
      await AdminService.addDoc("withdrawals", {
        sellerId: uid,
        amount,
        fee: WITHDRAWAL_FEE,
        netAmount,
        bankName: formData.bankName,
        accountNumber: formData.accountNumber,
        accountName: formData.accountName,
        status: "pending",
        createdAt: serverTimestamp(),
      })

      toast({ title: "Withdrawal Initiated", description: "Funds will reach your account within 24 hours.", variant: "success" })
      setFormData({ bankName: "", accountNumber: "", accountName: "" })
    } catch (err: any) {
      console.error("Withdrawal error:", err)
      toast({ title: "Failed", description: err.message || "Could not process withdrawal.", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  if (amount <= 0) return <Alert><Info className="h-4 w-4" /><AlertDescription>No available balance to withdraw.</AlertDescription></Alert>

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2"><Label>Bank Name</Label><Input value={formData.bankName} onChange={e => setFormData({...formData, bankName: e.target.value})} placeholder="e.g., GTBank, Access, Opay" /></div>
      <div className="space-y-2"><Label>Account Number</Label><Input value={formData.accountNumber} onChange={e => setFormData({...formData, accountNumber: e.target.value.replace(/\D/g, "")})} placeholder="10 digits" maxLength={10} /></div>
      <div className="space-y-2"><Label>Account Name</Label><Input value={formData.accountName} onChange={e => setFormData({...formData, accountName: e.target.value})} placeholder="Auto-verified name" /></div>
      
      <div className="p-3 bg-muted/50 rounded text-sm space-y-1">
        <div className="flex justify-between"><span>Withdrawal Amount</span><span>{formatPrice(amount)}</span></div>
        <div className="flex justify-between text-destructive"><span>Processing Fee</span><span>- {formatPrice(WITHDRAWAL_FEE)}</span></div>
        <div className="flex justify-between font-bold pt-2 border-t"><span>You'll Receive</span><span className="text-accent">{formatPrice(netAmount)}</span></div>
      </div>

      <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-white" disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Banknote className="h-4 w-4 mr-2" />}
        Withdraw {formatPrice(netAmount)}
      </Button>
    </form>
  )
}
