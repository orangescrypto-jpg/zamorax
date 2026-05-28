// src/services/providers/firebase/paginatedCollection.ts
import {
  collection, query, getDocs, startAfter,
  QueryConstraint, DocumentSnapshot, limit as fsLimit,
} from "firebase/firestore"
import { db } from "@/lib/firebase/config"

interface Options {
  collectionPath: string
  constraints?: QueryConstraint[]
  pageSize?: number
}

export async function getPaginatedCollection<T = any>(
  { collectionPath, constraints = [], pageSize = 20 }: Options,
  after?: DocumentSnapshot
): Promise<{ items: T[]; lastDoc: DocumentSnapshot | null; hasMore: boolean }> {
  const base = constraints.slice()
  if (after) base.push(startAfter(after))
  base.push(fsLimit(pageSize + 1))

  const q = query(collection(db, collectionPath), ...base)
  const snap = await getDocs(q)
  const hasMore = snap.docs.length > pageSize
  const docs = hasMore ? snap.docs.slice(0, pageSize) : snap.docs
  return {
    items: docs.map(d => ({ id: d.id, ...d.data() } as T)),
    lastDoc: docs[docs.length - 1] ?? null,
    hasMore,
  }
}
