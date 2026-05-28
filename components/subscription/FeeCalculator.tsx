"use client"

import {AdminService} from "@/src/services"

import { useState, useMemo, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatPrice } from "@/lib/utils"

const DEFAULTS = {
  commissionSale: 0.015,
  commissionRental: 0.04,
  insuranceRate: 0.005,
  withdrawalFee: 100,
}

export function FeeCalculator() {
  const [price, setPrice] = useState("100000")
  const [type, setType] = useState<"sale" | "rental">("sale")
  const [rates, setRates] = useState(DEFAULTS)

  useEffect(() => {
    const timeout = setTimeout(() => {}, 3000)
    AdminService.getDoc("platformSettings", "fees").then(docs => {
      if (snap) setRates({ ...DEFAULTS, ...snap })
    }).catch(() => {}).finally(() => clearTimeout(timeout))
  }, [])

  const calc = useMemo(() => {
    const amount = Number(price) || 0
    const commissionRate = type === "rental" ? rates.commissionRental : rates.commissionSale
    const commission = amount * commissionRate
    const insurance = amount * rates.insuranceRate
    const netPayout = amount - commission - insurance
    const withdrawalFee = netPayout > 0 ? rates.withdrawalFee : 0
    const finalNet = netPayout - withdrawalFee
    return { amount, commissionRate, commission, insurance, withdrawalFee, finalNet }
  }, [price, type, rates])

  return (
    <Card className="max-w-2xl mx-auto bg-secondary/5 border-secondary/20">
      <CardHeader><CardTitle className="text-xl font-heading text-center">Net Earnings Calculator</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Item Price (₦)</Label>
            <Input type="number" value={price} onChange={e => setPrice(e.target.value)} className="bg-background" />
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
          <div className="flex justify-between"><span className="text-muted-foreground">Gross Price</span><span className="font-medium">{formatPrice(calc.amount * 100)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Commission ({(calc.commissionRate * 100).toFixed(1)}%)</span><span className="font-medium text-destructive">-{formatPrice(calc.commission * 100)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Insurance Pool ({(rates.insuranceRate * 100).toFixed(1)}%)</span><span className="font-medium text-destructive">-{formatPrice(calc.insurance * 100)}</span></div>
          <div className="flex justify-between border-b pb-2"><span className="text-muted-foreground">Withdrawal Fee</span><span className="font-medium text-destructive">-{formatPrice(calc.withdrawalFee * 100)}</span></div>
          <div className="flex justify-between text-lg font-bold pt-2">
            <span>Your Net Payout</span>
            <span className="text-accent">{formatPrice(calc.finalNet * 100)}</span>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2">*Delivery fees (₦2,500 est.) are paid by buyer separately.</p>
        </div>
      </CardContent>
    </Card>
  )
}
