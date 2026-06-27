// lib/admin-fetch.ts
// Shared fetch wrapper for all admin/authenticated API calls.
// Gets a fresh Supabase access token before every request to avoid
// sending a stale JWT (Supabase tokens expire after 1 hour; the SDK
// refreshes in the background but can lag on idle/woken tabs).

import { createClient } from "@/lib/supabase/client"

async function getFreshToken(): Promise<string | null> {
  const supabase = createClient()

  // refreshSession() forces a round-trip to Supabase Auth to get a
  // non-expired token, equivalent to Firebase's getIdToken(true).
  const { data, error } = await supabase.auth.refreshSession()
  if (error || !data.session) return null
  return data.session.access_token
}

export async function adminFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await getFreshToken()

  const authHeaders: Record<string, string> = {}
  if (token) authHeaders["Authorization"] = `Bearer ${token}`

  return fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      ...((options.headers as Record<string, string>) ?? {}),
      ...authHeaders,
    },
  })
}
