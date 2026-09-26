"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MapPin, Plus, Trash2, Loader2 } from "lucide-react"
import { nigerianStates } from "@/constants/nigerianStates"
import { useSellerAddresses } from "@/hooks/useSellerAddresses"
import { useToast } from "@/components/ui/use-toast"

// Seller's reusable pool of pickup/ship-from addresses. Listings then pick
// which of these apply per listing, and buyers see whichever one is
// nearest to them on that listing's card and detail page.
export function SellerAddressBook() {
  const { addresses, loading, addAddress, removeAddress } = useSellerAddresses()
  const { toast } = useToast()
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newState, setNewState] = useState("")
  const [newCity, setNewCity] = useState("")
  const [newLabel, setNewLabel] = useState("")

  const handleAdd = async () => {
    if (!newState || newCity.trim().length < 2) {
      toast({ title: "Add a state and city first", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      await addAddress({ state: newState, city: newCity.trim(), label: newLabel.trim() || undefined })
      setNewState("")
      setNewCity("")
      setNewLabel("")
      setAdding(false)
      toast({ title: "Address added", variant: "success" })
    } catch {
      toast({ title: "Could not save address", description: "Please try again.", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (id: string) => {
    try {
      await removeAddress(id)
    } catch {
      toast({ title: "Could not remove address", description: "Please try again.", variant: "destructive" })
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPin className="h-4 w-4 text-primary" /> Pickup Addresses
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Add every location you stock or ship from. When posting a listing, pick which of these apply, and buyers will automatically see whichever one is closest to them.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {addresses.length === 0 && !adding && (
              <p className="text-sm text-muted-foreground">No addresses added yet.</p>
            )}

            {addresses.map((addr) => (
              <div key={addr.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">
                    {addr.city}, {addr.state}
                  </p>
                  {addr.label && <p className="text-xs text-muted-foreground">{addr.label}</p>}
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleRemove(addr.id)} aria-label="Remove address">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}

            {adding ? (
              <div className="space-y-3 rounded-lg border p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-sm">State</Label>
                    <Select value={newState} onValueChange={setNewState}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {nigerianStates.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">City</Label>
                    <Input value={newCity} onChange={(e) => setNewCity(e.target.value)} placeholder="e.g. Sagamu" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Label (optional)</Label>
                  <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="e.g. Main warehouse" />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => setAdding(false)} disabled={saving}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleAdd} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Save Address
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setAdding(true)} className="gap-2">
                <Plus className="h-4 w-4" /> Add Address
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
