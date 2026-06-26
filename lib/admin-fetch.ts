// lib/admin-fetch.ts
// Shared fetch wrapper for all admin API calls.
// Automatically attaches the Supabase session token + uid as headers
// so the server can verify identity WITHOUT relying on cookies.
//
// USAGE:
//   import { adminFetch } from "@/lib/admin-fetch"
//   const res = await adminFetch("/api/admin/overview")
//   const res = await adminFetch("/api/admin/settings", { method: "POST", body: JSON.stringify(data) })

import { supabase } from "@/lib/supabase/client"

export async function adminFetch(url: string, options: RequestInit = {}): Promise<Response> {
  // Read session from Supabase client (localStorage — instant, no network)
  let accessToken: string | null = null
  let userId: string | null = null

  try {
    const client = supabase()
    const { data } = await client.auth.getSession()
    let session = data?.session

    // If nothing in localStorage, try a silent refresh
    if (!session) {
      const { data: refreshData } = await client.auth.refreshSession()
      session = refreshData?.session
    }

    if (session) {
      accessToken = session.access_token
      userId      = session.user.id
    }
  } catch { /* non-fatal — headers will just be empty */ }

  // Build auth headers
  const authHeaders: Record<string, string> = {}
  if (accessToken) authHeaders["Authorization"] = `Bearer ${accessToken}`
  if (userId)      authHeaders["x-user-id"]     = userId

  return fetch(url, {
    ...options,
    credentials: "include", // also send cookies as backup
    headers: {
      ...(options.headers as Record<string, string> ?? {}),
      ...authHeaders,
    },
  })
}
