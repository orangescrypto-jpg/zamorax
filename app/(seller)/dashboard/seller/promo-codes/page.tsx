"use client"
// app/(seller)/dashboard/seller/promo-codes/page.tsx
// Seller promo code management — create, view, deactivate codes for their store.
// Gated by settings.promoCodesEnabled via usePlatformSettings.

import { AdminService, serverTimestamp, where, orderBy } from "@/src/services"
import { usePlatformSettings } from "@/hooks/usePlatformSettings"
import { useAuth } from "@/hooks/useAuth"
import { useToast } from "@/components/ui/use-toast"
import { useState, useEffect } from "react"
import { formatPrice } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tag, Plus, Loader2, Copy, ToggleLeft, ToggleRight, ShoppingBag } from "lucide-react"

interface PromoCode {
  id: string
  code: string
  sellerId: string
  discountType: "percent" | "fixed"
  discountValue: number
  minOrderValue: number
  maxUses: number
  usedCount: number
  expiresAt: any
  active: boolean
  createdAt: any
}

export default function SellerPromoCodesPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const { settings, loading: settingsLoading } = usePlatformSettings()

  const [codes, setCodes]       = useState<PromoCode[]>([])
  const [loading, setLoading]   = useState(true)
  const [open, setOpen]         = useState(false)
  const [creating, setCreating] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)

  // Form state
  const [code,           setCode]           = useState("")
  const [discountType,   setDiscountType]   = useState<"percent" | "fixed">("percent")
  const [discountValue,  setDiscountValue]  = useState("")
  const [minOrder,       setMinOrder]       = useState("")
  const [maxUses,        setMaxUses]        = useState("100")
  const [expiryDays,     setExpiryDays]     = useState("30")

  useEffect(() => {
    if (!user?.uid) return
    AdminService.getCollection("promoCodes", [
      where("sellerId", "==", user.uid),
      orderBy("createdAt", "desc"),
    ]).then(snap => {
      setCodes(snap as PromoCode[])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [user?.uid])

  const generateCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    const random = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
    setCode(`${(user?.storeName || "STORE").toUpperCase().slice(0, 4)}${random}`)
  }

  const handleCreate = async () => {
    if (!user?.uid) return
    if (!code.trim())         { toast({ title: "Enter a promo code", variant: "destructive" }); return }
    if (!discountValue || Number(discountValue) <= 0) { toast({ title: "Enter a valid discount", variant: "destructive" }); return }
    if (discountType === "percent" && Number(discountValue) > 80) { toast({ title: "Max discount is 80%", variant: "destructive" }); return }

    setCreating(true)
    try {
      const expiresAt = new Date(Date.now() + Number(expiryDays) * 86_400_000)
      const doc = await AdminService.addDoc("promoCodes", {
        code:          code.trim().toUpperCase(),
        sellerId:      user.uid,
        sellerName:    user.storeName || user.fullName || "",
        discountType,
        discountValue: Number(discountValue),
        minOrderValue: Number(minOrder) || 0,
        maxUses:       Number(maxUses) || 100,
        usedCount:     0,
        expiresAt,
        active:        true,
        createdAt:     serverTimestamp(),
      })
      setCodes(prev => [{ id: doc.id ?? "", code: code.trim().toUpperCase(), sellerId: user.uid, discountType, discountValue: Number(discountValue), minOrderValue: Number(minOrder) || 0, maxUses: Number(maxUses) || 100, usedCount: 0, expiresAt, active: true, createdAt: new Date() }, ...prev])
      toast({ title: "Promo code created! 🎉", variant: "success" })
      setOpen(false)
      setCode(""); setDiscountValue(""); setMinOrder(""); setMaxUses("100"); setExpiryDays("30")
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally { setCreating(false) }
  }

  const handleToggle = async (promo: PromoCode) => {
    setToggling(promo.id)
    try {
      await AdminService.updateDoc("promoCodes", promo.id, { active: !promo.active, updatedAt: serverTimestamp() })
      setCodes(prev => prev.map(p => p.id === promo.id ? { ...p, active: !p.active } : p))
    } catch { toast({ title: "Failed to update", variant: "destructive" }) }
    finally { setToggling(null) }
  }

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    toast({ title: "Code copied!", variant: "success" })
  }

  if (settingsLoading || loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>

  if (!settings.promoCodesEnabled) return (
    <div className="flex flex-col items-center gap-3 py-20 text-center px-4">
      <Tag className="h-12 w-12 text-muted-foreground opacity-25" />
      <p className="font-semibold">Promo Codes Coming Soon</p>
      <p className="text-sm text-muted-foreground">This feature isn't available yet.</p>
    </div>
  )

  return (
    <div className="container py-8 max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2"><Tag className="h-6 w-6 text-primary" /> Promo Codes</h1>
          <p className="text-sm text-muted-foreground mt-1">Create discount codes for your store.</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" /> Create Code</Button>
      </div>

      {codes.length === 0 ? (
        <Card><CardContent className="py-16 text-center space-y-3">
          <Tag className="h-12 w-12 mx-auto text-muted-foreground/30" />
          <p className="font-semibold">No promo codes yet</p>
          <p className="text-sm text-muted-foreground">Create your first code to offer discounts to buyers.</p>
          <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" /> Create Code</Button>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {codes.map(promo => {
            const expired = promo.expiresAt && new Date(promo.expiresAt?.toDate?.() ?? promo.expiresAt) < new Date()
            const exhausted = promo.usedCount >= promo.maxUses
            return (
              <Card key={promo.id}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-base tracking-widest text-primary">{promo.code}</span>
                      <button onClick={() => copyCode(promo.code)} className="text-muted-foreground hover:text-primary">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      {!promo.active || expired || exhausted ? (
                        <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>
                      ) : (
                        <Badge className="bg-emerald-100 text-emerald-800">Active</Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {promo.discountType === "percent" ? `${promo.discountValue}% off` : `${formatPrice(promo.discountValue)} off`}
                      </span>
                      {promo.minOrderValue > 0 && <span>Min order: {formatPrice(promo.minOrderValue)}</span>}
                      <span>{promo.usedCount}/{promo.maxUses} uses</span>
                      {promo.expiresAt && <span>Expires {new Date(promo.expiresAt?.toDate?.() ?? promo.expiresAt).toLocaleDateString()}</span>}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggle(promo)}
                    disabled={toggling === promo.id || expired || exhausted}
                    className={promo.active ? "text-emerald-600" : "text-muted-foreground"}
                  >
                    {toggling === promo.id
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : promo.active ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Tag className="h-4 w-4 text-primary" /> Create Promo Code</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Code</Label>
              <div className="flex gap-2">
                <Input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="e.g. SAVE20" className="font-mono tracking-widest" />
                <Button type="button" variant="outline" size="sm" onClick={generateCode}>Generate</Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={discountType} onValueChange={v => setDiscountType(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percent (%)</SelectItem>
                    <SelectItem value="fixed">Fixed (₦)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Value</Label>
                <Input type="number" value={discountValue} onChange={e => setDiscountValue(e.target.value)} placeholder={discountType === "percent" ? "e.g. 20" : "e.g. 500"} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Min order (₦)</Label>
                <Input type="number" value={minOrder} onChange={e => setMinOrder(e.target.value)} placeholder="0 = no min" />
              </div>
              <div className="space-y-1.5">
                <Label>Max uses</Label>
                <Input type="number" value={maxUses} onChange={e => setMaxUses(e.target.value)} placeholder="100" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Expires in (days)</Label>
              <Input type="number" value={expiryDays} onChange={e => setExpiryDays(e.target.value)} placeholder="30" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
