"use client"
import { ThemeProvider } from "@/hooks/useTheme"

import { useEffect, useState } from "react"
import { AuthService } from "@/src/services"
import { useAuthStore } from "@/store/authStore"
import { Toaster } from "@/components/ui/toaster"

export function Providers({ children }: { children: React.ReactNode }) {
  const { setUser, setLoading, setError, clearAuth } = useAuthStore()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    const unsubscribe = AuthService.onAuthStateChanged(async (user) => {
      try {
        if (user) {
          // emailVerified is merged into `user` by the firebase auth provider's
          // onAuthStateChanged — it reads firebaseUser.emailVerified directly.
          // We pass the object through as-is; no extra work needed here.
          setUser(user)
        } else {
          clearAuth()
        }
      } catch (error) {
        console.error("Auth state sync error:", error)
        setError(error instanceof Error ? error.message : "Auth sync failed")
      } finally {
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
