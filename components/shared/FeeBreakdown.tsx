"use client"

import {AdminService} from "@/src/services"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { formatPrice } from "@/lib/utils"

interface FeeBreakdownProps {
  amount: number // In Kobo
  transactionType: "sale" | "rental"
}

interface PlatformRates {
  commissionSale: number
  commissionRental: number
  insuranceRate: number
  withdrawalFee: number
}

const DEFAULTS: PlatformRates = {
  commissionSale: 0.015,    // 1.5%
  commissionRental: 0.04,   // 4.0%
  insuranceRate: 0.005,     // 0.5%
  withdrawalFee: 100,       // ₦100 fixed
}

export function FeeBreakdown({ amount, transactionType }: FeeBreakdownProps) {
  const [rates, setRates] = useState<PlatformRates>(DEFAULTS)

  useEffect(() => {
    AdminService.getDoc("platformSettings", "fees").then(docs => {
      if (snap.exists()) setRates({ ...DEFAULTS, ...snap.data() as PlatformRates })
    }).catch(() => {}) // fallback to defaults silently
  }, [])

  const amountNaira = amount / 100
  const commissionRate = transactionType === "rental" ? rates.commissionRental : rates.commissionSale
  const commission = amountNaira * commissionRate
  const insurance = amountNaira * rates.insuranceRate
  const totalDeductions = commission + insurance + rates.withdrawalFee
  const sellerPayout = amountNaira - totalDeductions

  const commissionLabel = transactionType === "rental"
    ? `${(rates.commissionRental * 100).toFixed(1)}%`
    : `${(rates.commissionSale * 100).toFixed(1)}%`

  return (
    <Card className="bg-muted/30 border-border">
      <CardContent className="p-4 space-y-3 text-sm">
        <h4 className="font-semibold text-foreground">Fee Breakdown</h4>

        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Item Price</span>
            <span className="font-medium">{formatPrice(amount)}</span>
          </div>
          <div className="flex justify-between text-destructive">
            <span>Commission ({commissionLabel})</span>
            <span>- {formatPrice(commission * 100)}</span>
          </div>
          <div className="flex justify-between text-destructive">
            <span>Insurance Pool ({(rates.insuranceRate * 100).toFixed(1)}%)</span>
            <span>- {formatPrice(insurance * 100)}</span>
          </div>
          <div className="flex justify-between text-destructive">
            <span>Withdrawal Fee (Fixed)</span>
            <span>- {formatPrice(rates.withdrawalFee * 100)}</span>
          </div>
        </div>

        <Separator />

        <div className="flex justify-between pt-1">
          <span className="font-bold text-accent">Seller Net Payout</span>
          <span className="font-bold text-accent">{formatPrice(sellerPayout * 100)}</span>
        </div>
      </CardContent>
    </Card>
  )
}
