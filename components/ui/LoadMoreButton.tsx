// components/ui/LoadMoreButton.tsx
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Props {
  hasMore: boolean
  loading: boolean
  onLoadMore: () => void
  total?: number
  label?: string
}

export function LoadMoreButton({ hasMore, loading, onLoadMore, total, label = "Load More" }: Props) {
  if (!hasMore && total !== undefined && total > 0) {
    return (
      <p className="text-center text-xs text-muted-foreground py-4">
        All {total} results loaded.
      </p>
    )
  }
  if (!hasMore) return null

  return (
    <div className="flex flex-col items-center gap-1 py-6">
      <Button variant="outline" onClick={onLoadMore} disabled={loading} className="min-w-32">
        {loading
          ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading...</>
          : label}
      </Button>
      {total !== undefined && (
        <p className="text-xs text-muted-foreground">{total} loaded so far</p>
      )}
    </div>
  )
}
