import { useAuthStore } from "@/store/authStore"
import { useCallback } from "react"

export function useAuth() {
  const { user, loading, error, signOut } = useAuthStore()

  const isAuthenticated = useCallback(() => {
    return !!user?.uid
  }, [user])

  const isSeller = useCallback(() => {
    return user?.role === "seller" || user?.role === "both"
  }, [user])

  const isVerified = useCallback(() => {
    return user?.verificationLevel === "nin" || user?.verificationLevel === "nin_bvn"
  }, [user])

  const hasActivePlan = useCallback(() => {
    if (!user) return false
    if (user.plan === "free") return true
    if (!user.planExpiresAt) return false
    return new Date(user.planExpiresAt) > new Date()
  }, [user])

  const getListingLimit = useCallback(() => {
    if (!user) return 0
    switch (user.plan) {
      case "pro": return Infinity
      case "starter": return 20
      case "free": 
      default: return 5
    }
  }, [user])

  return {
    user,
    loading,
    error,
    signOut,
    isAuthenticated,
    isSeller,
    isVerified,
    hasActivePlan,
    getListingLimit,
  }
}
