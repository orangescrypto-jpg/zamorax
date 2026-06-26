// store/authStore.ts
// Uses AuthService instead of calling Firebase directly.

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { AuthService } from "@/src/services/auth"
import type { User } from "@/src/types"

interface AuthState {
  user:       User | null
  loading:    boolean
  error:      string | null
  setUser:    (user: User) => void
  clearAuth:  () => void
  setLoading: (loading: boolean) => void
  setError:   (error: string | null) => void
  signOut:    () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user:    null,
      // Start as true — providers.tsx will call setLoading(true) on mount
      // and setLoading(false) once Supabase resolves the session.
      // This prevents guards from seeing loading=false+user=null and
      // redirecting to /login before auth is confirmed.
      loading: true,
      error:   null,

      setUser:    (user)    => set({ user, loading: false, error: null }),
      clearAuth:  ()        => set({ user: null, loading: false, error: null }),
      setLoading: (loading) => set({ loading }),
      setError:   (error)   => set({ error }),

      signOut: async () => {
        try {
          await AuthService.signOut()
          set({ user: null, error: null })
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Sign out failed"
          set({ error: msg })
          throw error
        }
      },
    }),
    {
      name:       "zamorax-auth",
      // Only persist the user object — never persist loading state.
      // loading must always start as true on a fresh page load so guards
      // wait for Supabase to confirm the session before making decisions.
      partialize: (state) => ({ user: state.user }),
    },
  ),
)
