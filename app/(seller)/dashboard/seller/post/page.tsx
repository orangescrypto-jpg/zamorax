// app/(seller)/dashboard/seller/post/page.tsx
"use client"
import { RoleGuard } from "@/components/auth/RoleGuard"
import { ListingForm } from "@/components/listings/ListingForm"
import { VerificationGate } from "@/components/listings/VerificationGate"
import { usePlatformSettings } from "@/hooks/usePlatformSettings"
import { AlertTriangle } from "lucide-react"

function PostListingContent() {
  const { settings } = usePlatformSettings()

  if (!settings.listingCreationEnabled) {
    return (
      <div className="container max-w-md py-12 text-center space-y-4 pb-24">
        <div className="h-14 w-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
          <AlertTriangle className="h-7 w-7 text-amber-600" />
        </div>
        <h2 className="text-xl font-heading font-bold">Listing Creation Paused</h2>
        <p className="text-sm text-muted-foreground">
          New listings are temporarily disabled. Please check back soon.
        </p>
      </div>
    )
  }

  return (
    <VerificationGate>
      <ListingForm />
    </VerificationGate>
  )
}

export default function PostListingPage() {
  return (
    <RoleGuard allowedRoles={["seller", "both"]}>
      <PostListingContent />
    </RoleGuard>
  )
}
