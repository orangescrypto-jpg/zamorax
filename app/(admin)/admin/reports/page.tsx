"use client"

import {AdminService, query, orderBy, onSnapshot, serverTimestamp} from "@/src/services"
// app/(admin)/admin/reports/page.tsx
// Admin view of all flagged listing reports — escalated from moderators or auto-flagged.

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useToast } from "@/components/ui/use-toast"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Flag, Loader2, CheckCircle, XCircle, ExternalLink, Search, ShieldAlert } from "lucide-react"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import {DocumentData} from "@/src/services"

type Report = DocumentData & { id: string }

const REASON_LABELS: Record<string, string> = {
  counterfeit:  "Counterfeit / fake",
  stolen:       "Stolen goods",
  prohibited:   "Prohibited item",
  misleading:   "Misleading listing",
  wrong_price:  "Pricing scam",
  already_sold: "Already sold",
  spam:         "Spam / duplicate",
  other:        "Other",
}

export default function AdminReportsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [activeTab, setActiveTab] = useState("pending")

  useEffect(() => {
    const unsub = AdminService.subscribeToCollection("listingReports", docs => {
        setReports(docs.map(d => ({ ...d }, [orderBy("createdAt", "desc")]) as Report))
        setLoading(false)
      },
      () => setLoading(false)
    )
    return unsub
  }, [])

  const action = async (id: string, status: "dismissed" | "actioned", extra?: Record<string, any>) => {
    if (!user?.uid) return
    setProcessing(id)
    try {
      await AdminService.updateDoc("listingReports", id, {
        status,
        reviewedBy: user.uid,
        reviewedAt: serverTimestamp(),
        ...extra,
      })
      toast({ title: status === "actioned" ? "Report actioned" : "Report dismissed" })
    } catch {
      toast({ title: "Error", variant: "destructive" })
    } finally {
      setProcessing(null)
    }
  }

  const filtered = reports.filter(r => {
    const matchesTab = activeTab === "all" || r.status === activeTab
    const matchesSearch = !search ||
      r.listingTitle?.toLowerCase().includes(search.toLowerCase()) ||
      r.reporterName?.toLowerCase().includes(search.toLowerCase())
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
          <h1 className="text-2xl font-heading font-bold">Listing Reports</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Flagged listings from buyers and moderators.
          </p>
        </div>
        <Badge variant="outline" className="text-sm px-3 py-1">
          {reports.filter(r => r.status === "pending").length} pending
        </Badge>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by listing or reporter…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pending">Pending ({reports.filter(r => r.status === "pending").length})</TabsTrigger>
          <TabsTrigger value="actioned">Actioned</TabsTrigger>
          <TabsTrigger value="dismissed">Dismissed</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        {["pending", "actioned", "dismissed", "all"].map(tab => (
          <TabsContent key={tab} value={tab} className="space-y-3 mt-4">
            {filtered.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Flag className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground text-sm">No reports in this category.</p>
                </CardContent>
              </Card>
            ) : filtered.map(report => (
              <Card key={report.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                          {REASON_LABELS[report.reason] ?? report.reason}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {report.status}
                        </Badge>
                      </div>
                      <p className="font-semibold text-sm truncate">{report.listingTitle || "Untitled Listing"}</p>
                      <p className="text-xs text-muted-foreground">
                        Reported by {report.reporterName || "Anonymous"} •{" "}
                        {report.createdAt?.toDate ? formatDistanceToNow(report.createdAt.toDate(), { addSuffix: true }) : "—"}
                      </p>
                      {report.details && (
                        <p className="text-sm text-muted-foreground italic">"{report.details}"</p>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 shrink-0">
                      {report.listingId && (
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/listings/${report.listingId}`} target="_blank">
                            <ExternalLink className="h-3 w-3 mr-1" /> View
                          </Link>
                        </Button>
                      )}
                      {report.status === "pending" && (
                        <>
                          <Button
                            size="sm"
                            className="bg-primary text-white"
                            disabled={processing === report.id}
                            onClick={() => action(report.id, "actioned")}
                          >
                            {processing === report.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><ShieldAlert className="h-3 w-3 mr-1" />Action</>}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={processing === report.id}
                            onClick={() => action(report.id, "dismissed")}
                          >
                            <XCircle className="h-3 w-3 mr-1" />Dismiss
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
