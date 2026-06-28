"use client"

// components/cart/CartCheckoutModal.tsx
// Multi-step checkout for cart orders (Step 1: Address, Step 2: Delivery per seller, Step 3: Review & Pay)

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Loader2, X, MapPin, Truck, ShoppingCart, CheckCircle, ChevronRight, ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/hooks/useAuth"
import { usePlatformSettings } from "@/hooks/usePlatformSettings"
import { useCartItemsStore } from "@/store/cartStore"
import { AdminService, serverTimestamp, ShippingService, LogisticsService } from "@/src/services"
import { formatPrice } from "@/lib/utils"
import { nigerianStates } from "@/constants/nigerianStates"
import type { CartItem, DeliveryMethod } from "@/src/types"

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

interface DeliverySelection {
  method: DeliveryMethod
  fee: number   // kobo
}

const STEP_LABELS = ["Delivery Address", "Delivery Method", "Review & Pay"]

export function CartCheckoutModal({ open, onClose, onSuccess }: Props) {
  const { user } = useAuth()
  const { settings } = usePlatformSettings()
  const router  = useRouter()
  const { toast } = useToast()
  const { cartItems, getCartGrouped, getCartTotal, clearCart } = useCartItemsStore()

  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)

  // Step 1 — Address
  const [street, setStreet] = useState("")
  const [city,   setCity]   = useState("")
  const [state,  setState]  = useState("")
  const [lga,    setLga]    = useState("")

  // Step 2 — Delivery per seller
  const [deliverySelections, setDeliverySelections] = useState<Record<string, DeliverySelection>>({})
  const [coverageLoading,    setCoverageLoading]    = useState<Record<string, boolean>>({})
  const [sellerZlaCoverage,  setSellerZlaCoverage]  = useState<Record<string, boolean>>({})
  const [sellerZlaFees,      setSellerZlaFees]      = useState<Record<string, number>>({})

  const grouped   = getCartGrouped()
  const sellerIds = Object.keys(grouped)

  // Load ZLA coverage + fee for each seller after buyer state is set
  useEffect(() => {
    if (!state || step !== 2) return

    sellerIds.forEach(async (sellerId) => {
      const items      = grouped[sellerId]
      const sellerState = items[0].sellerState

      setCoverageLoading(prev => ({ ...prev, [sellerId]: true }))
      try {
        const coverage = await ShippingService.getCoverageForStates(sellerState, state)
        setSellerZlaCoverage(prev => ({ ...prev, [sellerId]: coverage.bothCovered }))

        if (coverage.bothCovered) {
          // Calculate total weight for this seller's items
          const totalWeight = items.reduce((sum, i) => sum + ((i.weightKg ?? 0.5) * i.quantity), 0)
          const hasFragile  = items.some(i => i.isFragile)
          const pricing     = await LogisticsService.getPricing()
          const feeBreakdown = LogisticsService.calculateFee(sellerState, state, pricing, { weightKg: totalWeight, isFragile: hasFragile })
          const fee: number  = feeBreakdown.total
          setSellerZlaFees(prev => ({ ...prev, [sellerId]: fee }))
        }
      } catch {
        setSellerZlaCoverage(prev => ({ ...prev, [sellerId]: false }))
      } finally {
        setCoverageLoading(prev => ({ ...prev, [sellerId]: false }))
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, step])

  // Auto-select meetup as default delivery
  useEffect(() => {
    if (step !== 2) return
    const defaults: Record<string, DeliverySelection> = {}
    sellerIds.forEach(sid => {
      if (!deliverySelections[sid]) {
        defaults[sid] = { method: "meetup", fee: 0 }
      }
    })
    if (Object.keys(defaults).length > 0) {
      setDeliverySelections(prev => ({ ...prev, ...defaults }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  const handleStep1Next = () => {
    if (!street.trim() || !city.trim() || !state || !lga.trim()) {
      toast({ title: "Fill in all delivery fields", variant: "destructive" })
      return
    }
    setStep(2)
  }

  const handleStep2Next = () => {
    const allSelected = sellerIds.every(sid => deliverySelections[sid])
    if (!allSelected) {
      toast({ title: "Select delivery method for each seller", variant: "destructive" })
      return
    }
    setStep(3)
  }

  const grandTotal = useCallback(() => {
    const itemsTotal    = getCartTotal()
    const deliveryTotal = Object.values(deliverySelections).reduce((sum, s) => sum + s.fee, 0)
    return itemsTotal + deliveryTotal
  }, [getCartTotal, deliverySelections])

  const handleSubmit = async () => {
    if (!user?.uid) {
      toast({
        title: "Please log in again",
        description: "Your session may have expired. Log out and back in, then retry.",
        variant: "destructive",
      })
      return
    }
    setSubmitting(true)

    try {
      const commissionRate  = (settings.commissionSale ?? 5) / 100
      const reference       = `ZMX-CART-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`

      // Build cart items payload
      const cartPayload = sellerIds.map(sellerId => {
        const items        = grouped[sellerId]
        const delivery     = deliverySelections[sellerId] ?? { method: "meetup", fee: 0 }
        const subtotal     = items.reduce((sum, i) => sum + (i.agreedPrice ?? i.priceSale) * i.quantity, 0)
        const platformFee  = Math.floor(subtotal * commissionRate)
        const sellerPayout = subtotal - platformFee

        return {
          sellerId,
          sellerName:    items[0].sellerName,
          sellerState:   items[0].sellerState,
          lineItems:     items.map(i => ({
            listingId:  i.listingId,
            title:      i.listingTitle,
            qty:        i.quantity,
            unitPrice:  i.priceSale,
            agreedPrice: i.agreedPrice,
          })),
          deliveryMethod: delivery.method,
          deliveryFee:    delivery.fee,
          subtotal,
          platformFee,
          sellerPayout,
        }
      })

      // Create pendingPayment doc
      await AdminService.addDoc("pendingPayments", {
        purpose:        "cart_order",
        totalAmount:    grandTotal(),
        userId:         user.uid,
        buyerName:      user.fullName || user.email,
        buyerEmail:     user.email,
        buyerState:     state,
        deliveryStreet: street,
        deliveryCity:   city,
        deliveryState:  state,
        deliveryLGA:    lga,
        cartItems:      cartPayload,
        status:         "awaiting_transfer",
        adminConfirmed: false,
        provider:       "manual",
        reference,
        createdAt:      serverTimestamp(),
        updatedAt:      serverTimestamp(),
      })

      // Mark accepted offers as used for negotiated items
      for (const item of cartItems) {
        if (item.agreedPrice != null && user.uid) {
          try {
            const offerSnap = await AdminService.getCollection("acceptedOffers", [])
            const match = offerSnap.find((d: any) => d.listingId === item.listingId && d.buyerId === user.uid && !d.used)
            if (match) {
              await AdminService.updateDoc("acceptedOffers", match.id, { used: true, usedAt: serverTimestamp() })
            }
          } catch { /* non-blocking */ }
        }
      }

      clearCart()
      onSuccess()

      toast({
        title: "🎉 Order placed!",
        description: `Reference: ${reference} — Pay via bank transfer to activate your order.`,
        variant: "success",
      })

      router.push(`/dashboard/buyer/orders?ref=${reference}`)
    } catch (err: any) {
      toast({ title: "Checkout failed", description: err.message, variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[170] bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-x-0 bottom-0 sm:inset-0 sm:flex sm:items-center sm:justify-center z-[180]">
        <div className="bg-background rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
            <div>
              <h2 className="font-semibold text-foreground">Checkout</h2>
              <p className="text-xs text-muted-foreground">Step {step} of {STEP_LABELS.length}: {STEP_LABELS[step - 1]}</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-muted">
            <div
              className="h-1 bg-primary transition-all duration-300"
              style={{ width: `${(step / STEP_LABELS.length) * 100}%` }}
            />
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">

            {/* ── Step 1: Address ───────────────────────────────────── */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <MapPin className="h-4 w-4 text-primary" /> Delivery Address
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Street Address</Label>
                    <Input
                      value={street}
                      onChange={e => setStreet(e.target.value)}
                      placeholder="e.g. 12 Adeola Odeku Street"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5 min-w-0">
                      <Label className="text-xs">City</Label>
                      <Input value={city} onChange={e => setCity(e.target.value)} placeholder="Lagos Island" />
                    </div>
                    <div className="space-y-1.5 min-w-0">
                      <Label className="text-xs">LGA</Label>
                      <Input value={lga} onChange={e => setLga(e.target.value)} placeholder="Eti-Osa" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">State</Label>
                    <select
                      value={state}
                      onChange={e => setState(e.target.value)}
                      className="mt-1 w-full h-10 text-sm border border-input rounded-md px-3 bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                      <option value="">Select state</option>
                      {nigerianStates.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 2: Delivery method per seller ──────────────────── */}
            {step === 2 && (
              <div className="space-y-5">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Truck className="h-4 w-4 text-primary" /> Choose Delivery Method
                </div>

                {sellerIds.map(sellerId => {
                  const items        = grouped[sellerId]
                  const sellerName   = items[0].sellerName
                  const methods      = items[0].shippingMethods ?? ["meetup"]
                  const zlaCovered   = sellerZlaCoverage[sellerId] ?? false
                  const zlaFee       = sellerZlaFees[sellerId] ?? 0
                  const coverLoading = coverageLoading[sellerId] ?? false
                  const selected     = deliverySelections[sellerId]

                  return (
                    <div key={sellerId} className="space-y-2 p-3 rounded-xl border border-border bg-muted/30">
                      <p className="text-xs font-semibold text-foreground">{sellerName}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {items.length} item{items.length !== 1 ? "s" : ""} · {formatPrice(items.reduce((s, i) => s + (i.agreedPrice ?? i.priceSale) * i.quantity, 0))}
                      </p>

                      {coverLoading && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Checking coverage...
                        </div>
                      )}

                      <div className="space-y-1.5">
                        {methods.includes("meetup") && (
                          <DeliveryOption
                            label="Physical Meetup"
                            desc="Arrange a safe meet-up location with the seller"
                            fee={0}
                            selected={selected?.method === "meetup"}
                            onSelect={() => setDeliverySelections(prev => ({ ...prev, [sellerId]: { method: "meetup", fee: 0 } }))}
                          />
                        )}
                        {methods.includes("zamorax_logistics") && !coverLoading && (
                          zlaCovered ? (
                            <DeliveryOption
                              label="Zamorax Logistics"
                              desc="Door-to-door delivery via ZLA agents"
                              fee={zlaFee}
                              selected={selected?.method === "zamorax_logistics"}
                              onSelect={() => setDeliverySelections(prev => ({ ...prev, [sellerId]: { method: "zamorax_logistics", fee: zlaFee } }))}
                            />
                          ) : (
                            <p className="text-[10px] text-muted-foreground italic px-1">ZLA logistics not available for this route</p>
                          )
                        )}
                        {methods.includes("fbz") && (settings.fbzCoveredStates?.length ?? 0) > 0 && (
                          <DeliveryOption
                            label="Fulfilled by Zamorax"
                            desc="Handled from our warehouse"
                            fee={0}
                            selected={selected?.method === "fbz"}
                            onSelect={() => setDeliverySelections(prev => ({ ...prev, [sellerId]: { method: "fbz", fee: 0 } }))}
                          />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* ── Step 3: Review & Pay ──────────────────────────────────── */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <CheckCircle className="h-4 w-4 text-primary" /> Order Summary
                </div>

                <div className="space-y-3">
                  {sellerIds.map(sellerId => {
                    const items    = grouped[sellerId]
                    const delivery = deliverySelections[sellerId] ?? { method: "meetup", fee: 0 }
                    const subtotal = items.reduce((sum, i) => sum + (i.agreedPrice ?? i.priceSale) * i.quantity, 0)

                    return (
                      <div key={sellerId} className="p-3 rounded-xl border border-border space-y-2">
                        <p className="text-xs font-semibold text-foreground">{items[0].sellerName}</p>
                        {items.map((item: any) => (
                          <div key={item.listingId} className="flex items-center justify-between text-xs text-muted-foreground">
                            <span className="line-clamp-1 flex-1 pr-2">{item.listingTitle} ×{item.quantity}</span>
                            <span className="shrink-0">
                              {formatPrice((item.agreedPrice ?? item.priceSale) * item.quantity)}
                              {item.agreedPrice != null && (
                                <span className="ml-1 text-green-600 font-medium">✓</span>
                              )}
                            </span>
                          </div>
                        ))}
                        <div className="border-t border-border/50 pt-1.5 flex justify-between text-xs text-muted-foreground">
                          <span>Delivery ({delivery.method.replace(/_/g, " ")})</span>
                          <span>{delivery.fee === 0 ? "Free" : formatPrice(delivery.fee)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="p-3 rounded-xl bg-muted/50 space-y-1.5 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Items subtotal</span>
                    <span>{formatPrice(getCartTotal())}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Delivery</span>
                    <span>{formatPrice(Object.values(deliverySelections).reduce((s, d) => s + d.fee, 0))}</span>
                  </div>
                  <div className="flex justify-between font-bold text-foreground border-t border-border pt-1.5">
                    <span>Grand Total</span>
                    <span className="text-primary">{formatPrice(grandTotal())}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-dashed border-primary/30 bg-primary/5 text-xs text-muted-foreground space-y-0.5">
                  <p className="font-semibold text-foreground">Payment via Bank Transfer</p>
                  <p>After placing your order, you'll see our bank details to complete payment. Your order is activated once admin confirms your transfer.</p>
                </div>
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="border-t border-border px-5 py-4 flex gap-3 shrink-0">
            {step > 1 && (
              <Button
                variant="outline"
                className="flex-1 h-11"
                onClick={() => setStep(s => s - 1)}
                disabled={submitting}
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
            )}

            {step === 1 && (
              <Button className="flex-1 h-11" onClick={handleStep1Next}>
                Continue <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
            {step === 2 && (
              <Button className="flex-1 h-11" onClick={handleStep2Next}>
                Review Order <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
            {step === 3 && (
              <Button
                className="flex-1 h-11 bg-primary text-primary-foreground"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Placing Order...</>
                ) : (
                  "Confirm & Pay via Bank Transfer"
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ── Helper: single delivery option row ──────────────────────────────────────
function DeliveryOption({
  label, desc, fee, selected, onSelect
}: {
  label: string; desc: string; fee: number
  selected: boolean; onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center justify-between p-2.5 rounded-lg border text-left transition-all ${
        selected
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/40 hover:bg-muted/30"
      }`}
    >
      <div className="flex items-center gap-2">
        <div className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 ${selected ? "border-primary bg-primary" : "border-muted-foreground"}`}>
          {selected && <div className="w-full h-full rounded-full bg-white scale-[0.45]" />}
        </div>
        <div>
          <p className="text-xs font-medium text-foreground">{label}</p>
          <p className="text-[10px] text-muted-foreground">{desc}</p>
        </div>
      </div>
      <span className="text-xs font-semibold text-primary shrink-0 ml-2">
        {fee === 0 ? "Free" : formatPrice(fee)}
      </span>
    </button>
  )
}
