"use client"

import { Shield, AlertTriangle, CheckCircle, Clock, Info } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { formatPrice } from "@/lib/utils"
import { cn } from "@/lib/utils"

type DepositStatus = "held" | "partially_refunded" | "refunded" | "forfeited"

interface RentalDepositCardProps {
  depositAmount: number
  rentalPrice: number
  depositStatus: DepositStatus
  rentalDays: number
  rentalStartDate: Date
  rentalEndDate: Date
  deductionAmount?: number
  deductionReason?: string
  isBuyer?: boolean
}

const STATUS_CONFIG: Record<DepositStatus, {
  label: string
  color: string
  icon: React.ReactNode
  description: string
}> = {
  held: {
    label: "Held in Escrow",
    color: "text-amber-600 bg-amber-50 border-amber-200",
    icon: <Shield className="h-4 w-4 text-amber-600" />,
    description: "Your deposit is secured by Zamorax and will be refunded after return inspection.",
  },
  partially_refunded: {
    label: "Partially Refunded",
    color: "text-blue-600 bg-blue-50 border-blue-200",
    icon: <AlertTriangle className="h-4 w-4 text-blue-600" />,
    description: "Part of your deposit was deducted for damages. The remainder has been refunded.",
  },
  refunded: {
    label: "Fully Refunded",
    color: "text-green-600 bg-green-50 border-green-200",
    icon: <CheckCircle className="h-4 w-4 text-green-600" />,
    description: "Your full deposit has been returned. Thanks for taking care of the item!",
  },
  forfeited: {
    label: "Forfeited",
    color: "text-destructive bg-destructive/10 border-destructive/20",
    icon: <AlertTriangle className="h-4 w-4 text-destructive" />,
    description: "Your deposit was forfeited due to damage or non-return.",
  },
}

export function RentalDepositCard({
  depositAmount,
  rentalPrice,
  depositStatus,
  rentalDays,
  rentalStartDate,
  rentalEndDate,
  deductionAmount,
  deductionReason,
  isBuyer = true,
}: RentalDepositCardProps) {
  const config = STATUS_CONFIG[depositStatus]
  const totalRentalCost = rentalPrice * rentalDays
  const refundAmount = deductionAmount ? depositAmount - deductionAmount : depositAmount

  const fmt = (d: Date) => d.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })

  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            Damage Deposit
          </CardTitle>
          <Badge className={cn("text-xs border gap-1", config.color)}>
            {config.icon} {config.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Deposit breakdown */}
        <div className="rounded-lg bg-muted/40 p-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Rental ({rentalDays} days)</span>
            <span className="font-medium">{formatPrice(totalRentalCost)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Security Deposit</span>
            <span className="font-medium text-amber-600">{formatPrice(depositAmount)}</span>
          </div>
          <div className="border-t pt-2 flex justify-between font-semibold">
            <span>Total Paid</span>
            <span>{formatPrice(totalRentalCost + depositAmount)}</span>
          </div>
        </div>

        {/* Rental period */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <span>{fmt(rentalStartDate)} → {fmt(rentalEndDate)}</span>
        </div>

        {/* Deduction detail */}
        {deductionAmount && deductionAmount > 0 && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-1 text-sm">
            <p className="font-medium text-destructive text-xs">Damage Deduction</p>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Deducted</span>
              <span className="text-destructive font-medium">-{formatPrice(deductionAmount)}</span>
            </div>
            {deductionReason && (
              <p className="text-xs text-muted-foreground">{deductionReason}</p>
            )}
            <div className="flex justify-between text-xs font-semibold border-t pt-1">
              <span>Refunded</span>
              <span className="text-green-600">{formatPrice(refundAmount)}</span>
            </div>
          </div>
        )}

        {/* Status message */}
        <Alert className={cn("border text-xs py-2", config.color)}>
          <AlertDescription className="flex items-start gap-2">
            {config.icon}
            <span>{isBuyer ? config.description : config.description.replace("Your", "Buyer's").replace("you", "them")}</span>
          </AlertDescription>
        </Alert>

        {/* Policy note */}
        {depositStatus === "held" && (
          <div className="flex gap-2 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>Deposit is refunded within 24hrs of successful return inspection. Disputes must be raised within 48hrs of return.</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
