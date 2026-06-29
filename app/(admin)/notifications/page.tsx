"use client"
// WAS FIREBASE → NOW CLOUDFLARE D1
import { AdminService } from "@/src/services"

import { useEffect } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Bell, RefreshCw, CheckCheck } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import Link from "next/link"
import { usePaginatedCollection } from "@/hooks/usePaginatedCollection"
import { LoadMoreButton } from "@/components/ui/LoadMoreButton"

const PAGE_SIZE = 25

export default function NotificationsPage() {
  const { user } = useAuth()
  const { toast } = useToast()

  const { items: notifs, loading, loadingMore, hasMore, total, loadMore, reload } =
    usePaginatedCollection({
      collectionPath: "notifications",
      pageSize: PAGE_SIZE,
    })

  // Filter to current user client-side (D1 shim fetches all; server-side filter via API later)
  const userNotifs = notifs.filter((n: any) => (n.user_id ?? n.userId) === user?.uid)
  const unreadCount = userNotifs.filter((n: any) => !n.is_read && !n.isRead).length

  useEffect(() => { if (user?.uid) reload() }, [user?.uid])

  const markAllRead = async () => {
    const unread = userNotifs.filter((n: any) => !n.is_read && !n.isRead)
    if (!unread.length) return
    await Promise.all(unread.map((n: any) => AdminService.updateDoc("notifications", n.id, { is_read: true })))
    toast({ title: "All marked as read" })
    reload()
  }

  const markOne = async (id: string) => {
    await AdminService.updateDoc("notifications", id, { is_read: true })
  }

  if (loading) return (
    <div className="container flex h-64 items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )

  return (
    <div className="container max-w-2xl py-8 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <Bell className="h-6 w-6" /> Notifications
            {unreadCount > 0 && (
              <Badge className="bg-primary text-white">{unreadCount} new</Badge>
            )}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">{userNotifs.length} total</p>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllRead}>
              <CheckCheck className="h-4 w-4 mr-1" /> Mark all read
            </Button>
          )}
          <Button variant="outline" size="icon" onClick={reload}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {userNotifs.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Bell className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No notifications yet.</p>
            <p className="text-sm mt-1">We'll let you know when something needs your attention.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {userNotifs.map((n: any) => {
            const isRead    = n.is_read || n.isRead
            const createdAt = n.created_at ?? n.createdAt
            const timeAgo   = createdAt
              ? formatDistanceToNow(new Date(createdAt), { addSuffix: true })
              : ""
            return (
              <Card
                key={n.id}
                className={`transition-colors ${!isRead ? "border-primary/30 bg-primary/5" : ""}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {!isRead && (
                      <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-2" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{n.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{timeAgo}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {n.link && (
                        <Button asChild variant="ghost" size="sm" className="text-xs h-7 px-2">
                          <Link href={n.link} onClick={() => markOne(n.id)}>View</Link>
                        </Button>
                      )}
                      {!isRead && (
                        <button
                          onClick={() => markOne(n.id)}
                          className="text-[10px] text-muted-foreground hover:text-primary"
                        >
                          Dismiss
                        </button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <LoadMoreButton
        hasMore={hasMore}
        loading={loadingMore}
        onLoadMore={loadMore}
        total={total}
        label={`Load Next ${PAGE_SIZE} Notifications`}
      />
    </div>
  )
}
