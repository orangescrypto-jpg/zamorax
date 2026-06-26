// lib/admin-fetch.ts
// Shared fetch wrapper for all admin/authenticated API calls.
// Automatically attaches the Firebase ID token as a Bearer header
// so the server can verify identity via Firebase Admin SDK.
//
// USAGE:
//   import { adminFetch } from "@/lib/admin-fetch"
//   const res = await adminFetch("/api/admin/overview")
//   const res = await adminFetch("/api/admin/settings", { method: "POST", body: JSON.stringify(data) })

import { firebaseAuth } from "@/lib/firebase/config"

export async function adminFetch(url: string, options: RequestInit = {}): Promise<Response> {
  let accessToken: string | null = null

  try {
    const user = firebaseAuth().currentUser
    if (user) {
      // Force-refresh=false uses the cached token if still valid (< 1 hour old)
      accessToken = await user.getIdToken(false)
    }
  } catch { /* non-fatal — header will be empty, server returns 401 */ }

  const authHeaders: Record<string, string> = {}
  if (accessToken) authHeaders["Authorization"] = `Bearer ${accessToken}`

  return fetch(url, {
    ...options,
    credentials: "include", // also send cookies as backup
    headers: {
      ...(options.headers as Record<string, string> ?? {}),
      ...authHeaders,
    },
  })
}
