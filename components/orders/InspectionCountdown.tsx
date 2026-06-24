"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Timer, AlertTriangle, ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import { Timestamp } from "@/src/services"

interface InspectionCountdownProps {
  deliveryTime: Timestamp | null
  onComplete?: () => void
}

export function InspectionCountdown({ deliveryTime, onComplete }: InspectionCountdownProps) {
  const [timeLeft, setTimeLeft] = useState<{ h: number; m: number; s: number } | null>(null)
  const [pct, setPct] = useState(0)
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    if (!deliveryTime) return
    const target = deliveryTime.toDate()
    const expiry = new Date(target.getTime() + 24 * 60 * 60 * 1000) // +24 hours
    const totalMs = expiry.getTime() - target.getTime()

    const tick = () => {
      const now = new Date().getTime()
      const diff = expiry.getTime() - now
      
      if (diff <= 0) {
        setTimeLeft(null)
        setPct(100)
        setExpired(true)
        onComplete?.()
        return
      }

      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      
      setTimeLeft({ h, m, s })
      setPct(((totalMs - diff) / totalMs) * 100)
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [deliveryTime, onComplete])

  if (!timeLeft && !expired) return null

  return (
    <Card className={cn(
      "border-2", 
      expired ? "border-destructive bg-red-50" : timeLeft && timeLeft.h < 2 ? "border-warning bg-amber-50" : "border-accent bg-emerald-50"
    )}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {expired ? <AlertTriangle className="h-5 w-5 text-destructive" /> : <ShieldCheck className="h-5 w-5 text-accent" />}
            <h4 className="font-semibold">{expired ? "Inspection Window Closed" : "Inspection Timer Active"}</h4>
          </div>
          <div className="flex items-center gap-1 text-2xl font-mono font-bold">
            {timeLeft ? (
              <>
                <span className={cn(timeLeft.h < 2 ? "text-destructive" : "text-foreground")}>{String(timeLeft.h).padStart(2, "0")}</span>:
                <span className={cn(timeLeft.h < 2 ? "text-destructive" : "text-foreground")}>{String(timeLeft.m).padStart(2, "0")}</span>:
                <span className={cn(timeLeft.h < 2 ? "text-destructive" : "text-foreground")}>{String(timeLeft.s).padStart(2, "0")}</span>
              </>
            ) : (
              <span className="text-destructive">EXPIRED</span>
            )}
          </div>
        </div>
        <Progress value={pct} className="h-2" />
        <p className="text-xs text-muted-foreground text-center">
          {expired 
            ? "Funds will auto-release to seller shortly if no dispute is raised." 
            : "Confirm receipt or raise a dispute before timer expires."}
        </p>
      </CardContent>
    </Card>
  )
}
