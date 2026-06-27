// lib/admin-fetch.ts
// Shared fetch wrapper for all admin/authenticated API calls.
// Waits for Firebase auth to be ready, then always force-refreshes
// the ID token before sending it. This avoids 401s caused by sending
// a cached token that expired mid-session (Firebase ID tokens last 1hr
// and the SDK's background refresh can lag, especially right after
// a tab has been idle or just woken from sleep).

import { firebaseAuth } from "@/lib/firebase/config"
import { onAuthStateChanged } from "firebase/auth"

function waitForUser(): Promise<import("firebase/auth").User | null> {
  return new Promise((resolve) => {
    const auth = firebaseAuth()
    if (auth.currentUser !== null) {
      resolve(auth.currentUser)
      return
    }
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub()
      resolve(user)
    })
  })
}

async function getFreshToken(): Promise<string | null> {
  const user = await waitForUser()
  if (!user) return null
  try {
    // force=true: always hits Firebase to get a non-expired token instead
    // of trusting the SDK's cached copy.
    return await user.getIdToken(true)
  } catch {
    return null
  }
}

export async function adminFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await getFreshToken()

  const authHeaders: Record<string, string> = {}
  if (token) authHeaders["Authorization"] = `Bearer ${token}`

  return fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.headers as Record<string, string> ?? {}),
      ...authHeaders,
    },
  })
}
