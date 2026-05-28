"use client"

import {AdminService, query, onSnapshot, where, serverTimestamp} from "@/src/services"
// app/(moderator)/moderator/logistics/zlas/page.tsx
// Moderator views all ZLAs, flags underperformers, pauses them, leaves notes for admin

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useToast } from "@/components/ui/use-toast"
import { formatDistanceToNow } from "date-fns"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import {
  Package, Loader2, Flag, PauseCircle, PlayCircle,
  MapPin, Phone, Clock, AlertTriangle, Search,
  CheckCircle, Star } from "lucide-react"

export default function ModeratorZLAsPage() {
  const { user }  = useAuth()
  const { toast } = useToast()

  const [agents, setAgents]       = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState("")
  const [processing, setProcessing] = useState<string | null>(null)

  // Flag dialog
  const [flagOpen, setFlagOpen]   = useState(false)
  const [flagAgent, setFlagAgent] = useState<any>(null)
  const [flagReason, setFlagReason] = useState("")

  // Enriched stats per agent
  const [agentStats, setAgentStats] = useState<Record<string, {
    activeParcels: number
    deliveredTotal: number
    staleCount: number
    complaints: number
  }>>({})

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection( "agentLocations")),
      async docs => {
        const list = docs.docs.map(d => ({ id: d.id, ...d.data() })
        setAgents(list)
        setLoading(false)

        // Load stats for each agent
        const STALE_HOURS = 48
        const staleThreshold = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000)

        const statsMap: typeof agentStats = {}
        await Promise.all(list.map(async agent => {
          const [activeSnap, deliveredSnap, disputeSnap] = await Promise.all([
            AdminService._ref_("shipments", [where("currentAgentId", "==", agent.id),
              where("status", "in", ["dropped_off", "in_transit", "at_destination_agent", "out_for_delivery"])]),
            AdminService._ref_("shipments", [where("currentAgentId", "==", agent.id),
              where("status", "==", "delivered")]),
            AdminService._ref_("disputes", [where("currentAgentId", "==", agent.id)]),
          ])

          // Count stale — active parcels not updated in 48h
          let staleCount = 0
          activeSnap.docs.forEach(d => {
            const updatedAt = d.updatedAt?.toDate?.()
            if (updatedAt && updatedAt < staleThreshold) staleCount++
          })

          statsMap[agent.id] = {
            activeParcels:  activeSnap.size,
            deliveredTotal: deliveredSnap.size,
            staleCount,
            complaints:     disputeSnap.size }
        }))
        setAgentStats(statsMap)
      },
      () => setLoading(false)
    )
    return unsub
  }, [])

  const handleFlag = async () => {
    if (!flagAgent || !flagReason.trim()) return
    setProcessing(flagAgent.id)
    try {
      await AdminService.updateDoc("agentLocations", flagAgent.id, {
        isFlagged:      true,
        flaggedBy:      user?.uid,
        flaggedAt:      serverTimestamp(),
        flagReason:     flagReason.trim(),
        updatedAt:      serverTimestamp() })

      // Notify admin
      await AdminService.addDoc("notifications", {
        userId:    "admin",
        type:      "system",
        title:     `⚠️ ZLA Flagged: ${flagAgent.name}`,
        body:      `Moderator flagged this ZLA for: ${flagReason.trim()}`,
        link:      "/admin/logistics",
        read:      false,
        createdAt: serverTimestamp() })

      toast({ title: `${flagAgent.name} flagged for admin review`, variant: "success" })
      setFlagOpen(false)
      setFlagReason("")
      setFlagAgent(null)
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally { setProcessing(null) }
  }

  const handlePauseToggle = async (agent: Record<string, unknown>) => {
    setProcessing(agent.id)
    try {
      const newState = !agent.isActive
      await AdminService.updateDoc("agentLocations", agent.id, {
        isActive:    newState,
        pausedBy:    newState ? null : user?.uid,
        pausedAt:    newState ? null : serverTimestamp(),
        updatedAt:   serverTimestamp() })

      // Notify admin of the pause
      if (!newState) {
        await AdminService.addDoc("notifications", {
          userId:    "admin",
          type:      "system",
          title:     `⏸ ZLA Paused: ${agent.name}`,
          body:      `Moderator temporarily paused this ZLA. Review recommended.`,
          link:      "/admin/logistics",
          read:      false,
          createdAt: serverTimestamp() })
      }

      toast({
        title: newState ? `${agent.name} reactivated` : `${agent.name} paused`,
        description: newState ? "ZLA can now receive parcels." : "ZLA will not appear at checkout until reactivated.",
        variant: "success" })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally { setProcessing(null) }
  }

  const filtered = agents.filter(a =>
    !search ||
    a.name?.toLowerCase().includes(search.toLowerCase()) ||
    a.state?.toLowerCase().includes(search.toLowerCase()) ||
    a.city?.toLowerCase().includes(search.toLowerCase())
  )

  const getHealthColor = (agent: Record<string, unknown>) => {
    const stats = agentStats[agent.id]
    if (!stats) return ""
    if (agent.isFlagged) return "border-red-300"
    if (!agent.isActive) return "border-gray-300"
    if (stats.staleCount > 0 || stats.complaints > 2) return "border-amber-300"
    return "border-emerald-200"
  }

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-7 w-7 animate-spin text-primary" />
    </div>
  )

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <Package className="h-6 w-6 text-primary" /> ZLA Network Monitor
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Monitor ZLA performance. Flag issues and pause underperformers.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total ZLAs",  value: agents.length,                       color: "text-primary" },
          { label: "Active",      value: agents.filter(a => a.isActive).length, color: "text-emerald-600" },
          { label: "Flagged",     value: agents.filter(a => a.isFlagged).length, color: "text-red-600" },
        ].map(s => (
          <Card key={s.label}><CardContent className="p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </CardContent></Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, state or city..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* ZLA list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="border border-dashed rounded-xl py-12 text-center text-muted-foreground text-sm">
            No ZLAs found.
          </div>
        ) : (
          filtered.map(agent => {
            const stats = agentStats[agent.id]
            const hasIssue = stats && (stats.staleCount > 0 || stats.complaints > 2)

            return (
              <Card key={agent.id} className={`border-2 ${getHealthColor(agent)}`}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">{agent.name}</p>
                        {!agent.isActive && (
                          <Badge className="bg-gray-100 text-gray-600 text-[10px]">Paused</Badge>
                        )}
                        {agent.isFlagged && (
                          <Badge className="bg-red-100 text-red-700 text-[10px]">
                            <Flag className="h-2.5 w-2.5 mr-0.5" /> Flagged
                          </Badge>
                        )}
                        {hasIssue && agent.isActive && !agent.isFlagged && (
                          <Badge className="bg-amber-100 text-amber-700 text-[10px]">
                            <AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> Needs Attention
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {agent.address}, {agent.state}
                      </p>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {agent.agentPhone}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {agent.operatingHours}
                        </span>
                      </div>
                    </div>

                    {/* Stats */}
                    {stats && (
                      <div className="text-right shrink-0 space-y-1">
                        <p className="text-xs text-muted-foreground">
                          Active: <span className="font-semibold text-foreground">{stats.activeParcels}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Delivered: <span className="font-semibold text-emerald-600">{stats.deliveredTotal}</span>
                        </p>
                        {stats.staleCount > 0 && (
                          <p className="text-xs text-amber-600 font-semibold">
                            {stats.staleCount} stale parcel{stats.staleCount > 1 ? "s" : ""}
                          </p>
                        )}
                        {stats.complaints > 0 && (
                          <p className="text-xs text-red-500 font-semibold">
                            {stats.complaints} complaint{stats.complaints > 1 ? "s" : ""}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {agent.flagReason && (
                    <div className="text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-700">
                      <strong>Flag reason:</strong> {agent.flagReason}
                    </div>
                  )}

                  <div className="flex gap-2 flex-wrap">
                    {/* Call agent */}
                    <Button size="sm" variant="ghost" asChild>
                      <a href={`tel:${agent.agentPhone}`}>
                        <Phone className="h-3.5 w-3.5 mr-1" /> Call
                      </a>
                    </Button>

                    {/* Flag for admin */}
                    {!agent.isFlagged && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-amber-300 text-amber-700 hover:bg-amber-50"
                        onClick={() => { setFlagAgent(agent); setFlagOpen(true) }}
                        disabled={processing === agent.id}
                      >
                        <Flag className="h-3.5 w-3.5 mr-1" /> Flag for Admin
                      </Button>
                    )}

                    {/* Pause / Resume */}
                    <Button
                      size="sm"
                      variant="outline"
                      className={agent.isActive
                        ? "border-red-200 text-red-600 hover:bg-red-50"
                        : "border-emerald-300 text-emerald-600 hover:bg-emerald-50"
                      }
                      onClick={() => handlePauseToggle(agent)}
                      disabled={processing === agent.id}
                    >
                      {processing === agent.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : agent.isActive
                          ? <><PauseCircle className="h-3.5 w-3.5 mr-1" /> Pause</>
                          : <><PlayCircle className="h-3.5 w-3.5 mr-1" /> Reactivate</>
                      }
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* Flag Dialog */}
      <Dialog open={flagOpen} onOpenChange={v => { setFlagOpen(v); if (!v) { setFlagReason(""); setFlagAgent(null) } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="h-4 w-4 text-amber-600" /> Flag ZLA for Admin Review
            </DialogTitle>
            <DialogDescription>
              Admin will be notified. The ZLA stays active until admin decides to deactivate.
            </DialogDescription>
          </DialogHeader>
          {flagAgent && (
            <div className="space-y-4 py-2">
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <p className="font-semibold">{flagAgent.name}</p>
                <p className="text-muted-foreground text-xs">{flagAgent.address}, {flagAgent.state}</p>
              </div>
              <Textarea
                placeholder="Describe the issue — e.g. Parcels stuck for 5+ days, buyer complaints about missing items, unresponsive to calls..."
                value={flagReason}
                onChange={e => setFlagReason(e.target.value)}
                rows={4}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setFlagOpen(false)}>Cancel</Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={handleFlag}
              disabled={!flagReason.trim() || !!processing}
            >
              {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Flag className="h-3.5 w-3.5 mr-1.5" /> Flag ZLA</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
