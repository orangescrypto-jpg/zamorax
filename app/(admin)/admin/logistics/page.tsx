"use client"
import { toDate } from "@/lib/toDate"
import {AdminService, query, orderBy, onSnapshot, serverTimestamp} from "@/src/services"
// app/(admin)/admin/logistics/page.tsx
// NEW: Admin manages agent locations + views all shipments

import { useEffect, useState } from "react"
import { useToast } from "@/components/ui/use-toast"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { SHIPMENT_STATUS_CONFIG, type AgentLocation, type ZamoraxShipment } from "@/src/types"
import { formatDistanceToNow } from "date-fns"
import {
  Plus, Loader2, Truck,
} from "lucide-react"

const NIGERIAN_STATES = [
  "Lagos","Abuja (FCT)","Rivers","Ogun","Oyo","Kano","Kaduna",
  "Anambra","Enugu","Delta","Edo","Imo","Abia","Benue","Kwara",
  "Osun","Ekiti","Ondo","Bayelsa","Cross River","Akwa Ibom",
  "Kogi","Niger","Plateau","Nasarawa","Taraba","Adamawa",
  "Borno","Yobe","Gombe","Bauchi","Sokoto","Zamfara","Kebbi","Jigawa","Katsina",
]

export default function AdminLogisticsPage() {
  const { toast } = useToast()
  const [agents, setAgents]     = useState<AgentLocation[]>([])
  const [shipments, setShipments] = useState<ZamoraxShipment[]>([])
  const [loading, setLoading]   = useState(true)
  const [addOpen, setAddOpen]   = useState(false)
  const [saving, setSaving]     = useState(false)

  // Stats
  const [stats, setStats] = useState({
    totalAgents: 0, activeAgents: 0,
    totalShipments: 0, inTransit: 0, delivered: 0,
  })

  // New agent form
  const [form, setForm] = useState({
    name: "", agentUserId: "", agentName: "", agentPhone: "",
    address: "", state: "", city: "", lga: "",
    operatingHours: "Mon–Sat 8am–6pm", maxCapacity: 20,
  })

  useEffect(() => {
    const agentUnsub = AdminService.subscribeToCollection("agentLocations", docs => {
        const list = docs.map(d => ({ ...d } as AgentLocation))
        setAgents(list)
        setStats(s => ({
          ...s,
          totalAgents: list.length,
          activeAgents: list.filter(a => a.isActive).length,
        }, [orderBy("state")]))
        setLoading(false)
      }, () => setLoading(false)
    )

    const shipUnsub = AdminService.subscribeToCollection("shipments", docs => {
        const list = docs.map(d => ({ ...d } as ZamoraxShipment))
        setShipments(list)
        setStats(s => ({
          ...s,
          totalShipments: list.length,
          inTransit: list.filter(s => !["delivered", "returned", "failed_delivery"].includes(s.status)).length,
          delivered: list.filter(s => s.status === "delivered").length,
        }, [orderBy("createdAt", "desc")]))
      }, () => {}
    )

    return () => { agentUnsub(); shipUnsub() }
  }, [])

  const handleAddAgent = async () => {
    if (!form.name || !form.agentName || !form.state || !form.address || !form.agentPhone) {
      toast({ title: "Fill in all required fields", variant: "destructive" }); return
    }
    setSaving(true)
    try {
      await AdminService.addDoc("agentLocations", {
        ...form,
        isActive: true,
        currentLoad: 0,
        type: "zamorax_agent",
        lat: 0, lng: 0,      // update with real coords later
        createdAt: serverTimestamp(),
      })
      toast({ title: "Agent location added!", variant: "success" })
      setAddOpen(false)
      setForm({
        name: "", agentUserId: "", agentName: "", agentPhone: "",
        address: "", state: "", city: "", lga: "",
        operatingHours: "Mon–Sat 8am–6pm", maxCapacity: 20,
      })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally { setSaving(false) }
  }

  const toggleAgent = async (agentId: string, isActive: boolean) => {
    await AdminService.updateDoc("agentLocations", agentId, { isActive: !isActive })
    toast({ title: `Agent ${!isActive ? "activated" : "deactivated"}`, variant: "success" })
  }

  const updateShipmentStatus = async (shipmentId: string, newStatus: string) => {
    await AdminService.updateDoc("shipments", shipmentId, {
      status: newStatus,
      updatedAt: serverTimestamp(),
    })
    toast({ title: "Shipment updated", variant: "success" })
  }

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )

  return (
    <div className="container max-w-5xl py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <Truck className="h-6 w-6 text-primary" /> Zamorax Logistics
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Manage agent network and track all shipments.</p>
        </div>
        <Button className="bg-primary text-white" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Add Agent Location
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total Agents",    value: stats.totalAgents,    color: "text-primary" },
          { label: "Active Agents",   value: stats.activeAgents,   color: "text-emerald-600" },
          { label: "Total Shipments", value: stats.totalShipments, color: "text-blue-600" },
          { label: "In Transit",      value: stats.inTransit,      color: "text-amber-600" },
          { label: "Delivered",       value: stats.delivered,      color: "text-green-600" },
        ].map(s => (
          <Card key={s.label}><CardContent className="p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </CardContent></Card>
        ))}
      </div>

      <Tabs defaultValue="agents">
        <TabsList>
          <TabsTrigger value="agents">Agent Locations ({agents.length})</TabsTrigger>
          <TabsTrigger value="shipments">All Shipments ({shipments.length})</TabsTrigger>
        </TabsList>

        {/* Agents tab */}
        <TabsContent value="agents" className="mt-4 space-y-3">
          {agents.length === 0 ? (
            <div className="border border-dashed rounded-xl py-12 text-center text-muted-foreground">
              No agent locations yet. Add your first agent to enable Zamorax Logistics.
            </div>
          ) : (
            // Group by state
            Object.entries(
              agents.reduce((acc, a) => {
                ;(acc[a.state] ??= []).push(a)
                return acc
              }, {} as Record<string, AgentLocation[]>)
            ).map(([state, stateAgents]) => (
              <div key={state}>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">{state}</p>
                <div className="space-y-2">
                  {stateAgents.map(agent => (
                    <Card key={agent.id} className={!agent.isActive ? "opacity-60" : ""}>
                      <CardContent className="p-4 flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-sm">{agent.name}</p>
                            <Badge className={agent.isActive ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"}>
                              {agent.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{agent.address}</p>
                          <p className="text-xs text-muted-foreground">{agent.agentName} · {agent.agentPhone}</p>
                          <p className="text-xs text-muted-foreground">{agent.operatingHours}</p>
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <Switch
                            checked={agent.isActive}
                            onCheckedChange={() => toggleAgent(agent.id, agent.isActive)}
                          />
                          <p className="text-xs text-muted-foreground">{agent.currentLoad || 0}/{agent.maxCapacity} parcels</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))
          )}
        </TabsContent>

        {/* Shipments tab */}
        <TabsContent value="shipments" className="mt-4 space-y-3">
          {shipments.length === 0 ? (
            <div className="border border-dashed rounded-xl py-12 text-center text-muted-foreground text-sm">
              No shipments yet.
            </div>
          ) : (
            shipments.map(s => {
              const cfg = SHIPMENT_STATUS_CONFIG[s.status]
              return (
                <Card key={s.id}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{s.listingTitle}</p>
                        <p className="text-xs font-mono text-muted-foreground">{s.trackingCode}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.sellerName} → {s.buyerName} · {s.buyerState}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {s.createdAt?.toDate
                            ? formatDistanceToNow(toDate(s.createdAt), { addSuffix: true })
                            : s.createdAt
                            ? formatDistanceToNow(new Date(s.createdAt), { addSuffix: true })
                            : ""}
                        </p>
                      </div>
                      <Badge className={`${cfg.color} shrink-0 text-xs`}>{cfg.label}</Badge>
                    </div>
                    {/* Admin override status */}
                    {!["delivered", "returned"].includes(s.status) && (
                      <div className="flex gap-2 flex-wrap">
                        <Button size="sm" variant="outline" className="text-xs h-7"
                          onClick={() => updateShipmentStatus(s.id, "in_transit")}>
                          → In Transit
                        </Button>
                        <Button size="sm" variant="outline" className="text-xs h-7"
                          onClick={() => updateShipmentStatus(s.id, "at_destination_agent")}>
                          → At Agent
                        </Button>
                        <Button size="sm" variant="outline" className="text-xs h-7 text-emerald-600"
                          onClick={() => updateShipmentStatus(s.id, "delivered")}>
                          → Delivered
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })
          )}
        </TabsContent>
      </Tabs>

      {/* Add Agent Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4" /> Add Agent Location
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {[
              { key: "name",         label: "Location Name",    placeholder: "e.g. Bayo Stores — Ikeja" },
              { key: "agentName",    label: "Agent Full Name",  placeholder: "e.g. Adebayo Okonkwo" },
              { key: "agentPhone",   label: "Agent Phone",      placeholder: "e.g. 08012345678" },
              { key: "agentUserId",  label: "Agent User ID (optional)", placeholder: "Firebase uid if they have an account" },
              { key: "address",      label: "Full Address",     placeholder: "e.g. 12 Allen Avenue, Ikeja" },
              { key: "city",         label: "City / Area",      placeholder: "e.g. Ikeja" },
              { key: "lga",          label: "LGA",              placeholder: "e.g. Ikeja LGA" },
              { key: "operatingHours", label: "Operating Hours", placeholder: "Mon–Sat 8am–6pm" },
            ].map(f => (
              <div key={f.key} className="space-y-1">
                <Label>{f.label}</Label>
                <Input
                  placeholder={f.placeholder}
                  value={form[f.key as keyof typeof form]}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                />
              </div>
            ))}

            <div className="space-y-1">
              <Label>State</Label>
              <select
                value={form.state}
                onChange={e => setForm(prev => ({ ...prev, state: e.target.value }))}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Select state</option>
                {NIGERIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <Label>Max Parcels Capacity</Label>
              <Input
                type="number"
                min={1}
                value={form.maxCapacity}
                onChange={e => setForm(prev => ({ ...prev, maxCapacity: parseInt(e.target.value) || 20 }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button className="bg-primary text-white" onClick={handleAddAgent} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-1" /> Add Agent</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

