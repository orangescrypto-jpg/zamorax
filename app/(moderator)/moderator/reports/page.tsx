"use client"

import {AdminService, query, orderBy, onSnapshot, where, serverTimestamp} from "@/src/services"
// app/(moderator)/moderator/reports/page.tsx

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useToast } from "@/components/ui/use-toast"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Flag, Loader2, ArrowUpRight, CheckCircle, XCircle, ShieldAlert } from "lucide-react"
import Link from "next/link"
import {DocumentData} from "@/src/services"

type Report = DocumentData & { id: string }

const REASON_LABELS: Record<string, string> = {
  counterfeit: "Counterfeit / fake",
  stolen: "Stolen goods",
  prohibited: "Prohibited item",
  misleading: "Misleading listing",
  wrong_price: "Pricing scam",
  already_sold: "Already sold",
  spam: "Spam / duplicate",
  other: "Other" }

export default function ModeratorReportsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)

  useEffect(() => {
    const q = AdminService._ref_("listingReports", [where("status", "in", ["pending", "reviewed", "dismissed"]),
      orderBy("createdAt", "desc")
    ])
    return onSnapshot(q, docs => {
      setReports(docs.docs.map((d: any) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, () => setLoading(false))
  }, [])

  const handleAction = async (report: Report, action: "reviewed" | "dismissed", takedown?: boolean) => {
    setProcessing(report.id)
    try {
      // Update the report
      await AdminService.updateDoc("listingReports", report.id, {
        status: action,
        reviewedBy: user?.uid,
        reviewedAt: serverTimestamp(),
        updatedAt: serverTimestamp() })

      // If approved report → flag the listing for takedown
      if (takedown) {
        await AdminService.updateDoc("listings", report.listingId, {
          status: "flagged",
          isActive: false,
          flaggedReason: report.reason,
          flaggedAt: serverTimestamp(),
          flaggedBy: user?.uid })
      }

      toast({
        title: action === "reviewed" ? (takedown ? "Listing taken down" : "Report reviewed") : "Report dismissed",
        variant: "success" })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally { setProcessing(null) }
  }

  const pending    = reports.filter(r => r.status === "pending")
  const reviewed   = reports.filter(r => r.status === "reviewed")
  const dismissed  = reports.filter(r => r.status === "dismissed")

  const statusColors: Record<string, string> = {
    pending:   "bg-red-100 text-red-800",
    reviewed:  "bg-green-100 text-green-800",
    dismissed: "bg-gray-100 text-gray-600" }

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-7 w-7 animate-spin text-primary" />
    </div>
  )

  const ReportRow = ({ r }: { r: Report }) => (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{r.listingTitle}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Reported by {r.reporterEmail} · {r.createdAt?.toDate?.().toLocaleDateString()}
            </p>
            <Badge className="mt-1.5 text-xs" variant="secondary">
              {REASON_LABELS[r.reason] || r.reason}
            </Badge>
            {r.details && (
              <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 italic">"{r.details}"</p>
            )}
          </div>
          <Badge className={`shrink-0 ${statusColors[r.status] || "bg-gray-100"}`}>{r.status}</Badge>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/listings/${r.listingId}`} target="_blank">
              <ArrowUpRight className="h-3.5 w-3.5 mr-1" /> View Listing
            </Link>
          </Button>

          {r.status === "pending" && (
            <>
              <Button
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={() => handleAction(r, "reviewed", true)}
                disabled={processing === r.id}
              >
                {processing === r.id
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <><ShieldAlert className="h-3.5 w-3.5 mr-1" /> Take Down Listing</>
                }
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAction(r, "reviewed", false)}
                disabled={processing === r.id}
              >
                <CheckCircle className="h-3.5 w-3.5 mr-1 text-green-600" /> Mark Reviewed (No Action)
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground"
                onClick={() => handleAction(r, "dismissed")}
                disabled={processing === r.id}
              >
                <XCircle className="h-3.5 w-3.5 mr-1" /> Dismiss
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="container py-8 max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <Flag className="h-6 w-6 text-red-500" /> Listing Reports
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Review user-flagged listings. Take down confirmed violations.
        </p>
      </div>

      <Tabs defaultValue="pending">
        <TabsList className="mb-4">
          <TabsTrigger value="pending">
            Pending {pending.length > 0 && (
              <span className="ml-1 bg-red-500 text-white text-xs px-1.5 rounded-full">{pending.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="reviewed">Reviewed ({reviewed.length})</TabsTrigger>
          <TabsTrigger value="dismissed">Dismissed ({dismissed.length})</TabsTrigger>
        </TabsList>

        {([["pending", pending], ["reviewed", reviewed], ["dismissed", dismissed]] as [string, Report[]][]).map(([tab, list]) => (
          <TabsContent key={tab} value={tab} className="space-y-3">
            {list.length === 0
              ? <div className="border border-dashed rounded-xl py-12 text-center text-muted-foreground">No {tab} reports.</div>
              : list.map(r => <ReportRow key={r.id} r={r} />)
            }
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
