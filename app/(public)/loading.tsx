import { Skeleton } from "@/components/ui/skeleton"

export default function PublicLoading() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navbar skeleton */}
      <div className="h-16 border-b px-4 flex items-center gap-4">
        <Skeleton className="h-8 w-32" />
        <div className="flex-1" />
        <Skeleton className="h-9 w-64 hidden md:block" />
        <Skeleton className="h-9 w-9 rounded-full" />
        <Skeleton className="h-9 w-9 rounded-full" />
      </div>
      {/* Hero skeleton */}
      <div className="container mx-auto px-4 py-8 space-y-6">
        <Skeleton className="h-48 w-full rounded-xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-square rounded-xl" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
