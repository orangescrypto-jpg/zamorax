"use client"
// app/(moderator)/moderator/messages/page.tsx
// Moderator inbox for contact form submissions saved to contact_messages (D1).

import { AdminService, orderBy } from "@/src/services"
import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useToast } from "@/components/ui/use-toast"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Mail, Loader2, CheckCircle2, Search, Inbox, Trash2 } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface ContactMessage {
  id: string
  name?: string
  email?: string
  subject?: string
  message?: string
  type?: string
  status?: string
  createdAt?: { toDate?: () => Date } | string
  [key: string]: unknown
}

const TYPE_LABELS: Record<string, string> = {
  support:  "General Support",
  billing:  "Billing",
  dispute:  "Dispute",
  seller:   "Seller Help",
  partnership: "Partnership",
  other:    "Other",
}

function toDate(v: ContactMessage["createdAt"]): Date | null {
  if (!v) return null
  if (typeof v === "string") return new Date(v)
  if (v.toDate) return v.toDate()
  return null
}

export default function ModeratorMessagesPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [messages, setMessages] = useState<ContactMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [activeTab, setActiveTab] = useState("unread")

  useEffect(() => {
    const unsub = AdminService.subscribeToCollection(
      "contactMessages",
      docs => {
        setMessages(docs.map((d: any) => d as unknown as ContactMessage))
        setLoading(false)
      },
      [orderBy("createdAt", "desc")]
    )
    return unsub
  }, [])

  const markStatus = async (id: string, status: "read" | "resolved") => {
    if (!user?.uid) return
    setProcessing(id)
    try {
      await AdminService.updateDoc("contactMessages", id, { status })
      toast({ title: status === "resolved" ? "Marked resolved" : "Marked read" })
    } catch {
      toast({ title: "Error updating message", variant: "destructive" })
    } finally {
      setProcessing(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this message permanently? This can't be undone.")) return
    setProcessing(id)
    try {
      // Hard delete from D1 — irrespective of status (unread, read, or resolved).
      await AdminService.deleteDoc("contactMessages", id)
      toast({ title: "Message deleted" })
    } catch {
      toast({ title: "Error deleting message", variant: "destructive" })
    } finally {
      setProcessing(null)
    }
  }

  const filtered = messages.filter(m => {
    const matchesTab = activeTab === "all" || m.status === activeTab
    const q = search.toLowerCase()
    const matchesSearch = !search ||
      m.name?.toLowerCase().includes(q) ||
      m.email?.toLowerCase().includes(q) ||
      m.subject?.toLowerCase().includes(q)
    return matchesTab && matchesSearch
  })

  if (loading) return (
    <div className="flex h-[60vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )

  return (
    <div className="container py-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold">Contact Messages</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Submissions from the /contact form.
          </p>
        </div>
        <Badge variant="outline" className="text-sm px-3 py-1">
          {messages.filter(m => m.status === "unread").length} unread
        </Badge>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by name, email, or subject…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="unread">Unread ({messages.filter(m => m.status === "unread").length})</TabsTrigger>
          <TabsTrigger value="read">Read</TabsTrigger>
          <TabsTrigger value="resolved">Resolved</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        {["unread", "read", "resolved", "all"].map(tab => (
          <TabsContent key={tab} value={tab} className="space-y-3 mt-4">
            {filtered.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Inbox className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground text-sm">No messages in this category.</p>
                </CardContent>
              </Card>
            ) : filtered.map(msg => {
              const date = toDate(msg.createdAt)
              return (
                <Card key={msg.id} className={msg.status === "unread" ? "border-primary/40" : ""}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs">
                            {TYPE_LABELS[msg.type ?? "support"] ?? msg.type}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {msg.status}
                          </Badge>
                        </div>
                        <p className="font-semibold text-sm truncate">{msg.subject || "No subject"}</p>
                        <p className="text-xs text-muted-foreground">
                          {msg.name || "Unknown"} · {msg.email || "no email"} ·{" "}
                          {date ? formatDistanceToNow(date, { addSuffix: true }) : "—"}
                        </p>
                        {msg.message && (
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{msg.message}</p>
                        )}
                      </div>

                      <div className="flex flex-col gap-2 shrink-0">
                        {msg.email && (
                          <Button asChild size="sm" variant="outline">
                            <a href={`mailto:${msg.email}?subject=${encodeURIComponent("Re: " + (msg.subject || "Your message to Zamorax"))}`}>
                              <Mail className="h-3 w-3 mr-1" /> Reply
                            </a>
                          </Button>
                        )}
                        {msg.status === "unread" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={processing === msg.id}
                            onClick={() => markStatus(msg.id, "read")}
                          >
                            {processing === msg.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Mark Read"}
                          </Button>
                        )}
                        {msg.status !== "resolved" && (
                          <Button
                            size="sm"
                            className="bg-primary text-white"
                            disabled={processing === msg.id}
                            onClick={() => markStatus(msg.id, "resolved")}
                          >
                            {processing === msg.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><CheckCircle2 className="h-3 w-3 mr-1" />Resolve</>}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          disabled={processing === msg.id}
                          onClick={() => handleDelete(msg.id)}
                        >
                          {processing === msg.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Trash2 className="h-3 w-3 mr-1" />Delete</>}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
