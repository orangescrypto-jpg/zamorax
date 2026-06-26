"use client"
import { ThemeProvider } from "@/hooks/useTheme"

import { useEffect, useRef, useState } from "react"
import { AuthService } from "@/src/services"
import { useAuthStore } from "@/store/authStore"
import { Toaster } from "@/components/ui/toaster"

export function Providers({ children }: { children: React.ReactNode }) {
  const { setUser, setLoading, setError, clearAuth } = useAuthStore()
  const [mounted, setMounted] = useState(false)
  // Track whether onAuthStateChanged has fired at least once.
  // Until it has, we must keep loading=true so guards don't redirect.
  const resolved = useRef(false)

  useEffect(() => {
    setMounted(true)
    // Force loading=true immediately so no guard can fire before
    // Supabase has confirmed (or denied) the session.
    setLoading(true)

    const unsubscribe = AuthService.onAuthStateChanged(async (user) => {
      try {
        if (user) {
          setUser(user)
        } else {
          // Only clear auth after the very first resolution so a
          // momentary null during INITIAL_SESSION doesn't log the user out.
          // The Supabase provider already does a getSession() double-check
          // before calling back with null — but if it genuinely has no
          // session, clear it.
          clearAuth()
        }
      } catch (error) {
        console.error("Auth state sync error:", error)
        setError(error instanceof Error ? error.message : "Auth sync failed")
      } finally {
        // Mark resolved and set loading false regardless of outcome
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
