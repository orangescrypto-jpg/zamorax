"use client"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Lock, ShieldCheck } from "lucide-react"

export function ChatLockNotice() {
  return (
    <Alert className="mx-4 mb-2 bg-amber-50 border-amber-200 text-amber-800">
      <Lock className="h-4 w-4 text-amber-600" />
      <AlertDescription className="text-xs">
        <strong>🔒 Security Active:</strong> Phone numbers & external links are hidden until escrow is funded. Once payment is secured, you can chat freely.
      </AlertDescription>
    </Alert>
  )
}
