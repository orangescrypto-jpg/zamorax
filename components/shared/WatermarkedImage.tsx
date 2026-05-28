"use client"

import Image from "next/image"
import { cn } from "@/lib/utils"

interface WatermarkedImageProps {
  src: string
  alt: string
  fill?: boolean
  width?: number
  height?: number
  className?: string
  watermark?: boolean
  sizes?: string
  priority?: boolean
}

export function WatermarkedImage({
  src, alt, fill, width, height, className, watermark = true, sizes, priority
}: WatermarkedImageProps) {
  return (
    <div className="relative w-full h-full">
      {fill ? (
        <Image src={src} alt={alt} fill className={cn("object-cover", className)} sizes={sizes} priority={priority} />
      ) : (
        <Image src={src} alt={alt} width={width} height={height} className={cn("object-cover", className)} sizes={sizes} priority={priority} />
      )}
      {watermark && (
        <div className="absolute bottom-2 right-2 pointer-events-none select-none">
          <div className="flex items-center gap-1 bg-black/40 backdrop-blur-sm rounded-md px-2 py-0.5">
            <svg viewBox="0 0 512 512" className="w-3 h-3 shrink-0">
              <path d="M256 52L422 150L422 362L256 460L90 362L90 150Z" fill="none" stroke="#f97316" strokeWidth="40" strokeLinejoin="round"/>
              <line x1="168" y1="168" x2="332" y2="168" stroke="#f97316" strokeWidth="70" strokeLinecap="round"/>
              <line x1="320" y1="168" x2="185" y2="332" stroke="#f97316" strokeWidth="70" strokeLinecap="round"/>
              <line x1="172" y1="332" x2="285" y2="332" stroke="#f97316" strokeWidth="70" strokeLinecap="round"/>
            </svg>
            <span className="text-white text-[9px] font-bold tracking-wide opacity-80">zamorax.com</span>
          </div>
        </div>
      )}
    </div>
  )
}
