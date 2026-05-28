import Link from "next/link"
import { Search, Home, ArrowLeft } from "lucide-react"

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 bg-background">
      <div className="mb-6">
        <svg viewBox="0 0 512 512" className="w-20 h-20 mx-auto">
          <rect width="512" height="512" fill="#0a0a0a" rx="24"/>
          <path d="M256 52 L422 150 L422 362 L256 460 L90 362 L90 150 Z" fill="none" stroke="#f97316" strokeWidth="24" strokeLinejoin="round"/>
          <line x1="168" y1="168" x2="332" y2="168" stroke="#f97316" strokeWidth="46" strokeLinecap="round"/>
          <line x1="320" y1="168" x2="185" y2="332" stroke="#f97316" strokeWidth="46" strokeLinecap="round"/>
          <line x1="172" y1="332" x2="285" y2="332" stroke="#f97316" strokeWidth="46" strokeLinecap="round"/>
          <path d="M278 305 L355 340 L278 372" fill="#f97316"/>
        </svg>
      </div>
      <h1 className="text-7xl font-black text-foreground mb-2">404</h1>
      <p className="text-xl font-semibold text-foreground mb-2">Page not found</p>
      <p className="text-sm text-muted-foreground mb-8 max-w-xs">
        This listing may have been sold, removed, or you followed a broken link.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <Link href="/" className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors">
          <Home className="h-4 w-4" /> Go Home
        </Link>
        <Link href="/search" className="flex items-center gap-2 border border-border px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-muted transition-colors">
          <Search className="h-4 w-4" /> Browse Listings
        </Link>
      </div>
      <Link href="javascript:history.back()" className="mt-6 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-3 w-3" /> Go back
      </Link>
    </div>
  )
}
