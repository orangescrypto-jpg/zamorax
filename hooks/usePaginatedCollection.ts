"use client"
import { useState, useEffect, useCallback } from "react"
import { QueryConstraint, DocumentSnapshot } from "firebase/firestore"
import { getPaginatedCollection } from "@/src/services/providers/firebase/paginatedCollection"

interface Options {
  collectionPath: string
  constraints?: QueryConstraint[]
  pageSize?: number
}

export function usePaginatedCollection<T = any>({ collectionPath, constraints = [], pageSize = 20 }: Options) {
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null)

  const load = useCallback(async (after?: DocumentSnapshot | null) => {
    try {
      const result = await getPaginatedCollection<T>({ collectionPath, constraints, pageSize }, after ?? undefined)
      if (after) {
        setItems(prev => [...prev, ...result.items])
      } else {
        setItems(result.items)
        setTotal(result.items.length)
      }
      setLastDoc(result.lastDoc)
      setHasMore(result.hasMore)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [collectionPath, pageSize])

  useEffect(() => {
    setLoading(true)
    load(null)
  }, [load])

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore) return
    setLoadingMore(true)
    load(lastDoc)
  }, [hasMore, loadingMore, lastDoc, load])

  const reload = useCallback(() => {
    setLoading(true)
    setItems([])
    setLastDoc(null)
    load(null)
  }, [load])

  return { items, loading, loadingMore, hasMore, total, loadMore, reload }
}
