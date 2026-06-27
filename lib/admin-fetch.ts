// lib/admin-fetch.ts
// Shared fetch wrapper for all admin/authenticated API calls.

import { firebaseAuth } from "@/lib/firebase/config"
import { onAuthStateChanged } from "firebase/auth"

function waitForAuth(): Promise<{ token: string | null; uid: string | null }> {
  return new Promise((resolve) => {
    const auth = firebaseAuth()
    if (auth.currentUser !== null) {
      auth.currentUser.getIdToken(false)
        .then(token => resolve({ token, uid: auth.currentUser!.uid }))
        .catch(() => resolve({ token: null, uid: auth.currentUser?.uid ?? null }))
      return
    }
    const unsub = onAuthStateChanged(auth, async (user) => {
      unsub()
      if (user) {
        try {
          const token = await user.getIdToken(false)
          resolve({ token, uid: user.uid })
        } catch {
          resolve({ token: null, uid: user.uid })
        }
      } else {
        resolve({ token: null, uid: null })
      }
    })
  })
}

export async function adminFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const { token, uid } = await waitForAuth()

  const authHeaders: Record<string, string> = {}
  if (token) authHeaders["Authorization"] = `Bearer ${token}`
  if (uid)   authHeaders["x-user-id"] = uid

  return fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.headers as Record<string, string> ?? {}),
      ...authHeaders,
    },
  })
}
