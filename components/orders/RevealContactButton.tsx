"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Phone, Loader2 } from "lucide-react"

interface RevealContactButtonProps {
  orderId: string
  label?: string
  className?: string
  size?: "block" | "inline"
}

export function RevealContactButton({
  orderId,
  label = "Reveal Contact Number",
  className,
  size = "block",
}: RevealContactButtonProps) {
  const [loading, setLoading] = useState(false)
  const [phone, setPhone] = useState<string | null>(null)
  const [buyerPhone, setBuyerPhone] = useState<string | null>(null)
  const [sellerPhone, setSellerPhone] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const reveal = async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const res = await fetch(`/api/orders/${orderId}/reveal-contact`, { method: "POST" })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErrorMsg(json?.error || "Contact is not available yet.")
        return
      }
      if (json.buyerPhone !== undefined || json.sellerPhone !== undefined) {
        setBuyerPhone(json.buyerPhone ?? null)
        setSellerPhone(json.sellerPhone ?? null)
        if (!json.buyerPhone && !json.sellerPhone) {
          setErrorMsg("No phone number on file for this order.")
        }
      } else {
        setPhone(json.phone ?? null)
        if (!json.phone) {
          setErrorMsg("No phone number on file for this contact.")
        }
      }
    } catch {
      setErrorMsg("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const wrapperWidth = size === "inline" ? "" : "w-full"

  if (buyerPhone || sellerPhone) {
    return (
      <div className={`flex flex-col gap-1.5 ${wrapperWidth} ${className ?? ""}`}>
        {buyerPhone && (
          <a href={`tel:${buyerPhone}`} className="flex items-center gap-2 text-xs text-primary font-medium">
            <Phone className="h-3.5 w-3.5" /> Buyer: {buyerPhone}
          </a>
        )}
        {sellerPhone && (
          <a href={`tel:${sellerPhone}`} className="flex items-center gap-2 text-xs text-primary font-medium">
            <Phone className="h-3.5 w-3.5" /> Seller: {sellerPhone}
          </a>
        )}
      </div>
    )
  }

  if (phone) {
    return (
      <a
        href={`tel:${phone}`}
        className={`flex items-center justify-center gap-2 ${wrapperWidth} py-3 rounded-xl border border-primary/30 bg-primary/5 text-primary font-medium text-sm ${className ?? ""}`}
      >
        <Phone className="h-4 w-4" /> {phone}
      </a>
    )
  }

  return (
    <div className={`${wrapperWidth} ${className ?? ""}`}>
      <Button
        type="button"
        variant="outline"
        size={size === "inline" ? "sm" : "default"}
        className={wrapperWidth}
        onClick={reveal}
        disabled={loading}
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Phone className="h-3.5 w-3.5 mr-1.5" />}
        {label}
      </Button>
      {errorMsg && <p className="text-xs text-muted-foreground mt-1.5 text-center">{errorMsg}</p>}
    </div>
  )
}
