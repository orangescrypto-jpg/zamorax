"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { QrCode, ScanLine, CheckCircle } from "lucide-react"

interface QRCodeDisplayProps {
  orderId: string
  status: string
  scannedAt?: string
}

export function QRCodeDisplay({ orderId, status, scannedAt }: QRCodeDisplayProps) {
  // Dynamic QR image using a reliable public API (zero dependencies)
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=ZAMORAX_ORDER_${orderId}&bgcolor=ffffff&color=1a1a2e`

  const isCompleted = status === "completed"
  const isScanned = !!scannedAt

  return (
    <Card className="bg-white border-2 border-dashed">
      <CardContent className="p-6 flex flex-col items-center gap-4 text-center">
        <h4 className="font-semibold text-lg">Handover Verification</h4>
        <div className="relative">
          <img src={qrUrl} alt="Order QR" className="w-48 h-48 rounded-lg border bg-white" />
          {isScanned && (
            <div className="absolute inset-0 flex items-center justify-center bg-accent/20 backdrop-blur-sm rounded-lg">
              <CheckCircle className="h-16 w-16 text-accent drop-shadow-lg" />
            </div>
          )}
        </div>
        <div className="space-y-1 w-full">
          <p className="text-xs text-muted-foreground">Order Reference</p>
          <Badge variant="outline" className="text-base py-1 px-3 font-mono tracking-wider">{orderId.slice(-8).toUpperCase()}</Badge>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ScanLine className="h-4 w-4" />
          <span>{isScanned ? "✅ Scanned & Confirmed" : "Present to seller/buyer for handoff scan"}</span>
        </div>
      </CardContent>
    </Card>
  )
}
