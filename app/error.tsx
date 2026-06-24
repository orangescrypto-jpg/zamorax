"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle, RefreshCw, MessageSquare } from "lucide-react"
import Link from "next/link"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Unhandled app error:", error)
  }, [error])

  return (
    <div className="container flex flex-col items-center justify-center min-h-[70vh] text-center space-y-6">
      <AlertTriangle className="h-16 w-16 text-destructive" />
      <h1 className="text-3xl font-heading font-bold">Something went wrong</h1>
      <p className="text-muted-foreground max-w-md">
        An unexpected error occurred. Our team has been notified. Please try refreshing the page or contact support.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <Button onClick={reset} variant="outline"><RefreshCw className="h-4 w-4 mr-2" /> Try Again</Button>
        <Button asChild className="bg-primary hover:bg-primary/90 text-white">
          <Link href="/contact"><MessageSquare className="h-4 w-4 mr-2" /> Contact Support</Link>
        </Button>
      </div>
    </div>
  )
}
