"use client"

import { useEffect, useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Timer, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Timestamp } from "@/src/services"

export function EscrowTimer({ expiresAt }: { expiresAt: Timestamp | null }) {
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number } | null>(null)
  const [isUrgent, setIsUrgent] = useState(false)

  useEffect(() => {
    if (!expiresAt) return

    const targetDate = expiresAt.toDate()

    const updateTimer = () => {
      const now = new Date()
      const diff = targetDate.getTime() - now.getTime()

      if (diff <= 0) {
        setTimeLeft(null)
        setIsUrgent(false)
        return
      }

      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      setTimeLeft({ hours, minutes, seconds })
      setIsUrgent(diff < 2 * 60 * 60 * 1000) // < 2 hours
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [expiresAt])

  if (!timeLeft) return null

  return (
    <Alert className={cn("border-2", isUrgent ? "bg-red-50 border-red-200" : "bg-blue-50 border-blue-200")}>
      <Timer className={cn("h-4 w-4", isUrgent ? "text-red-600" : "text-blue-600")} />
      <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <span className="font-medium">
          {isUrgent ? "⚠️ Funds auto-releasing soon!" : "🔒 Escrow inspection window closes in:"}
        </span>
        <span className={cn("font-mono text-lg font-bold", isUrgent ? "text-red-600" : "text-blue-600")}>
          {String(timeLeft.hours).padStart(2, "0")}:
          {String(timeLeft.minutes).padStart(2, "0")}:
          {String(timeLeft.seconds).padStart(2, "0")}
        </span>
      </AlertDescription>
    </Alert>
  )
}
