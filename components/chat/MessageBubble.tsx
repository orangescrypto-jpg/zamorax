"use client"

import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import { AlertTriangle } from "lucide-react"

interface MessageBubbleProps {
  message: { id: string; text: string; createdAt: string | { toDate: () => Date }; isBlocked: boolean; [key: string]: any }
  isOwn: boolean
}

export function MessageBubble({ message, isOwn }: MessageBubbleProps) {
  const time = message.createdAt && typeof message.createdAt !== "string" && (message.createdAt as any).toDate ? formatDistanceToNow((message.createdAt as any).toDate(), { addSuffix: true }) : "..."

  return (
    <div className={cn("flex w-full", isOwn ? "justify-end" : "justify-start")}>
      <div className={cn(
        "max-w-[80%] px-4 py-2 rounded-2xl text-sm shadow-sm",
        isOwn ? "bg-primary text-white rounded-br-none" : "bg-white border text-foreground rounded-bl-none"
      )}>
        <p className="whitespace-pre-wrap break-words">{message.text}</p>
        <div className={cn("text-[10px] mt-1 flex items-center gap-1 justify-end", isOwn ? "text-white/70" : "text-muted-foreground")}>
          {message.isBlocked && <AlertTriangle className="h-3 w-3 text-destructive" />}
          {time}
        </div>
      </div>
    </div>
  )
}
