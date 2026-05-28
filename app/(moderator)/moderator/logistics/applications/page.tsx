"use client"

import {AdminService, query, onSnapshot, where, serverTimestamp} from "@/src/services"
// app/(moderator)/moderator/logistics/applications/page.tsx
// Moderator does first-review of ZLA applications before admin final approval

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useToast } from "@/components/ui/use-toast"
import { formatDistanceToNow } from "date-fns"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import {
  Package, Loader2, CheckCircle, XCircle,
  MapPin, Phone, Clock, ArrowUpRight } from "lucide-react"

export default function ModeratorZLAApplicationsPage() {
  const { user }  = useAuth()
  const { toast } = useToast()

  const [applications, setApplications] = useState<any[]>([])
  const [loading, setLoading]           = useState(true)
  const [processing, setProcessing]     = useState<string | null>(null)

  // Pass to admin dialog
  const [passOpen, setPassOpen]     = useState(false)
  const [passApp, setPassApp]       = useState<any>(null)
  const [passNotes, setPassNotes]   = useState("")

  // Reject dialog
  const [rejectOpen, setRejectOpen]   = useState(false)
  const [rejectApp, setRejectApp]     = useState<any>(null)
  const [rejectReason, setRejectReason] = useState("")

  useEffect(() => {
    // Mod sees pending + mod_reviewed applications
    const q = AdminService._ref_("zlaApplications", where("status", "in", ["pending", "mod_reviewed", "rejected_by_mod", "approved", "rejected"]))
    return onSnapshot(q, docs => {
      setApplications(docs.map(d => ({ ...d })))
      setLoading(false)
    }, () => setLoading(false))
  }, [])

  const handlePassToAdmin = async () => {
    if (!passApp || !passNotes.trim()) return
    setProcessing(passApp.id)
    try {
      await AdminService.updateDoc("zlaApplications", passApp.id, {
        status:           "mod_reviewed",
        modReviewedBy:    user?.uid,
        modReviewedAt:    serverTimestamp(),
        modNotes:         passNotes.trim(),
        updatedAt:        serverTimestamp() })

      // Notify admin
      await AdminService.addDoc("notifications", {
        userId:    "admin",
        type:      "system",
        title:     `✅ ZLA Pre-screened: ${passApp.storeName}`,
        body:      `Moderator reviewed and passed this application to you. Notes: ${passNotes.trim().slice(0, 100)}`,
        link:      "/admin/logistics/applications",
        read:      false,
        createdAt: serverTimestamp() })

      toast({ title: "Passed to admin!", description: "Admin will make the final decision.", variant: "success" })
      setPassOpen(false)
      setPassNotes("")
      setPassApp(null)
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally { setProcessing(null) }
  }

  const handleRejectByMod = async () => {
    if (!rejectApp || !rejectReason.trim()) return
    setProcessing(rejectApp.id)
    try {
      await AdminService.updateDoc("zlaApplications", rejectApp.id, {
        status:           "rejected_by_mod",
        modReviewedBy:    user?.uid,
        modReviewedAt:    serverTimestamp(),
        modRejectReason:  rejectReason.trim(),
        updatedAt:        serverTimestamp() })

      // Notify applicant
      await AdminService.addDoc("notifications", {
        userId:    rejectApp.userId,
        type:      "system",
        title:     "ZLA Application — More Information Needed",
        body:      rejectReason.trim(),
        link:      "/dashboard/zla/apply",
        read:      false,
        createdAt: serverTimestamp() })

      toast({ title: "Application rejected at mod level", variant: "success" })
      setRejectOpen(false)
      setRejectReason("")
      setRejectApp(null)
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally { setProcessing(null) }
  }

  const pending    = applications.filter(a => a.status === "pending")
  const reviewed   = applications.filter(a => a.status === "mod_reviewed")
  const rejected   = applications.filter(a => ["rejected_by_mod", "rejected"].includes(a.status))
  const approved   = applications.filter(a => a.status === "approved")

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const AppCard = ({ app }: { app: any }) => (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="font-semibold text-sm">{app.storeName}</p>
            <p className="text-xs text-muted-foreground">{app.userName} · {app.userEmail}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {app.storeAddress}, {app.state}
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Phone className="h-3 w-3" />{app.phone}
              </span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />{app.operatingHours}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Capacity: {app.storageCapacity} parcels ·{" "}
              {app.createdAt?.toDate
                ? formatDistanceToNow(app.createdAt.toDate(), { addSuffix: true })
                : ""}
            </p>
            {app.about && (
              <p className="text-xs text-muted-foreground italic">"{app.about}"</p>
            )}
            {app.modNotes && (
              <div className="text-xs bg-blue-50 border border-blue-200 rounded p-2 text-blue-800">
                <strong>Mod notes:</strong> {app.modNotes}
              </div>
            )}
            {app.modRejectReason && (
              <div className="text-xs bg-red-50 border border-red-200 rounded p-2 text-red-700">
                <strong>Rejection reason:</strong> {app.modRejectReason}
              </div>
            )}
          </div>
          <Badge className={
            app.status === "approved"        ? "bg-emerald-100 text-emerald-800" :
            app.status === "mod_reviewed"    ? "bg-blue-100 text-blue-800" :
            app.status === "rejected_by_mod" ? "bg-red-100 text-red-800" :
            app.status === "rejected"        ? "bg-gray-100 text-gray-600" :
            "bg-amber-100 text-amber-800"
          }>
            {app.status === "mod_reviewed" ? "Passed to Admin" :
             app.status === "rejected_by_mod" ? "Rejected (Mod)" :
             app.status}
          </Badge>
        </div>

        {/* Actions — only for pending apps */}
        {app.status === "pending" && (
          <div className="flex gap-2">
            {/* Call to verify */}
            <Button size="sm" variant="ghost" asChild>
              <a href={`tel:${app.phone}`}>
                <Phone className="h-3.5 w-3.5 mr-1" /> Call to Verify
              </a>
            </Button>

            {/* Pass to admin */}
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => { setPassApp(app); setPassOpen(true) }}
              disabled={processing === app.id}
            >
              {processing === app.id
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <><CheckCircle className="h-3.5 w-3.5 mr-1" /> Pass to Admin</>
              }
            </Button>

            {/* Reject at mod level */}
            <Button
              size="sm"
              variant="outline"
              className="border-red-200 text-red-600 hover:bg-red-50"
              onClick={() => { setRejectApp(app); setRejectOpen(true) }}
              disabled={processing === app.id}
            >
              <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-7 w-7 animate-spin text-primary" />
    </div>
  )

  return (
    <div className="container max-w-3xl py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <Package className="h-6 w-6 text-primary" /> ZLA Application Pre-Screen
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          First-review applications. Call the applicant to verify, then pass to admin for final approval.
        </p>
      </div>

      {/* Mod scope reminder */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800 space-y-1">
        <p className="font-semibold">📋 Your role here</p>
        <p>You verify the address is real and call the applicant. Admin makes the final approval and activates their dashboard. You cannot approve — only pass or reject at pre-screen level.</p>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">
            Pending
            {pending.length > 0 && (
              <span className="ml-1.5 bg-amber-500 text-white text-xs px-1.5 rounded-full">{pending.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="reviewed">Passed to Admin ({reviewed.length})</TabsTrigger>
          <TabsTrigger value="approved">Approved ({approved.length})</TabsTrigger>
          <TabsTrigger value="rejected">Rejected ({rejected.length})</TabsTrigger>
        </TabsList>

        {([["pending", pending], ["reviewed", reviewed], ["approved", approved], ["rejected", rejected]] as [string, any[]][]).map(([tab, list]) => (
          <TabsContent key={tab} value={tab} className="mt-4 space-y-3">
            {list.length === 0
              ? <div className="border border-dashed rounded-xl py-12 text-center text-muted-foreground text-sm">No {tab} applications.</div>
              : list.map(app => <AppCard key={app.id} app={app} />)
            }
          </TabsContent>
        ))}
      </Tabs>

      {/* Pass to Admin dialog */}
      <Dialog open={passOpen} onOpenChange={v => { setPassOpen(v); if (!v) { setPassNotes(""); setPassApp(null) } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-600" /> Pass to Admin
            </DialogTitle>
            <DialogDescription>
              Add your verification notes. Admin will make the final call.
            </DialogDescription>
          </DialogHeader>
          {passApp && (
            <div className="space-y-3 py-2">
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <p className="font-semibold">{passApp.storeName}</p>
                <p className="text-xs text-muted-foreground">{passApp.storeAddress}, {passApp.state}</p>
              </div>
              <Textarea
                placeholder="e.g. Called and spoke to Adebayo. Store address confirmed on Google Maps. Operates a busy electronics shop. Recommended for approval..."
                value={passNotes}
                onChange={e => setPassNotes(e.target.value)}
                rows={4}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPassOpen(false)}>Cancel</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handlePassToAdmin}
              disabled={!passNotes.trim() || !!processing}
            >
              {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle className="h-3.5 w-3.5 mr-1.5" /> Pass to Admin</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={rejectOpen} onOpenChange={v => { setRejectOpen(v); if (!v) { setRejectReason(""); setRejectApp(null) } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" /> Reject Application
            </DialogTitle>
            <DialogDescription>
              The applicant will be notified with your reason and can reapply.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="e.g. Could not verify address. Phone number not reachable. Please resubmit with a valid contact number and a photo of your store front..."
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleRejectByMod}
              disabled={!rejectReason.trim() || !!processing}
            >
              {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reject & Notify"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
