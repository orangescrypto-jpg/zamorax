"use client"
// hooks/usePaginatedCollection.ts
// WAS FIREBASE → NOW CLOUDFLARE D1 via AdminService
import { useState, useEffect, useCallback } from "react"
import type { QueryConstraint } from "@/lib/db/shims"
import { AdminService } from "@/src/services/admin"

interface Options {
  collectionPath: string
  constraints?:   QueryConstraint[]   // accepted but unused — D1 sorts server-side
  pageSize?:      number
}

interface Result<T> {
  items:       T[]
  loading:     boolean
  loadingMore: boolean
  hasMore:     boolean
  total:       number
  loadMore:    () => void
  reload:      () => void
}

export function usePaginatedCollection<T = any>({
  collectionPath,
  constraints: _constraints = [],       // forwarded to getCollection for server-side filtering
  pageSize = 20,
}: Options): Result<T> {
  const [items,       setItems]       = useState<T[]>([])
  const [loading,     setLoading]     = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore,     setHasMore]     = useState(false)
  const [total,       setTotal]       = useState(0)
  const [offset,      setOffset]      = useState(0)

  const load = useCallback(async (currentOffset: number) => {
    try {
      // Pass constraints to getCollection so buyerId/sellerId filters are applied
      const all = await AdminService.getCollection(collectionPath, _constraints) as T[]
      const page = all.slice(currentOffset, currentOffset + pageSize)
      if (currentOffset === 0) {
        setItems(page)
        setTotal(all.length)
      } else {
        setItems(prev => [...prev, ...page])
      }
      setHasMore(currentOffset + pageSize < all.length)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [collectionPath, pageSize, _constraints])

  useEffect(() => {
    setLoading(true)
    setOffset(0)
    load(0)
  }, [load])

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore) return
    setLoadingMore(true)
    const next = offset + pageSize
    setOffset(next)
    load(next)
  }, [hasMore, loadingMore, offset, pageSize, load])

  const reload = useCallback(() => {
    setLoading(true)
    setItems([])
    setOffset(0)
    load(0)
  }, [load])

  return { items, loading, loadingMore, hasMore, total, loadMore, reload }
}
