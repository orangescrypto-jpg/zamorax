"use client"
// app/(public)/notifications/page.tsx

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { NotificationsService } from "@/src/services/notifications"
import { formatDistanceToNow } from "date-fns"
import { useRouter } from "next/navigation"
import { Bell, CheckCheck, Loader2, ShoppingBag, Wallet, MessageCircle, Shield, Info, Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Notification } from "@/src/types"

function notifIcon(type: string) {
  switch (type) {
    case "order":    return <ShoppingBag className="h-4 w-4 text-blue-500" />
    case "payout":
    case "wallet":   return <Wallet className="h-4 w-4 text-emerald-500" />
    case "chat":     return <MessageCircle className="h-4 w-4 text-purple-500" />
    case "dispute":  return <Shield className="h-4 w-4 text-red-500" />
    case "delivery":
    case "shipping": return <Package className="h-4 w-4 text-orange-500" />
    default:         return <Info className="h-4 w-4 text-primary" />
  }
}

function NotificationItem({ n, onRead }: { n: Notification; onRead: (id: string) => void }) {
  const router = useRouter()

  const handleClick = () => {
    if (!n.isRead) onRead(n.id)
    if (n.link) router.push(n.link)
  }

  return (
    <button
      onClick={handleClick}
      className={cn(
        "w-full text-left flex items-start gap-3 px-4 py-4 border-b border-border last:border-0 transition-colors",
        n.isRead ? "bg-background" : "bg-primary/5 hover:bg-primary/8",
        "hover:bg-muted/60",
      )}
    >
      {/* Icon */}
      <div className={cn(
        "w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5",
        n.isRead ? "bg-muted" : "bg-primary/10",
      )}>
        {notifIcon(n.type)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={cn("text-sm leading-snug", !n.isRead && "font-semibold")}>
            {n.title}
          </p>
          {!n.isRead && (
            <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
          )}
        </div>
        {n.body && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
        )}
        <p className="text-[10px] text-muted-foreground mt-1">
          {formatDistanceToNow(
            typeof n.createdAt === "string" ? new Date(n.createdAt) : (n.createdAt as any).toDate(),
            { addSuffix: true }
          )}
        </p>
      </div>
    </button>
  )
}

export default function NotificationsPage() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading]             = useState(true)
  const [markingAll, setMarkingAll]       = useState(false)

  useEffect(() => {
    if (!user?.uid) return
    const unsub = NotificationsService.subscribeToNotifications(user.uid, (notifs) => {
      setNotifications(notifs)
      setLoading(false)
    })
    return unsub
  }, [user?.uid])

  const handleMarkRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true, read: true } : n))
    await NotificationsService.markAsRead(id)
  }

  const handleMarkAllRead = async () => {
    if (!user?.uid) return
    setMarkingAll(true)
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true, read: true })))
    await NotificationsService.markAllAsRead(user.uid)
    setMarkingAll(false)
  }

  const unreadCount = notifications.filter(n => !n.isRead).length

  return (
    <div className="container max-w-2xl py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" /> Notifications
          </h1>
          {unreadCount > 0 && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {unreadCount} unread
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllRead}
            disabled={markingAll}
            className="text-xs"
          >
            {markingAll
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <><CheckCheck className="h-3.5 w-3.5 mr-1.5" /> Mark all read</>
            }
          </Button>
        )}
      </div>

      {/* List */}
      <div className="border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <Bell className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="font-medium text-muted-foreground">No notifications yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Order updates, payouts, and messages will appear here.
            </p>
          </div>
        ) : (
          notifications.map(n => (
            <NotificationItem key={n.id} n={n} onRead={handleMarkRead} />
          ))
        )}
      </div>
    </div>
  )
}
