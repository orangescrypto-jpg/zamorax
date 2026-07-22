"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import Image from "next/image"
import { ChevronLeft, ChevronRight, X, ZoomIn } from "lucide-react"
import { cn } from "@/lib/utils"

interface ImageCarouselProps {
  images: string[]
  alt: string
  /** aspect-ratio class for the container, e.g. "aspect-[3/4]" or "aspect-[4/3]" */
  aspectClassName?: string
  className?: string
  imageClassName?: string
  /** Card usage: hide dots/arrows chrome on hover-less touch devices, keep it minimal */
  variant?: "card" | "detail"
  priority?: boolean
  sizes?: string
  /** Overlay content rendered above the image, e.g. badges — passed through so callers keep control */
  overlay?: React.ReactNode
  /** Disable the tap-to-zoom lightbox (e.g. inside a Link-wrapped card where tap should navigate) */
  disableZoom?: boolean
  onImageClick?: () => void
}

const SWIPE_THRESHOLD = 40 // px

export function ImageCarousel({
  images,
  alt,
  aspectClassName = "aspect-[4/3]",
  className,
  imageClassName,
  variant = "detail",
  priority = false,
  sizes = "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw",
  overlay,
  disableZoom = false,
  onImageClick,
}: ImageCarouselProps) {
  const safeImages = images.length > 0 ? images : ["/placeholder-listing.jpg"]
  const [index, setIndex] = useState(0)
  const [zoomOpen, setZoomOpen] = useState(false)
  const touchStartX = useRef<number | null>(null)
  const touchDeltaX = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const clamp = useCallback((i: number) => Math.max(0, Math.min(safeImages.length - 1, i)), [safeImages.length])
  const goTo = useCallback((i: number) => setIndex(clamp(i)), [clamp])
  const next = useCallback(() => setIndex(i => clamp(i + 1)), [clamp])
  const prev = useCallback(() => setIndex(i => clamp(i - 1)), [clamp])

  // Reset to first image if the images array itself changes (e.g. navigating between listings)
  useEffect(() => { setIndex(0) }, [images])

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchDeltaX.current = 0
  }
  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current
  }
  const handleTouchEnd = () => {
    if (Math.abs(touchDeltaX.current) > SWIPE_THRESHOLD) {
      if (touchDeltaX.current < 0) next()
      else prev()
    }
    touchStartX.current = null
    touchDeltaX.current = 0
  }

  const handleClick = () => {
    if (onImageClick) return onImageClick()
    if (!disableZoom) setZoomOpen(true)
  }

  // Keyboard nav in the lightbox
  useEffect(() => {
    if (!zoomOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoomOpen(false)
      if (e.key === "ArrowRight") next()
      if (e.key === "ArrowLeft") prev()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [zoomOpen, next, prev])

  const showChrome = safeImages.length > 1

  return (
    <>
      <div
        ref={containerRef}
        className={cn("relative overflow-hidden bg-muted select-none", aspectClassName, className)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <button
          type="button"
          onClick={handleClick}
          className="absolute inset-0 w-full h-full cursor-zoom-in"
          aria-label={disableZoom ? alt : `View ${alt} full size`}
        >
          <Image
            src={safeImages[index]}
            alt={alt}
            fill
            className={cn(
              "object-cover",
              variant === "card" && "transition-transform duration-500 group-hover:scale-105",
              imageClassName
            )}
            sizes={sizes}
            priority={priority}
            loading={priority ? undefined : "lazy"}
          />
        </button>

        {overlay}

        {/* Zoom affordance hint on detail variant */}
        {variant === "detail" && !disableZoom && (
          <span className="pointer-events-none absolute bottom-3 right-3 bg-black/40 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition md:opacity-100">
            <ZoomIn className="h-3.5 w-3.5" />
          </span>
        )}

        {showChrome && (
          <>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); prev() }}
              disabled={index === 0}
              className={cn(
                "absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full p-1.5 hover:bg-black/60 transition",
                index === 0 && "opacity-0 pointer-events-none"
              )}
              aria-label="Previous image"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); next() }}
              disabled={index === safeImages.length - 1}
              className={cn(
                "absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full p-1.5 hover:bg-black/60 transition",
                index === safeImages.length - 1 && "opacity-0 pointer-events-none"
              )}
              aria-label="Next image"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            {/* Dot indicators */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1">
              {safeImages.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); goTo(i) }}
                  className={cn(
                    "rounded-full transition-all",
                    i === index ? "w-4 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/60 hover:bg-white/80"
                  )}
                  aria-label={`Go to image ${i + 1}`}
                />
              ))}
            </div>

            {variant === "detail" && (
              <span className="absolute top-2 right-2 bg-black/50 text-white text-[11px] font-medium px-1.5 py-0.5 rounded-md">
                {index + 1}/{safeImages.length}
              </span>
            )}
          </>
        )}
      </div>

      {/* Thumbnail strip — detail variant only */}
      {variant === "detail" && showChrome && (
        <div className="flex gap-2 overflow-x-auto pb-1 mt-3">
          {safeImages.map((img, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              className={cn(
                "relative w-16 h-16 rounded-lg overflow-hidden shrink-0 border-2 transition",
                i === index ? "border-primary" : "border-transparent"
              )}
            >
              <Image src={img} alt="" fill className="object-cover" sizes="64px" />
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {zoomOpen && !disableZoom && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
          onClick={() => setZoomOpen(false)}
        >
          <button
            type="button"
            onClick={() => setZoomOpen(false)}
            className="absolute top-4 right-4 text-white/80 hover:text-white bg-white/10 rounded-full p-2 z-10"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>

          <div
            className="relative w-full h-full max-w-4xl max-h-[85vh] m-4"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <Image
              src={safeImages[index]}
              alt={alt}
              fill
              className="object-contain"
              sizes="100vw"
              priority
            />
          </div>

          {showChrome && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); prev() }}
                disabled={index === 0}
                className={cn(
                  "absolute left-3 top-1/2 -translate-y-1/2 bg-white/10 text-white rounded-full p-2 hover:bg-white/20 transition",
                  index === 0 && "opacity-30 pointer-events-none"
                )}
                aria-label="Previous image"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); next() }}
                disabled={index === safeImages.length - 1}
                className={cn(
                  "absolute right-3 top-1/2 -translate-y-1/2 bg-white/10 text-white rounded-full p-2 hover:bg-white/20 transition",
                  index === safeImages.length - 1 && "opacity-30 pointer-events-none"
                )}
                aria-label="Next image"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
                {safeImages.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); goTo(i) }}
                    className={cn(
                      "rounded-full transition-all",
                      i === index ? "w-5 h-2 bg-white" : "w-2 h-2 bg-white/50 hover:bg-white/70"
                    )}
                    aria-label={`Go to image ${i + 1}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}
