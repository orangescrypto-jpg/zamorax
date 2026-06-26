// lib/verifyFirebaseToken.ts
// Server-only helper. Verifies a Firebase ID token and returns the uid.
// Returns null on any failure — callers must treat null as Unauthorized.

import { getAdminAuth } from "@/lib/firebase/admin"

export async function verifyFirebaseToken(token: string): Promise<string | null> {
  try {
    const decoded = await getAdminAuth().verifyIdToken(token)
    return decoded.uid
  } catch {
    return null
  }
}
