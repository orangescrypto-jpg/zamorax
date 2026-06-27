// components/auth/RoleGuard.tsx  — REPLACE EXISTING FILE
// No changes needed — already role-agnostic. Keeping identical logic.
"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { Loader2 } from "lucide-react"

interface RoleGuardProps {
  children:     React.ReactNode
  allowedRoles: string[]
  redirectTo?:  string
}

export function RoleGuard({ children, allowedRoles, redirectTo = "/" }: RoleGuardProps) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (!user) { router.replace("/login"); return }
    if (!allowedRoles.includes(user.role)) { router.replace(redirectTo); return }
  }, [user, loading, allowedRoles, redirectTo, router])

  if (loading || !user) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )

  if (!allowedRoles.includes(user.role)) return null

  return <>{children}</>
}
