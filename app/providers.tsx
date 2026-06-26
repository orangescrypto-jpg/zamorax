"use client"
import { ThemeProvider } from "@/hooks/useTheme"
import { useEffect, useRef, useState } from "react"
import { useAuthStore } from "@/store/authStore"
import { Toaster } from "@/components/ui/toaster"

// Fetch profile from D1 using the sb-uid httpOnly cookie.
// The cookie is set by /api/auth/login and read server-side.
// This replaces the Supabase onAuthStateChanged listener entirely
// so there is no dependency on localStorage or Supabase client tokens.
async function fetchProfileFromCookie(): Promise<any | null> {
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
  const { setUser, setLoading, clearAuth, user } = useAuthStore()
  const [mounted, setMounted] = useState(false)
  const lastSetUserAt = useRef(0)

  useEffect(() => {
    setMounted(true)
    setLoading(true)

    // On every page load/refresh, check if we have a valid session
    // via the httpOnly cookie. No localStorage, no Supabase client needed.
    const checkSession = async () => {
      try {
        const profile = await fetchProfileFromCookie()
        if (profile) {
          lastSetUserAt.current = Date.now()
          setUser(profile)
        } else {
          // Only clear if we don't have a recently-set user
          const msSinceSet = Date.now() - lastSetUserAt.current
          if (msSinceSet > 5000) clearAuth()
        }
      } catch {
        // Network error — don't clear auth, keep existing state
      } finally {
        setLoading(false)
      }
    }

    checkSession()
  }, [setUser, setLoading, clearAuth])

  if (!mounted) return <>{children}</>

  return (
    <ThemeProvider>
      {children}
      <Toaster />
    </ThemeProvider>
  )
}
