"use client"
// hooks/usePaginatedCollection.ts
// Replaces full-table AdminService.getCollection() fetch with a paginated
// server-side SQL query via /api/d1/query.
// This avoids loading 10k+ rows into memory for large tables like users/orders.

import { useState, useEffect, useCallback, useRef } from "react"

interface Options {
  // D1 table name — must be in the ALLOWED_TABLES list in /api/d1/query/route.ts
  collectionPath: string
  // Optional WHERE clause fragment and its bound parameters.
  // Example: { clause: "seller_id = ? AND status = ?", params: [sellerId, "active"] }
  filter?: { clause: string; params: unknown[] }
  // Optional ORDER BY — defaults to "created_at DESC"
  orderBy?: string
  pageSize?: number
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

async function queryPage(
  table:    string,
  filter:   { clause: string; params: unknown[] } | undefined,
  orderBy:  string,
  limit:    number,
  offset:   number,
): Promise<{ rows: Record<string, unknown>[]; total: number }> {
  const where  = filter?.clause ? `WHERE ${filter.clause}` : ""
  const params = filter?.params ?? []

  // Fetch count and page in parallel
  const [countRes, rowsRes] = await Promise.all([
    fetch("/api/d1/query", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        sql:    `SELECT COUNT(*) as total FROM ${table} ${where}`,
        params,
      }),
    }),
    fetch("/api/d1/query", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        sql:    `SELECT * FROM ${table} ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
        params: [...params, limit, offset],
      }),
    }),
  ])

  const [countJson, rowsJson] = await Promise.all([
    countRes.json() as Promise<{ results?: { total?: number }[] }>,
    rowsRes.json()  as Promise<{ results?: Record<string, unknown>[] }>,
  ])

  const total = Number(countJson?.results?.[0]?.total ?? 0)
  const rows  = rowsJson?.results ?? []
  return { rows, total }
}

export function usePaginatedCollection<T = any>({
  collectionPath,
  filter,
  orderBy  = "created_at DESC",
  pageSize = 20,
}: Options): Result<T> {
  const [items,       setItems]       = useState<T[]>([])
  const [loading,     setLoading]     = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore,     setHasMore]     = useState(false)
  const [total,       setTotal]       = useState(0)
  const [offset,      setOffset]      = useState(0)

  // Stable refs so callbacks don't go stale
  const filterRef    = useRef(filter)
  const orderByRef   = useRef(orderBy)
  const pageSizeRef  = useRef(pageSize)
  useEffect(() => { filterRef.current   = filter  }, [filter])
  useEffect(() => { orderByRef.current  = orderBy }, [orderBy])
  useEffect(() => { pageSizeRef.current = pageSize }, [pageSize])

  const load = useCallback(async (currentOffset: number, replace: boolean) => {
    try {
      const { rows, total: t } = await queryPage(
        collectionPath,
        filterRef.current,
        orderByRef.current,
        pageSizeRef.current,
        currentOffset,
      )
      if (replace) setItems(rows as T[])
      else         setItems(prev => [...prev, ...rows as T[]])
      setTotal(t)
      setHasMore(currentOffset + pageSizeRef.current < t)
      setOffset(currentOffset)
    } catch (err) {
      console.error("[usePaginatedCollection]", err)
      if (replace) setItems([])
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [collectionPath])

  // Initial load & reload when collection or filter changes
  useEffect(() => {
    setLoading(true)
    setItems([])
    setOffset(0)
    load(0, true)
  }, [load, collectionPath]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore) return
    setLoadingMore(true)
    load(offset + pageSizeRef.current, false)
  }, [hasMore, loadingMore, offset, load])

  const reload = useCallback(() => {
    setLoading(true)
    setItems([])
    setOffset(0)
    load(0, true)
  }, [load])

  return { items, loading, loadingMore, hasMore, total, loadMore, reload }
}
