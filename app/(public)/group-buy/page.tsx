"use client"
import type { Listing } from "@/src/types"

import { AdminService, query, onSnapshot, where, collection, serverTimestamp, arrayUnion } from "@/src/services"

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { useToast } from "@/components/ui/use-toast"
import { formatPrice } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Users, Loader2, ShoppingBag, Share2, ExternalLink } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import {DocumentData} from "@/src/services"

const GROUP_SIZE = 5
const GROUP_DISCOUNT = 15

type GroupBuy = DocumentData & { id: string; listing?: Listing }

export default function GroupBuyPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [groups, setGroups] = useState<GroupBuy[]>([])
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState<string | null>(null)

  useEffect(() => {
    // Listen to all open group buys
    const q = AdminService._ref_("groupBuys", where("status", "==", "open"))
    const unsub = onSnapshot(q, async docs => {
      type GroupBuyDoc = { id: string; listingId: string; members?: string[]; status: string; [key: string]: unknown }
      const raw: GroupBuyDoc[] = docs.docs.map(d => ({ id: d.id, ...d.data() })
      // Enrich with listing data
      const enriched = await Promise.all(raw.map(async g => {
        try {
          const listingSnap = await AdminService.getDoc("listings", g.listingId)
          return { ...g, listing: listingSnap.exists() ? { id: listingSnap.id, ...listingSnap.data() } : null }
        } catch { return { ...g, listing: null } }
      }))
      setGroups(enriched.filter(g => g.listing))
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [])

  const handleJoin = async (group: GroupBuy) => {
    if (!user?.uid) { toast({ title: "Login required", variant: "destructive" }); return }
    if (group.members?.includes(user.uid)) { toast({ title: "Already joined this group" }); return }
    setJoining(group.id)
    try {
      await AdminService.updateDocRaw("groupBuys", group.id, {
        members: arrayUnion(user.uid),
        updatedAt: serverTimestamp() })
      toast({ title: "Joined! 🎉", description: `${GROUP_SIZE - (group.members?.length || 0) - 1} more needed for the ${GROUP_DISCOUNT}% group discount.`, variant: "success" })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally { setJoining(null) }
  }

  const share = (group: GroupBuy) => {
    const url = `${window.location.origin}/listings/${group.listingId}`
    if (navigator.share) {
      navigator.share({ title: `Group Buy — ${group.listing?.title}`, text: `Join my group buy and get ${GROUP_DISCOUNT}% off!`, url })
    } else {
      navigator.clipboard.writeText(url)
      toast({ title: "Link copied!" })
    }
  }

  if (loading) return (
    <div className="flex h-[60vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )

  return (
    <main className="container max-w-3xl py-8 pb-24 space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-2">
          <Users className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-2xl font-heading font-bold">Group Buys</h1>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          Join a group of {GROUP_SIZE} buyers and unlock <strong>{GROUP_DISCOUNT}% off</strong> automatically.
          Share with friends to fill the group faster.
        </p>
      </div>

      {/* How it works */}
      <div className="grid grid-cols-3 gap-3 text-center text-xs">
        {[
          { icon: "👥", title: `Find a group of ${GROUP_SIZE}`, desc: "Join an open group below" },
          { icon: "📢", title: "Share the listing", desc: "Invite friends to join" },
          { icon: "🎉", title: `Get ${GROUP_DISCOUNT}% off`, desc: "Discount applies when group is full" },
        ].map(item => (
          <div key={item.title} className="p-3 bg-primary/5 border border-primary/10 rounded-xl">
            <p className="text-2xl mb-1">{item.icon}</p>
            <p className="font-semibold text-secondary text-[11px]">{item.title}</p>
            <p className="text-muted-foreground">{item.desc}</p>
          </div>
        ))}
      </div>

      {/* Group listing */}
      {groups.length === 0 ? (
        <div className="border border-dashed rounded-xl py-16 text-center space-y-3 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto opacity-25" />
          <p className="font-medium">No open group buys right now</p>
          <p className="text-sm">Check back soon — sellers add new group deals daily.</p>
          <Button asChild variant="outline">
            <Link href="/search"><ShoppingBag className="h-4 w-4 mr-2" /> Browse All Listings</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map(group => {
            const memberCount = group.members?.length || 0
            const spotsLeft = GROUP_SIZE - memberCount
            const progress = (memberCount / GROUP_SIZE) * 100
            const isMember = group.members?.includes(user?.uid)
            const isFull = memberCount >= GROUP_SIZE
            const discountPrice = Math.round((group.listing.priceSale || 0) * (1 - GROUP_DISCOUNT / 100))

            return (
              <Card key={group.id} className={`overflow-hidden ${isFull ? "border-accent" : ""}`}>
                <CardContent className="p-0">
                  <div className="flex gap-4 p-4">
                    {/* Listing image */}
                    <div className="w-20 h-20 rounded-xl bg-muted overflow-hidden shrink-0 relative">
                      {group.listing?.images?.[0]
                        ? <Image src={group.listing.images[0]} alt="" fill className="object-cover" />
                        : <ShoppingBag className="h-8 w-8 m-6 text-muted-foreground" />}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="font-semibold text-sm truncate">{group.listing?.title}</p>

                      {/* Price */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs line-through text-muted-foreground">{formatPrice(group.listing?.priceSale || 0)}</span>
                        <span className="font-bold text-accent">{formatPrice(discountPrice)}</span>
                        <Badge className="bg-accent/10 text-accent text-xs">{GROUP_DISCOUNT}% off</Badge>
                      </div>

                      {/* Members progress */}
                      <div className="space-y-1 pt-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {memberCount}/{GROUP_SIZE} joined
                          </span>
                          <span className={isFull ? "text-accent font-medium" : "text-amber-600"}>
                            {isFull ? "🎉 Group complete!" : `${spotsLeft} spot${spotsLeft !== 1 ? "s" : ""} left`}
                          </span>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 px-4 pb-4">
                    {!isFull && !isMember && (
                      <Button
                        className="flex-1 bg-primary hover:bg-primary/90 text-white"
                        size="sm"
                        onClick={() => handleJoin(group)}
                        disabled={joining === group.id}
                      >
                        {joining === group.id
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <><Users className="h-4 w-4 mr-2" /> Join Group</>}
                      </Button>
                    )}
                    {isMember && !isFull && (
                      <div className="flex-1 flex items-center justify-center text-sm text-accent font-medium gap-1">
                        ✅ You joined — share to fill the group!
                      </div>
                    )}
                    {isFull && (
                      <Button asChild className="flex-1 bg-accent hover:bg-accent/90 text-white" size="sm">
                        <Link href={`/listings/${group.listingId}`}>
                          <ShoppingBag className="h-4 w-4 mr-2" /> Buy at Group Price
                        </Link>
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => share(group)}>
                      <Share2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/listings/${group.listingId}`}>
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </main>
  )
}
