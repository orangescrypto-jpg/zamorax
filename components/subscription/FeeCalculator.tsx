"use client"
// components/subscription/FeeCalculator.tsx
// Seller net earnings calculator on the pricing page.
// Reads from config/fees via useFeeSettings() — always shows live admin rates.
// commissionSale is stored as whole number (e.g. 4 = 4%) — divided by 100 for math.

import { useState, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatPrice } from "@/lib/utils"
import { useFeeSettings } from "@/hooks/useFeeSettings"
import { calculateFees } from "@/src/services/feeSettings"

export function FeeCalculator() {
  const [price, setPrice] = useState("100000")
  const [type,  setType]  = useState<"sale" | "rental">("sale")
  const { fees, loading } = useFeeSettings()

  const breakdown = useMemo(() => {
    const itemPriceKobo = (Number(price) || 0) * 100  // input is in Naira, convert to kobo
    return calculateFees(itemPriceKobo, type, fees)
  }, [price, type, fees])

  return (
    <Card className="max-w-2xl mx-auto bg-secondary/5 border-secondary/20">
      <CardHeader>
        <CardTitle className="text-xl font-heading text-center">
          Net Earnings Calculator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">

        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Item Price (₦)</Label>
            <Input
              type="number"
              value={price}
              onChange={e => setPrice(e.target.value)}
              className="bg-background"
              placeholder="e.g. 100000"
            />
          </div>
          <div className="space-y-2">
            <Label>Transaction Type</Label>
            <Select value={type} onValueChange={v => setType(v as "sale" | "rental")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sale">Sale</SelectItem>
                <SelectItem value="rental">Rental (per transaction)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-3 text-sm border-t pt-4">
          {loading ? (
            <div className="animate-pulse space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-4 bg-muted rounded w-full" />
              ))}
            </div>
          ) : (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Gross Price</span>
                <span className="font-medium">{formatPrice(breakdown.itemPriceKobo)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Commission ({breakdown.commissionPct.toFixed(1)}%)
                </span>
                <span className="font-medium text-destructive">
                  -{formatPrice(breakdown.commissionKobo)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Arbitration Pool ({breakdown.insurancePct.toFixed(1)}%)
                </span>
                <span className="font-medium text-destructive">
                  -{formatPrice(breakdown.insuranceKobo)}
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Withdrawal Fee</span>
                <span className="font-medium text-destructive">
                  -{formatPrice(breakdown.withdrawalFeeKobo)}
                </span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-2">
                <span>Your Net Payout</span>
                <span className="text-accent">{formatPrice(breakdown.sellerPayoutKobo)}</span>
              </div>

              <p className="text-xs text-muted-foreground text-center mt-1">
                *Delivery fees paid by buyer separately.
              </p>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
