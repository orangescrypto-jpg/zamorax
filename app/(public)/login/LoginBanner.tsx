"use client"
import { useSearchParams } from "next/navigation"
import { CheckCircle2 } from "lucide-react"

export default function LoginBanner() {
  const verified = useSearchParams().get("verified") === "true"
  if (!verified) return null
  return (
    <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-green-800 text-sm">
      <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
      <span><strong>Email verified!</strong> You can now log in to your account.</span>
    </div>
  )
}
