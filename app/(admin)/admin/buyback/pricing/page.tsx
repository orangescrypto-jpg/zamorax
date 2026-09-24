// app/(admin)/admin/buyback/pricing/page.tsx
"use client"

import { useEffect, useState, useCallback } from "react"
import { AdminService } from "@/src/services/admin"
import { useToast } from "@/components/ui/use-toast"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Trash2, Plus, Loader2 } from "lucide-react"

const CATEGORIES = [
  { value: "phones-tablets", label: "Phones & Tablets" },
  { value: "computing", label: "Computers" },
  { value: "electronics", label: "Electronics" },
]
const CONDITIONS = ["flawless", "good", "fair", "cracked", "not_working"]

interface PricingRow {
  id: string
  category_slug: string
  brand: string
  model: string
  storage_variant: string | null
  condition: string
  price: number
  is_active: number
}

export default function AdminBuybackPricingPage() {
  const { toast } = useToast()
  const [rows, setRows] = useState<PricingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [category, setCategory] = useState("phones-tablets")
  const [brand, setBrand] = useState("")
  const [model, setModel] = useState("")
  const [storage, setStorage] = useState("")
  const [condition, setCondition] = useState("flawless")
  const [price, setPrice] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await AdminService.getCollection("buybackPricing") as unknown as PricingRow[]
      setRows((data ?? []).sort((a, b) =>
        a.category_slug.localeCompare(b.category_slug) ||
        a.brand.localeCompare(b.brand) ||
        a.model.localeCompare(b.model),
      ))
    } catch (err) {
      toast({ title: "Failed to load pricing", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  const addRow = async () => {
    if (!brand.trim() || !model.trim() || !price || isNaN(Number(price))) {
      toast({ title: "Fill in brand, model, and a valid price", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      await AdminService.addDoc("buybackPricing", {
        category_slug: category,
        brand: brand.trim(),
        model: model.trim(),
        storage_variant: storage.trim() || null,
        condition,
        price: Math.round(Number(price)),
        is_active: 1,
      })
      setBrand(""); setModel(""); setStorage(""); setPrice("")
      toast({ title: "Pricing added" })
      load()
    } catch {
      toast({ title: "Could not add pricing", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (row: PricingRow) => {
    try {
      await AdminService.updateDoc("buybackPricing", row.id, { is_active: row.is_active ? 0 : 1 })
      load()
    } catch {
      toast({ title: "Could not update", variant: "destructive" })
    }
  }

  const removeRow = async (id: string) => {
    try {
      await AdminService.deleteDoc("buybackPricing", id)
      load()
    } catch {
      toast({ title: "Could not delete", variant: "destructive" })
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Sell for Cash: Pricing</h1>
        <p className="text-sm text-muted-foreground">
          These prices power the instant estimate on the Sell for Cash page. Moderators can view this list but only admin can edit it.
        </p>
      </div>

      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Brand</Label>
              <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Samsung" />
            </div>
            <div className="space-y-1.5">
              <Label>Model</Label>
              <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Galaxy A13" />
            </div>
            <div className="space-y-1.5">
              <Label>Storage (optional)</Label>
              <Input value={storage} onChange={(e) => setStorage(e.target.value)} placeholder="128GB" />
            </div>
            <div className="space-y-1.5">
              <Label>Condition</Label>
              <Select value={condition} onValueChange={setCondition}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONDITIONS.map(c => <SelectItem key={c} value={c}>{c.replace("_", " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Price (₦)</Label>
              <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="60000" />
            </div>
          </div>
          <Button onClick={addRow} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            Add Pricing Row
          </Button>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <div className="space-y-2">
          {rows.map(row => (
            <Card key={row.id}>
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="text-sm">
                  <span className="font-medium">{row.brand} {row.model}</span>
                  {row.storage_variant && <span className="text-muted-foreground"> · {row.storage_variant}</span>}
                  <span className="text-muted-foreground"> · {row.condition.replace("_", " ")}</span>
                  <div className="text-primary font-semibold">₦{Number(row.price).toLocaleString()}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={row.is_active ? "default" : "secondary"} className="cursor-pointer" onClick={() => toggleActive(row)}>
                    {row.is_active ? "Active" : "Inactive"}
                  </Badge>
                  <Button variant="ghost" size="icon" onClick={() => removeRow(row.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {rows.length === 0 && (
            <p className="text-center text-muted-foreground py-10">No pricing rows yet. Add one above.</p>
          )}
        </div>
      )}
    </div>
  )
}
