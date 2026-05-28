"use client"

import { cn } from "@/lib/utils"
import { Check, Truck, Shield, Package, Search, Clock, AlertCircle } from "lucide-react"

const ORDER_STEPS = [
  { id: "pending", label: "Paid", icon: Clock },
  { id: "escrow_held", label: "Escrow Secured", icon: Shield },
  { id: "shipped", label: "Shipped", icon: Truck },
  { id: "delivered", label: "Delivered", icon: Package },
  { id: "inspecting", label: "Inspecting", icon: Search },
  { id: "completed", label: "Completed", icon: Check },
  { id: "disputed", label: "Disputed", icon: AlertCircle },
]

export function OrderTimeline({ currentStatus }: { currentStatus: string }) {
  const currentIndex = ORDER_STEPS.findIndex(s => s.id === currentStatus)

  return (
    <div className="w-full py-4 overflow-x-auto no-scrollbar">
      <div className="flex items-center justify-between min-w-[600px] px-2">
        {ORDER_STEPS.map((step, i) => {
          const isCompleted = i < currentIndex
          const isCurrent = i === currentIndex
          const Icon = step.icon

          return (
            <div key={step.id} className="flex flex-col items-center gap-2 relative flex-1">
              {/* Connector Line */}
              {i < ORDER_STEPS.length - 1 && (
                <div className={cn(
                  "absolute top-3 left-[50%] w-full h-0.5 -z-10",
                  isCompleted ? "bg-accent" : "bg-border"
                )} />
              )}
              
              {/* Icon Circle */}
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors z-10 bg-background",
                isCompleted ? "border-accent bg-accent text-white" : 
                isCurrent ? "border-primary text-primary" : "border-border text-muted-foreground"
              )}>
                <Icon className="h-4 w-4" />
              </div>
              <span className={cn(
                "text-xs font-medium text-center",
                isCompleted || isCurrent ? "text-foreground" : "text-muted-foreground"
              )}>
                {step.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
