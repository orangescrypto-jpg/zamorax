"use client"
// components/shared/FeeBreakdown.tsx
// Shows the seller how much they'll receive after all deductions.
// Reads from config/fees via useFeeSettings() — values always match what admin set.
// Insurance pool is labeled clearly as the arbitration/dispute fund (AdminService).

import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { formatPrice } from "@/lib/utils"
import { useFeeSettings } from "@/hooks/useFeeSettings"
import { calculateFees } from "@/src/services/feeSettings"

interface FeeBreakdownProps {
  amount: number // In Kobo
  transactionType: "sale" | "rental"
}

export function FeeBreakdown({ amount, transactionType }: FeeBreakdownProps) {
  const { fees, loading } = useFeeSettings()

  if (loading) {
    return (
      <Card className="bg-muted/30 border-border animate-pulse">
        <CardContent className="p-4 h-40" />
      </Card>
    )
  }

  const breakdown = calculateFees(amount, transactionType, fees)

  return (
    <Card className="bg-muted/30 border-border">
      <CardContent className="p-4 space-y-3 text-sm">
        <h4 className="font-semibold text-foreground">Fee Breakdown (Seller)</h4>

        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Item Price</span>
            <span className="font-medium">{formatPrice(breakdown.itemPriceKobo)}</span>
          </div>
          <div className="flex justify-between text-destructive">
            <span>
              Platform Commission ({breakdown.commissionPct.toFixed(1)}%)
            </span>
            <span>- {formatPrice(breakdown.commissionKobo)}</span>
          </div>
          <div className="flex justify-between text-destructive">
            <span>
              Arbitration Pool ({breakdown.insurancePct.toFixed(1)}%)
            </span>
            <span>- {formatPrice(breakdown.insuranceKobo)}</span>
          </div>
          <div className="flex justify-between text-destructive">
            <span>Withdrawal Fee (Fixed)</span>
            <span>- {formatPrice(breakdown.withdrawalFeeKobo)}</span>
          </div>
        </div>

        <Separator />

        <div className="flex justify-between pt-1">
          <span className="font-bold text-accent">Seller Net Payout</span>
          <span className="font-bold text-accent">
            {formatPrice(breakdown.sellerPayoutKobo)}
          </span>
        </div>

        <p className="text-[10px] text-muted-foreground pt-1">
          The Arbitration Pool funds buyer–seller dispute resolution. It is held
          separately from platform revenue and released to the winning party by
          Zamorax AdminService on dispute close.
        </p>
      </CardContent>
    </Card>
  )
}
