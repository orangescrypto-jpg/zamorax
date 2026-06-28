"use client"
// hooks/usePaginatedCollection.ts
// WAS FIREBASE → NOW CLOUDFLARE D1 via AdminService
import { useState, useEffect, useCallback, useRef } from "react"
import type { QueryConstraint } from "@/lib/db/shims"
import { AdminService } from "@/src/services/admin"

interface Options {
  collectionPath: string
  constraints?:   QueryConstraint[]
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
  constraints = [],
  pageSize = 20,
}: Options): Result<T> {
  const [items,       setItems]       = useState<T[]>([])
  const [loading,     setLoading]     = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore,     setHasMore]     = useState(false)
  const [total,       setTotal]       = useState(0)
  const [offset,      setOffset]      = useState(0)

  // Store constraints in a ref so they never cause useCallback/useEffect to re-run.
  // The caller passes a new array literal on every render (e.g. [where(...), orderBy(...)]),
  // which would otherwise cause an infinite load loop showing 0 results.
  const constraintsRef = useRef(constraints)
  constraintsRef.current = constraints

  const load = useCallback(async (currentOffset: number) => {
    try {
      const all = await AdminService.getCollection(collectionPath, constraintsRef.current) as T[]
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
  }, [collectionPath, pageSize]) // constraints intentionally excluded — read via ref above

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
