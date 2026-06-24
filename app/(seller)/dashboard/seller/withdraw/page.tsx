"use client"

import {AdminService} from "@/src/services"

import { useEffect, useState } from "react"
import { useAuthStore } from "@/store/authStore"
import { WithdrawalForm } from "@/components/dashboard/WithdrawalForm"
import { formatPrice } from "@/lib/utils"
import { Wallet, Loader2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

export default function WithdrawPage() {
  const uid = useAuthStore(s => s.user?.uid)
  const [balance, setBalance] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!uid) return
    AdminService.getDoc("sellerWallets", uid).then(docs => {
      if (docs) setBalance(docs.balance || 0)
      setLoading(false)
    })
  }, [uid])

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>

  return (
    <main className="container max-w-md py-6 pb-24 space-y-5">
      <h1 className="text-xl font-heading font-bold flex items-center gap-2"><Wallet className="h-5 w-5" /> Withdraw Earnings</h1>

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-5">
          <p className="text-xs text-muted-foreground">Available Balance</p>
          <p className="text-3xl font-bold text-primary">{formatPrice(balance)}</p>
        </CardContent>
      </Card>

      <WithdrawalForm amount={balance} />
    </main>
  )
}
