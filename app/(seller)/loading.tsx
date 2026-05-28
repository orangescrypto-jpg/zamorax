import { Skeleton } from "@/components/ui/skeleton"

export default function SellerLoading() {
  return (
    <div className="min-h-screen bg-background">
      {/* Stats row */}
      <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border rounded-xl p-3 space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-2 w-12" />
          </div>
        ))}
      </div>
      {/* Listing cards */}
      <div className="px-4 space-y-3">
        <Skeleton className="h-6 w-32 mb-2" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-3 border rounded-xl p-3">
            <Skeleton className="h-20 w-20 rounded-lg shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
              <div className="flex gap-2">
                <Skeleton className="h-7 w-16 rounded-md" />
                <Skeleton className="h-7 w-16 rounded-md" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
