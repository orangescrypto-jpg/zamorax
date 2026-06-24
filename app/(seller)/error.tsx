"use client"
import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
      <AlertTriangle className="h-12 w-12 text-destructive" />
      <div>
        <h2 className="text-xl font-semibold mb-1">Something went wrong</h2>
        <p className="text-sm text-muted-foreground max-w-sm">{error.message || "An unexpected error occurred."}</p>
      </div>
      <Button onClick={reset}>Try Again</Button>
    </div>
  )
}
