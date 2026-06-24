import { useState, useEffect } from "react"
import { ListingsService } from "@/src/services"
import type { Category } from "@/src/types"

export type { Category }

export function useCategories(phase?: number) {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoading(true)
        const data = await ListingsService.getCategories(phase)
        setCategories(data)
      } catch (err: any) {
        console.error("Category fetch failed:", err)
        setError(err.message || "Failed to load categories")
      } finally {
        setLoading(false)
      }
    }

    fetchCategories()
  }, [phase])

  return { categories, loading, error }
}
