"use client"
import { ThemeProvider } from "@/hooks/useTheme"

import { useEffect, useRef, useState } from "react"
import { AuthService } from "@/src/services"
import { useAuthStore } from "@/store/authStore"
import { Toaster } from "@/components/ui/toaster"

export function Providers({ children }: { children: React.ReactNode }) {
  const { setUser, setLoading, setError, clearAuth, user } = useAuthStore()
  const [mounted, setMounted] = useState(false)
  const resolved = useRef(false)
  // Track the time of the last explicit setUser call so we can ignore
  // a false-null callback fired by Supabase immediately after login
  // (race between setSession() completing and onAuthStateChange firing).
  const lastSetUserAt = useRef(0)

  useEffect(() => {
    setMounted(true)
    setLoading(true)

    const unsubscribe = AuthService.onAuthStateChanged(async (incomingUser) => {
      try {
        if (incomingUser) {
          lastSetUserAt.current = Date.now()
          setUser(incomingUser)
        } else {
          // Guard: if we just set a user within the last 3 seconds, ignore
          // this null — it's a stale SIGNED_OUT/INITIAL_SESSION event fired
          // before Supabase finished hydrating the session from localStorage.
          const msSinceSet = Date.now() - lastSetUserAt.current
          if (msSinceSet < 3000) return
          clearAuth()
        }
      } catch (error) {
        console.error("Auth state sync error:", error)
        setError(error instanceof Error ? error.message : "Auth sync failed")
      } finally {
        resolved.current = true
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [setUser, setLoading, setError, clearAuth])

  if (!mounted) return <>{children}</>

  return (
    <ThemeProvider>
      {children}
      <Toaster />
    </ThemeProvider>
  )
}
