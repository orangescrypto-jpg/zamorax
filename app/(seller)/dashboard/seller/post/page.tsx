// app/(seller)/dashboard/seller/post/page.tsx
import { RoleGuard } from "@/components/auth/RoleGuard"
import { ListingForm } from "@/components/listings/ListingForm"
import { VerificationGate } from "@/components/listings/VerificationGate"

export default function PostListingPage() {
  return (
    <RoleGuard allowedRoles={["seller", "both"]}>
      {/* VerificationGate checks ninVerified + bvnVerified before showing the form.
          If not verified: shows prompts to submit or wait for approval.
          If verified: renders ListingForm normally. */}
      <VerificationGate>
        <ListingForm />
      </VerificationGate>
    </RoleGuard>
  )
}
