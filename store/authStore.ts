// store/authStore.ts  — REPLACE EXISTING FILE

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
      partialize: (state) => ({ user: state.user }),
    },
  ),
)
