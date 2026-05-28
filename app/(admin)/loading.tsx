import { Skeleton } from "@/components/ui/skeleton"

export default function AdminLoading() {
  return (
    <div className="min-h-screen bg-background p-4 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="border rounded-xl p-3 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-2 w-10" />
          </div>
        ))}
      </div>
      {/* Table skeleton */}
      <div className="border rounded-xl overflow-hidden">
        <div className="p-3 border-b flex gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="p-3 border-b flex gap-3 items-center">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            {Array.from({ length: 3 }).map((_, j) => (
              <Skeleton key={j} className="h-3 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
