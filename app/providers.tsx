// app/providers.tsx  — REPLACE EXISTING FILE
"use client"

import { ThemeProvider } from "@/hooks/useTheme"
import { useEffect, useRef, useState } from "react"
import { useAuthStore } from "@/store/authStore"
import { createClient } from "@/lib/supabase/client"
import { Toaster } from "@/components/ui/toaster"

async function fetchProfileFromSession(): Promise<any | null> {
  try {
    const res = await fetch("/api/auth/me", { credentials: "include" })
    if (res.status === 401 || res.status === 404) return null
    if (!res.ok) return null
    const data = await res.json()
    return data?.profile ?? null
  } catch {
    return null
  }
}

export function Providers({ children }: { children: React.ReactNode }) {
  const { setUser, setLoading, clearAuth } = useAuthStore()
  const [mounted, setMounted] = useState(false)
  const lastSetAt = useRef(0)

  useEffect(() => {
    setMounted(true)
    setLoading(true)

    const supabase = createClient()

    // Initial session check
    const checkSession = async () => {
      try {
        const profile = await fetchProfileFromSession()
        if (profile) {
          lastSetAt.current = Date.now()
          setUser(profile)
        } else {
          const msSinceSet = Date.now() - lastSetAt.current
          if (msSinceSet > 5000) clearAuth()
        }
      } catch {
        // Network error — keep existing state
      } finally {
        setLoading(false)
      }
    }

    checkSession()

    // Listen for Supabase auth events (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        const profile = await fetchProfileFromSession()
        if (profile) {
          lastSetAt.current = Date.now()
          setUser(profile)
        }
      }

      if (event === "SIGNED_OUT") {
        clearAuth()
      }
    })

    return () => { subscription.unsubscribe() }
  }, [setUser, setLoading, clearAuth])

  if (!mounted) return <>{children}</>

  return (
    <ThemeProvider>
      {children}
      <Toaster />
    </ThemeProvider>
  )
}
