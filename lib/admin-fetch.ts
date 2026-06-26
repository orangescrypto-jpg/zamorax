// lib/admin-fetch.ts
// Shared fetch wrapper for all admin/authenticated API calls.
// Waits for Firebase auth to be ready before sending the token,
// so currentUser is never null due to a race condition on mount.

import { firebaseAuth } from "@/lib/firebase/config"
import { onAuthStateChanged } from "firebase/auth"

function waitForAuth(): Promise<string | null> {
  return new Promise((resolve) => {
    const auth = firebaseAuth()
    // If already resolved, return immediately
    if (auth.currentUser !== null) {
      auth.currentUser.getIdToken(false).then(resolve).catch(() => resolve(null))
      return
    }
    // Otherwise wait for auth state to settle (fires once)
    const unsub = onAuthStateChanged(auth, async (user) => {
      unsub()
      if (user) {
        try {
          const token = await user.getIdToken(false)
          resolve(token)
        } catch {
          resolve(null)
        }
      } else {
        resolve(null)
      }
    })
  })
}

export async function adminFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const accessToken = await waitForAuth()

  const authHeaders: Record<string, string> = {}
  if (accessToken) authHeaders["Authorization"] = `Bearer ${accessToken}`

  return fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.headers as Record<string, string> ?? {}),
      ...authHeaders,
    },
  })
}
