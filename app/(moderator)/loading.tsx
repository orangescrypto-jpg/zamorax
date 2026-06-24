import { Skeleton } from "@/components/ui/skeleton"

export default function ModeratorLoading() {
  return (
    <div className="min-h-screen bg-amber-50 dark:bg-background p-4 space-y-4">
      <div className="flex items-center gap-3 mb-4">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-6 w-36" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border rounded-xl p-3 space-y-2 bg-card">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-12" />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="border rounded-xl p-3 space-y-2 bg-card">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        ))}
      </div>
    </div>
  )
}
