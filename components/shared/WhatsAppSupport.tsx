"use client"
// components/shared/WhatsAppSupport.tsx
// whatsappSupportNumber + whatsappSupportMessage pulled from config/platform.
// Falls back to defaults if settings haven't loaded yet.

import { cn } from "@/lib/utils"
import { usePlatformSettings } from "@/hooks/usePlatformSettings"

interface WhatsAppSupportProps {
  /** Override the support number (e.g. for a specific department) */
  phone?: string
  /** Override the default message */
  message?: string
  className?: string
}

export function WhatsAppSupport({ phone, message, className }: WhatsAppSupportProps) {
  const { settings } = usePlatformSettings()

  if (!settings.whatsappSupportEnabled) return null

  const resolvedPhone   = phone   ?? settings.whatsappSupportNumber
  const resolvedMessage = message ?? settings.whatsappSupportMessage
  const url = `https://wa.me/${resolvedPhone}?text=${encodeURIComponent(resolvedMessage)}`

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat on WhatsApp"
      className={cn(
        "fixed bottom-[72px] right-4 z-40 flex items-center justify-center bg-[#F97316] text-white",
        "w-14 h-14 rounded-full shadow-xl hover:bg-[#ea6c0a] active:scale-95",
        "transition-all duration-200",
        className
      )}
    >
      <SupportHeadsetIcon />
    </a>
  )
}

// Listing-specific WhatsApp button (contact seller) — unchanged
export function WhatsAppSellerButton({
  phone,
  listingTitle,
  className,
}: {
  phone: string
  listingTitle: string
  className?: string
}) {
  const msg = `Hi, I'm interested in your listing on Zamorax: "${listingTitle}". Is it still available?`
  const url = `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "flex items-center justify-center gap-2 w-full bg-[#25D366] hover:bg-[#20b558]",
        "text-white font-semibold py-3 rounded-xl transition-colors active:scale-[0.98]",
        className
      )}
    >
      <WhatsAppIcon />
      Chat Seller on WhatsApp
    </a>
  )
}

function SupportHeadsetIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white shrink-0" aria-hidden="true">
      {/* Headset with mic — matches the agent/support icon in the screenshot */}
      <path d="M12 1C7.03 1 3 5.03 3 10v1H2a1 1 0 00-1 1v4a1 1 0 001 1h1c0 1.1.9 2 2 2h1v-8H5v-1c0-3.87 3.13-7 7-7s7 3.13 7 7v1h-1v8h1c1.1 0 2-.9 2-2h1a1 1 0 001-1v-4a1 1 0 00-1-1h-1v-1c0-4.97-4.03-9-9-9z"/>
      <path d="M9 14H8v-2h1v2zm7 0h-1v-2h1v2z" opacity=".6"/>
      <path d="M14.5 18.5c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5.67-1.5 1.5-1.5 1.5.67 1.5 1.5z"/>
    </svg>
  )
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white shrink-0">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.555 4.116 1.528 5.85L0 24l6.335-1.652A11.954 11.954 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.885 0-3.656-.493-5.193-1.357l-.371-.221-3.863 1.008 1.03-3.748-.242-.386A9.959 9.959 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z"/>
    </svg>
  )
}
