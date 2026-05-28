import type { Listing } from "@/src/types"
"use client"

import {AdminService, query, onSnapshot, where, serverTimestamp} from "@/src/services"
import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/useAuth"
import { formatPrice } from "@/lib/utils"
import { Users, Plus, Loader2, Share2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"
import {arrayUnion} from "@/src/services"

const GROUP_SIZE = 5
const GROUP_DISCOUNT = 15

export function GroupBuySection({ listing }: { listing: Listing }) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [groups, setGroups] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [showCreate, setShowCreate] = useState(false)

  const groupPrice = Math.round(listing.priceSale * (1 - GROUP_DISCOUNT / 100))

  useEffect(() => {
    const q = AdminService._ref_("groupBuys", [where("listingId", "==", listing.id]), where("status", "==", "open"))
    return onSnapshot(q, snap => setGroups(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [listing.id])

  const createGroup = async () => {
    if (!user) return
    setLoading(true)
    try {
      await AdminService.addDoc("groupBuys", {
        listingId: listing.id, listingTitle: listing.title,
        listingImage: listing.images?.[0] || "",
        originalPrice: listing.priceSale, groupPrice,
        sellerId: listing.sellerId, creatorId: user.uid,
        members: [user.uid], memberNames: [user.fullName || "You"],
        status: "open", expiresAt: new Date(Date.now() + 48 * 3600000),
        createdAt: serverTimestamp() })
      toast({ title: "Group Buy Created! 🎉", description: "Need 4 more buyers.", variant: "success" })
      setShowCreate(false)
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }) }
    finally { setLoading(false) }
  }

  const joinGroup = async (groupId: string, group: Record<string, unknown>) => {
    if (!user) return
    if (group.members.includes(user.uid)) { toast({ title: "Already in this group", variant: "destructive" }); return }
    setLoading(true)
    try {
      const newCount = group.members.length + 1
      await AdminService.updateDoc("groupBuys", groupId, {
        members: arrayUnion(user.uid),
        memberNames: [...group.memberNames, user.fullName || "Buyer"],
        status: newCount >= GROUP_SIZE ? "filled" : "open" })
      toast({ title: newCount >= GROUP_SIZE ? "Group Complete! 🎉" : `Joined! ${GROUP_SIZE - newCount} more needed.`, variant: "success" })
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }) }
    finally { setLoading(false) }
  }

  const copyLink = (groupId: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/group-buy/${groupId}`)
    toast({ title: "Link copied! Share with friends." })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <span className="font-semibold">Group Buy</span>
          <Badge className="bg-green-100 text-green-800">{GROUP_DISCOUNT}% off</Badge>
        </div>
        <span className="text-xs text-muted-foreground">{GROUP_SIZE} buyers needed</span>
      </div>

      <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-sm">
        <p className="font-medium text-green-800">Pool with {GROUP_SIZE - 1} others → pay {formatPrice(groupPrice)} each</p>
        <p className="text-xs text-green-600">Save {formatPrice(listing.priceSale - groupPrice)} per person!</p>
      </div>

      {groups.map(g => (
        <Card key={g.id}><CardContent className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              {Array.from({ length: GROUP_SIZE }).map((_, i) => (
                <div key={i} className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${i < g.members.length ? "bg-primary text-white border-primary" : "bg-muted border-border"}`}>
                  {i < g.members.length ? (g.memberNames[i]?.[0] || "?") : "+"}
                </div>
              ))}
              <span className="ml-2 text-xs text-muted-foreground">{g.members.length}/{GROUP_SIZE}</span>
            </div>
            <Badge className="bg-amber-100 text-amber-800 text-xs">{GROUP_SIZE - g.members.length} left</Badge>
          </div>
          <div className="flex gap-2">
            {!g.members.includes(user?.uid || "") && (
              <Button size="sm" className="flex-1 bg-green-600 text-white hover:bg-green-700" onClick={() => joinGroup(g.id, g)} disabled={loading}>
                <Users className="h-3 w-3 mr-1" /> Join
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => copyLink(g.id)}>
              <Share2 className="h-3 w-3" />
            </Button>
          </div>
        </CardContent></Card>
      ))}

      <Button variant="outline" className="w-full border-dashed border-primary text-primary" onClick={() => setShowCreate(true)}>
        <Plus className="h-4 w-4 mr-2" /> Start New Group Buy
      </Button>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" />Start Group Buy</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="text-center p-4 bg-green-50 rounded-xl space-y-1">
              <p className="text-xs text-muted-foreground">Each person pays</p>
              <p className="text-3xl font-bold text-green-700">{formatPrice(groupPrice)}</p>
              <p className="text-xs line-through text-muted-foreground">{formatPrice(listing.priceSale)}</p>
              <Badge className="bg-green-100 text-green-800">{GROUP_SIZE} people • 48hr window</Badge>
            </div>
            <p className="text-sm text-muted-foreground text-center">You'll be the first member. Share the link to fill the group.</p>
            <Button className="w-full bg-primary text-white" onClick={createGroup} disabled={loading || !user}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Users className="h-4 w-4 mr-2" />}
              Create Group Buy
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
