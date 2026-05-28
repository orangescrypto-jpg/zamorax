"use client"

import { AdminService , collection , serverTimestamp } from "@/src/services"
// components/admin/FBZWarehouseLocations.tsx
// Admin can add multiple FBZ drop-off locations.
// Sellers pick the nearest one when submitting stock.
// Saves to: fbzWarehouses collection (one doc per location)

import { useEffect, useState } from "react"
import { useToast } from "@/components/ui/use-toast"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter
} from "@/components/ui/dialog"
import { addDoc, deleteDoc, doc, updateDoc } from "@/src/services"
import {
  Warehouse, Plus, Pencil, Trash2, MapPin,
  Phone, Clock, Loader2, CheckCircle
} from "lucide-react"

export interface FBZWarehouse {
  id: string
  name: string          // e.g. "Lagos Hub (Surulere)"
  address: string
  phone: string
  hours: string
  state: string         // Nigerian state — used for "nearest to you" matching
  city: string
  isActive: boolean
  currentStock: number  // auto-updated when shipments arrive
  capacity: number
  createdAt: string
}

const EMPTY: Omit<FBZWarehouse, "id" | "createdAt" | "currentStock"> = {
  name: "", address: "", phone: "", hours: "Mon–Sat, 9am–5pm",
  state: "", city: "", isActive: true, capacity: 500,
}

export function FBZWarehouseLocations() {
  const { toast } = useToast()
  const [warehouses, setWarehouses] = useState<FBZWarehouse[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<FBZWarehouse | null>(null)
  const [form, setForm] = useState({ ...EMPTY })
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    const unsub = AdminService.subscribeToCollection("fbzWarehouses", 
      docs => {
        setWarehouses(docs.map(d => ({ ...d } as FBZWarehouse)))
        setLoading(false)
      },
      () => setLoading(false)
    )
    return unsub
  }, [])

  const openAdd = () => {
    setEditing(null)
    setForm({ ...EMPTY })
    setDialogOpen(true)
  }

  const openEdit = (w: FBZWarehouse) => {
    setEditing(w)
    setForm({
      name: w.name, address: w.address, phone: w.phone,
      hours: w.hours, state: w.state, city: w.city,
      isActive: w.isActive, capacity: w.capacity,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.name || !form.address || !form.state || !form.city) {
      toast({ title: "Fill in all required fields", variant: "destructive" }); return
    }
    setSaving(true)
    try {
      if (editing) {
        await AdminService.updateDoc("fbzWarehouses", editing.id, {
          ...form, updatedAt: serverTimestamp(),
        })
        toast({ title: "Warehouse updated", variant: "success" })
      } else {
        await AdminService.addDoc("fbzWarehouses", {
          ...form, currentStock: 0, createdAt: serverTimestamp(),
        })
        toast({ title: "Warehouse added ✅", variant: "success" })
      }
      setDialogOpen(false)
    } catch {
      toast({ title: "Error saving warehouse", variant: "destructive" })
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await AdminService.deleteDoc("fbzWarehouses", id)
      toast({ title: "Warehouse removed", variant: "destructive" })
    } catch {
      toast({ title: "Error deleting warehouse", variant: "destructive" })
    }
    setDeletingId(null)
  }

  const handleToggleActive = async (w: FBZWarehouse) => {
    await AdminService.updateDoc("fbzWarehouses", w.id, { isActive: !w.isActive })
  }

  const update = (k: keyof typeof form, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  if (loading) return (
    <div className="flex h-32 items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-primary" />
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold flex items-center gap-1.5">
            <Warehouse className="h-4 w-4 text-primary" />
            FBZ Drop-off Locations
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Sellers choose the nearest location when submitting stock.
          </p>
        </div>
        <Button size="sm" className="bg-primary text-white" onClick={openAdd}>
          <Plus className="h-4 w-4 mr-1" /> Add Location
        </Button>
      </div>

      {warehouses.length === 0 && (
        <div className="text-center py-8 border border-dashed rounded-xl text-muted-foreground text-sm">
          No warehouse locations yet. Add one above.
        </div>
      )}

      <div className="grid gap-3">
        {warehouses.map(w => (
          <Card key={w.id} className={`transition-opacity ${w.isActive ? "" : "opacity-60"}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm">{w.name}</p>
                    <Badge className={w.isActive
                      ? "bg-emerald-100 text-emerald-700 border-0 text-xs"
                      : "bg-gray-100 text-gray-500 border-0 text-xs"
                    }>
                      {w.isActive ? "Active" : "Paused"}
                    </Badge>
                    <Badge className="bg-blue-50 text-blue-700 border-0 text-xs">
                      {w.currentStock || 0}/{w.capacity} units
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3 shrink-0" /> {w.address} · {w.city}, {w.state}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3 shrink-0" /> {w.phone}
                    <span className="mx-1">·</span>
                    <Clock className="h-3 w-3 shrink-0" /> {w.hours}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch
                    checked={w.isActive}
                    onCheckedChange={() => handleToggleActive(w)}
                    title="Toggle active"
                  />
                  <Button size="icon" variant="ghost" onClick={() => openEdit(w)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => handleDelete(w.id)}
                    disabled={deletingId === w.id}
                  >
                    {deletingId === w.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Trash2 className="h-3.5 w-3.5" />
                    }
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Warehouse className="h-5 w-5 text-primary" />
              {editing ? "Edit Warehouse Location" : "Add Warehouse Location"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Location name <span className="text-destructive">*</span></Label>
              <Input
                value={form.name}
                onChange={e => update("name", e.target.value)}
                placeholder="e.g. Lagos Hub (Surulere)"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>State <span className="text-destructive">*</span></Label>
                <Input value={form.state} onChange={e => update("state", e.target.value)} placeholder="e.g. Lagos" />
              </div>
              <div className="space-y-1">
                <Label>City <span className="text-destructive">*</span></Label>
                <Input value={form.city} onChange={e => update("city", e.target.value)} placeholder="e.g. Surulere" />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Full drop-off address <span className="text-destructive">*</span></Label>
              <Input
                value={form.address}
                onChange={e => update("address", e.target.value)}
                placeholder="e.g. 14 Bode Thomas Street, Surulere"
              />
            </div>

            <div className="space-y-1">
              <Label>Contact phone</Label>
              <Input
                value={form.phone}
                onChange={e => update("phone", e.target.value)}
                placeholder="e.g. 0801 234 5678"
              />
            </div>

            <div className="space-y-1">
              <Label>Operating hours</Label>
              <Input
                value={form.hours}
                onChange={e => update("hours", e.target.value)}
                placeholder="e.g. Mon–Sat, 9am–5pm"
              />
            </div>

            <div className="space-y-1">
              <Label>Capacity (max units)</Label>
              <Input
                type="number"
                min={1}
                value={form.capacity}
                onChange={e => update("capacity", parseInt(e.target.value))}
              />
            </div>

            <div className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-muted-foreground">Sellers can see and select this location</p>
              </div>
              <Switch checked={form.isActive} onCheckedChange={v => update("isActive", v)} />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button className="bg-primary text-white" onClick={handleSave} disabled={saving}>
              {saving
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <><CheckCircle className="h-4 w-4 mr-1.5" /> {editing ? "Save Changes" : "Add Location"}</>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
