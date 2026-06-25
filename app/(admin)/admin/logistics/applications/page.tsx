"use client"
import type React from "react"

import {AdminService, query, onSnapshot, where, serverTimestamp} from "@/src/services"
// app/(admin)/admin/logistics/applications/page.tsx

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useToast } from "@/components/ui/use-toast"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { formatDistanceToNow } from "date-fns"
import {
  Package, CheckCircle, XCircle, Loader2,
  MapPin, Phone, Clock, Store, User,
  Mail, Hash, Calendar, Info, ChevronDown, ChevronUp } from "lucide-react"

export default function ZLAApplicationsPage() {
  const { user }  = useAuth()
  const { toast } = useToast()

  const [applications, setApplications] = useState<any[]>([])
  const [loading, setLoading]           = useState(true)
  const [processing, setProcessing]     = useState<string | null>(null)

  // Approve dialog
  const [approveOpen, setApproveOpen] = useState(false)
  const [selected, setSelected]       = useState<any>(null)
  const [capacity, setCapacity]       = useState("20")
  const [hours, setHours]             = useState("Mon–Sat 8am–6pm")

  // Reject dialog
  const [rejectOpen, setRejectOpen]   = useState(false)
  const [rejectTarget, setRejectTarget] = useState<any>(null)
  const [rejectReason, setRejectReason] = useState("")

  // Expanded detail cards
  const [expandedId, setExpandedId]   = useState<string | null>(null)

  useEffect(() => {
    const q = AdminService._ref_("zlaApplications", [where("status", "in", ["pending", "approved", "rejected"])])
    return onSnapshot(q, snap => {
      const apps = snap.docs.map((d: { id: string; data: () => Record<string, any> }) => ({ id: d.id, ...d.data() })) as Array<Record<string, any>>
      // Sort: pending first, then by date desc
      apps.sort((a: any, b: any) => {
        if (a.status === "pending" && b.status !== "pending") return -1
        if (b.status === "pending" && a.status !== "pending") return 1
        return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
      })
      setApplications(apps)
      setLoading(false)
    }, () => setLoading(false))
  }, [])

  const openApprove = (app: Record<string, any>) => {
    setSelected(app)
    setCapacity(String(app.storageCapacity || 20))
    setHours(String(app.operatingHours || "Mon–Sat 8am–6pm"))
    setApproveOpen(true)
  }

  const openReject = (app: Record<string, any>) => {
    setRejectTarget(app)
    setRejectReason("")
    setRejectOpen(true)
  }

  const handleApprove = async () => {
    if (!selected || !user?.uid) return
    setProcessing(selected.id)
    try {
      await AdminService.updateDoc("zlaApplications", selected.id, {
        status:     "approved",
        approvedBy: user.uid,
        approvedAt: serverTimestamp(),
        updatedAt:  serverTimestamp() })

      await AdminService.setDoc("agentLocations", `zla-${selected.userId}`, {
        name:           selected.storeName,
        agentUserId:    selected.userId,
        agentName:      selected.userName,
        agentPhone:     selected.phone,
        address:        selected.storeAddress,
        state:          selected.state,
        city:           selected.city   || "",
        lga:            selected.lga    || "",
        operatingHours: hours,
        maxCapacity:    parseInt(capacity) || 20,
        currentLoad:    0,
        type:           "zamorax_agent",
        isActive:       true,
        lat:            0,
        lng:            0,
        createdAt:      serverTimestamp() })

      await AdminService.addDoc("notifications", {
        userId:    selected.userId,
        type:      "system",
        title:     "🎉 ZLA Application Approved!",
        body:      "Your Zamorax Logistics Agent account is now active. Start accepting parcels from your dashboard.",
        link:      "/dashboard/zla",
        read:      false,
        createdAt: serverTimestamp() })

      toast({ title: "Application approved!", description: `${selected.storeName} is now an active ZLA.`, variant: "success" })
      setApproveOpen(false)
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally { setProcessing(null) }
  }

  const handleReject = async () => {
    if (!rejectTarget || !user?.uid) return
    setProcessing(rejectTarget.id)
    try {
      await AdminService.updateDoc("zlaApplications", rejectTarget.id, {
        status:       "rejected",
        rejectedBy:   user.uid,
        rejectedAt:   serverTimestamp(),
        rejectReason: rejectReason.trim(),
        updatedAt:    serverTimestamp() })

      await AdminService.addDoc("notifications", {
        userId:    rejectTarget.userId,
        type:      "system",
        title:     "ZLA Application Update",
        body:      rejectReason.trim()
          ? `Your ZLA application was not approved: ${rejectReason.trim()}. You may reapply after addressing the issue.`
          : "Your ZLA application was not approved at this time. Contact support for more info.",
        link:      "/dashboard/agent",
        read:      false,
        createdAt: serverTimestamp() })

      toast({ title: "Application rejected" })
      setRejectOpen(false)
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally { setProcessing(null) }
  }

  const pending  = applications.filter(a => a.status === "pending")
  const approved = applications.filter(a => a.status === "approved")
  const rejected = applications.filter(a => a.status === "rejected")

  type DetailRowProps = {
    icon: React.ComponentType<{ className?: string }>
    label: string
    value?: string
  }
  const DetailRow = ({ icon: Icon, label, value }: DetailRowProps) =>
    value ? (
      <div className="flex items-start gap-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
        <div>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
          <p className="text-sm font-medium leading-tight">{value}</p>
        </div>
      </div>
    ) : null

  const AppCard = ({ app }: { app: Record<string, any> }) => {
    const expanded = expandedId === (app.id as string)
    const isPending = app.status === "pending"

    return (
      <Card className={isPending ? "border-amber-200" : ""}>
        <CardContent className="p-4 space-y-3">

          {/* Header row */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-bold text-sm">{app.storeName}</p>
                <Badge className={
                  app.status === "approved" ? "bg-emerald-100 text-emerald-800 text-[10px]" :
                  app.status === "rejected" ? "bg-red-100 text-red-800 text-[10px]" :
                  "bg-amber-100 text-amber-800 text-[10px]"
                }>
                  {app.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{app.userName} · {app.userEmail}</p>
              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 shrink-0" />
                {app.storeAddress}{app.city ? `, ${app.city}` : ""}, {app.state}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Applied {app.createdAt?.toDate
                  ? formatDistanceToNow(app.createdAt.toDate(), { addSuffix: true })
                  : "recently"}
              </p>
            </div>

            {/* Expand toggle */}
            <button
              onClick={() => setExpandedId(expanded ? null : app.id)}
              className="shrink-0 p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
              title={expanded ? "Collapse" : "View full details"}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>

          {/* Quick info pills */}
          <div className="flex flex-wrap gap-2">
            <span className="flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded-full">
              <Phone className="h-3 w-3" /> {app.phone}
            </span>
            <span className="flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded-full">
              <Clock className="h-3 w-3" /> {app.operatingHours}
            </span>
            <span className="flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded-full">
              <Package className="h-3 w-3" /> Up to {app.storageCapacity} parcels
            </span>
          </div>

          {/* Expanded full details */}
          {expanded && (
            <div className="bg-muted/40 rounded-xl p-4 space-y-3 border border-border">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Full Application Details</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <DetailRow icon={Store}    label="Store / Location Name" value={app.storeName} />
                <DetailRow icon={User}     label="Applicant Name"        value={app.userName} />
                <DetailRow icon={Mail}     label="Email"                 value={app.userEmail} />
                <DetailRow icon={Phone}    label="Phone"                 value={app.phone} />
                <DetailRow icon={MapPin}   label="Full Address"          value={app.storeAddress} />
                <DetailRow icon={MapPin}   label="City / Area"           value={app.city} />
                <DetailRow icon={MapPin}   label="LGA"                   value={app.lga} />
                <DetailRow icon={MapPin}   label="State"                 value={app.state} />
                <DetailRow icon={Clock}    label="Operating Hours"       value={app.operatingHours} />
                <DetailRow icon={Package}  label="Max Storage Capacity"  value={app.storageCapacity ? `${app.storageCapacity} parcels` : undefined} />
                <DetailRow icon={Hash}     label="User ID"               value={app.userId} />
                <DetailRow icon={Calendar} label="Applied"               value={app.createdAt?.toDate ? app.createdAt.toDate().toLocaleString() : undefined} />
              </div>
              {app.about && (
                <div className="pt-1">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Additional Notes</p>
                  <p className="text-sm text-muted-foreground italic bg-white rounded-lg px-3 py-2 border">"{app.about}"</p>
                </div>
              )}
              {app.status === "rejected" && app.rejectReason && (
                <div className="pt-1">
                  <p className="text-[10px] uppercase tracking-wide text-red-500 mb-1">Rejection Reason</p>
                  <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 border border-red-100">{app.rejectReason}</p>
                </div>
              )}
              {app.status === "approved" && app.approvedAt && (
                <div className="flex items-center gap-1 text-xs text-emerald-600">
                  <CheckCircle className="h-3.5 w-3.5" />
                  Approved {formatDistanceToNow(app.approvedAt.toDate(), { addSuffix: true })}
                </div>
              )}
            </div>
          )}

          {/* Action buttons — only on pending */}
          {isPending && (
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white flex-1"
                onClick={() => openApprove(app)}
                disabled={processing === app.id}
              >
                {processing === app.id
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <><CheckCircle className="h-3.5 w-3.5 mr-1" /> Approve</>}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-red-200 text-red-600 hover:bg-red-50 flex-1"
                onClick={() => openReject(app)}
                disabled={processing === app.id}
              >
                <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-7 w-7 animate-spin text-primary" />
    </div>
  )

  return (
    <div className="container max-w-3xl py-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" /> ZLA Applications
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Review, approve, or reject Zamorax Logistics Agent applications.
          </p>
        </div>
        {pending.length > 0 && (
          <div className="shrink-0 bg-amber-100 text-amber-800 text-sm font-semibold px-3 py-1.5 rounded-full">
            {pending.length} pending
          </div>
        )}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Pending",  value: pending.length,  color: "text-amber-600",  bg: "bg-amber-50  border-amber-200" },
          { label: "Approved", value: approved.length, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
          { label: "Rejected", value: rejected.length, color: "text-red-600",    bg: "bg-red-50    border-red-200" },
        ].map(s => (
          <Card key={s.label} className={`border ${s.bg}`}>
            <CardContent className="p-3 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="pending">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="pending">
            Pending
            {pending.length > 0 && (
              <span className="ml-1.5 bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{pending.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved">Approved ({approved.length})</TabsTrigger>
          <TabsTrigger value="rejected">Rejected ({rejected.length})</TabsTrigger>
        </TabsList>

        {([ ["pending", pending], ["approved", approved], ["rejected", rejected] ] as Array<[string, any[]]>).map(([tab, list]) => (
          <TabsContent key={tab} value={tab} className="mt-4 space-y-3">
            {list.length === 0 ? (
              <div className="border border-dashed rounded-xl py-12 text-center text-muted-foreground text-sm">
                No {tab} applications.
              </div>
            ) : (
              list.map(app => <AppCard key={app.id} app={app} />)
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* ── Approve dialog ── */}
      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-600" /> Approve ZLA Application
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 py-2">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-1">
                <p className="font-semibold text-sm">{selected.storeName}</p>
                <p className="text-xs text-muted-foreground">{selected.userName} · {selected.userEmail}</p>
                <p className="text-xs text-muted-foreground">{selected.storeAddress}, {selected.state}</p>
                <p className="text-xs text-muted-foreground">{selected.phone}</p>
              </div>
              <div className="space-y-1.5">
                <Label>Max capacity (parcels)</Label>
                <Input
                  type="number" min={5} max={500}
                  value={capacity}
                  onChange={e => setCapacity(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Applicant requested: {selected.storageCapacity}</p>
              </div>
              <div className="space-y-1.5">
                <Label>Operating hours</Label>
                <Input
                  value={hours}
                  onChange={e => setHours(e.target.value)}
                  placeholder="Mon–Sat 8am–6pm"
                />
                <p className="text-xs text-muted-foreground">Applicant stated: {selected.operatingHours}</p>
              </div>
              <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
                <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                This will create the agent location record and send the applicant an approval notification immediately.
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveOpen(false)}>Cancel</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleApprove}
              disabled={!!processing}
            >
              {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle className="h-3.5 w-3.5 mr-1.5" /> Confirm Approve</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reject dialog ── */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" /> Reject Application
            </DialogTitle>
          </DialogHeader>
          {rejectTarget && (
            <div className="space-y-4 py-2">
              <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-0.5">
                <p className="font-semibold">{rejectTarget.storeName}</p>
                <p className="text-xs text-muted-foreground">{rejectTarget.userName} · {rejectTarget.state}</p>
              </div>
              <div className="space-y-1.5">
                <Label>Reason for rejection <span className="text-muted-foreground font-normal">(optional but recommended)</span></Label>
                <Textarea
                  placeholder="e.g. Address could not be verified. Please reapply with a clearer location description."
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  rows={3}
                  maxLength={300}
                />
                <p className="text-xs text-muted-foreground">The applicant will see this reason in their notification.</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!!processing}
            >
              {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <><XCircle className="h-3.5 w-3.5 mr-1.5" /> Confirm Reject</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
