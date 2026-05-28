"use client"

import { Zap } from "lucide-react"
import { cn } from "@/lib/utils"

interface FBZBadgeProps {
  size?: "xs" | "sm" | "md"
  className?: string
}

export function FBZBadge({ size = "sm", className }: FBZBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-bold rounded-full bg-gradient-to-r from-primary to-emerald-500 text-white",
        size === "xs" && "text-[10px] px-1.5 py-0.5",
        size === "sm" && "text-xs px-2 py-1",
        size === "md" && "text-sm px-3 py-1.5",
        className
      )}
    >
      <Zap className={cn(
        "fill-white",
        size === "xs" && "h-2.5 w-2.5",
        size === "sm" && "h-3 w-3",
        size === "md" && "h-4 w-4",
      )} />
      FBZ
    </span>
  )
}
