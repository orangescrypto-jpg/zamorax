"use client"

import {AdminService, onSnapshot, serverTimestamp} from "@/src/services"

import { useState, useEffect } from "react"
import { SAFE_SPOTS, SPOT_TYPE_LABEL, SPOT_TYPE_COLOR, getSpotsForState, type SafeSpot } from "@/constants/safeSpots"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Shield, MapPin, Copy, CheckCircle2, Building2, ShoppingBag, Utensils, Landmark } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

const STATES = [...new Set(SAFE_SPOTS.map(s => s.state))].sort()

function generateMeetCode(chatId: string): string {
  const hash = chatId.slice(-6).toUpperCase()
  return `ZMX-${hash}`
}

const typeIcon: Record<string, React.ReactNode> = {
  police: <Shield className="h-4 w-4" />,
  mall: <ShoppingBag className="h-4 w-4" />,
  bank: <Landmark className="h-4 w-4" />,
  fastfood: <Utensils className="h-4 w-4" />,
  hospital: <Building2 className="h-4 w-4" />,
}

interface Props {
  chatId: string
  userId: string
  open: boolean
  onClose: () => void
  sellerState?: string
}

export function SafeMeetModal({ chatId, userId, open, onClose, sellerState }: Props) {
  const [selectedState, setSelectedState] = useState(sellerState || "Lagos")
  const [selectedSpot, setSelectedSpot] = useState<SafeSpot | null>(null)
  const [meetData, setMeetData] = useState<any>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const spots = getSpotsForState(selectedState)
  const meetCode = generateMeetCode(chatId)

  // Listen for existing safe meet data on this chat
  useEffect(() => {
    if (!open) return
    const unsub = AdminService.subscribeToDoc("chats", chatId, docs => {
      const data = snap
      if (data?.safeMeet) {
        setMeetData(data.safeMeet)
        const spot = SAFE_SPOTS.find(s => s.id === data.safeMeet.spotId)
        if (spot) setSelectedSpot(spot)
        if (data.safeMeet.confirmedBy?.includes(userId)) setConfirmed(true)
      }
    })
    return unsub
  }, [chatId, open, userId])

  const handlePropose = async () => {
    if (!selectedSpot) return
    setLoading(true)
    try {
      await AdminService.updateDoc("chats", chatId, {
        safeMeet: {
          spotId: selectedSpot.id,
          spotName: selectedSpot.name,
          spotAddress: selectedSpot.address,
          spotType: selectedSpot.type,
          lat: selectedSpot.lat,
          lng: selectedSpot.lng,
          meetCode,
          proposedBy: userId,
          proposedAt: serverTimestamp(),
          confirmedBy: [userId],
          status: "proposed",
        }
      })
      toast({ title: "Safe Meet Proposed!", description: "Waiting for the other party to confirm.", variant: "success" })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally { setLoading(false) }
  }

  const handleConfirm = async () => {
    if (!meetData) return
    setLoading(true)
    try {
      const confirmedBy = [...(meetData.confirmedBy || []), userId]
      const bothConfirmed = confirmedBy.length >= 2
      await AdminService.updateDoc("chats", chatId, {
        "safeMeet.confirmedBy": confirmedBy,
        "safeMeet.status": bothConfirmed ? "confirmed" : "proposed",
      })
      setConfirmed(true)
      toast({ title: bothConfirmed ? "✅ Meet Confirmed by Both!" : "You confirmed!", description: bothConfirmed ? "Show your meet code at the meetup." : "Waiting for other party.", variant: "success" })
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally { setLoading(false) }
  }

  const handleDealDone = async () => {
    setLoading(true)
    try {
      await AdminService.updateDoc("chats", chatId, {
        "safeMeet.status": "deal_done",
        "safeMeet.completedAt": serverTimestamp(),
      })
      toast({ title: "🎉 Deal Done!", description: "Safe meet completed successfully.", variant: "success" })
      onClose()
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    } finally { setLoading(false) }
  }

  const copyCode = () => {
    navigator.clipboard.writeText(meetData?.meetCode || meetCode)
    toast({ title: "Code copied!" })
  }

  const mapUrl = selectedSpot
    ? `https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&q=${selectedSpot.lat},${selectedSpot.lng}&zoom=16`
    : null

  const bothConfirmed = meetData?.status === "confirmed" || meetData?.status === "deal_done"

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Zamorax Safe Meet
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info banner */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm text-muted-foreground">
            Meet at a verified public location. Both parties confirm to get a <strong>meet code</strong> — show it to each other to verify identity.
          </div>

          {/* If no meet proposed yet */}
          {!meetData && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Select State</label>
                <Select value={selectedState} onValueChange={v => { setSelectedState(v); setSelectedSpot(null) }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Choose Safe Location</label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {spots.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No spots available for this state yet.</p>
                  )}
                  {spots.map(spot => (
                    <button
                      key={spot.id}
                      onClick={() => setSelectedSpot(spot)}
                      className={`w-full text-left p-3 rounded-lg border transition ${
                        selectedSpot?.id === spot.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`p-1.5 rounded-md ${SPOT_TYPE_COLOR[spot.type]}`}>
                          {typeIcon[spot.type]}
                        </span>
                        <div>
                          <p className="font-medium text-sm">{spot.name}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {spot.address}
                          </p>
                        </div>
                        <Badge variant="outline" className="ml-auto text-xs">{SPOT_TYPE_LABEL[spot.type]}</Badge>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {selectedSpot && mapUrl && (
                <div className="rounded-lg overflow-hidden border h-40">
                  <iframe src={mapUrl} className="w-full h-full border-0" allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade" title="Safe Meet Location" />
                </div>
              )}

              <Button
                className="w-full bg-primary text-white"
                disabled={!selectedSpot || loading}
                onClick={handlePropose}
              >
                <Shield className="h-4 w-4 mr-2" />
                Propose This Meet Spot
              </Button>
            </>
          )}

          {/* Meet proposed — show details */}
          {meetData && meetData.status !== "deal_done" && (
            <>
              <div className="border rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className={`p-2 rounded-md ${SPOT_TYPE_COLOR[meetData.spotType as keyof typeof SPOT_TYPE_COLOR] || ""}`}>
                    {typeIcon[meetData.spotType as keyof typeof typeIcon]}
                  </span>
                  <div>
                    <p className="font-semibold">{meetData.spotName}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {meetData.spotAddress}
                    </p>
                  </div>
                </div>

                {mapUrl && (
                  <div className="rounded-lg overflow-hidden border h-36">
                    <iframe src={mapUrl} className="w-full h-full border-0" allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade" title="Safe Meet Location" />
                  </div>
                )}

                {/* Meet Code */}
                <div className="bg-secondary/5 border border-secondary/20 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Your Meet Code</p>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-2xl font-mono font-bold tracking-widest text-secondary">
                      {meetData.meetCode}
                    </span>
                    <button onClick={copyCode} className="text-muted-foreground hover:text-primary">
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Show this to the other party when you meet</p>
                </div>

                {/* Confirmation status */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Confirmations</span>
                  <div className="flex gap-1">
                    {[0, 1].map(i => (
                      <div key={i} className={`h-6 w-6 rounded-full flex items-center justify-center ${
                        (meetData.confirmedBy?.length || 0) > i ? "bg-green-500 text-white" : "bg-muted"
                      }`}>
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                    ))}
                    <span className="ml-1 text-muted-foreground">{meetData.confirmedBy?.length || 0}/2</span>
                  </div>
                </div>

                {!confirmed && (
                  <Button className="w-full" variant="outline" onClick={handleConfirm} disabled={loading}>
                    <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
                    Confirm This Meetup
                  </Button>
                )}

                {bothConfirmed && (
                  <Button className="w-full bg-green-600 hover:bg-green-700 text-white" onClick={handleDealDone} disabled={loading}>
                    🎉 Deal Done — Mark Complete
                  </Button>
                )}
              </div>
            </>
          )}

          {meetData?.status === "deal_done" && (
            <div className="text-center py-6 space-y-2">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
              <p className="font-semibold text-green-700">Safe Meet Completed!</p>
              <p className="text-sm text-muted-foreground">Both parties completed this deal safely.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
