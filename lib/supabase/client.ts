// lib/supabase/client.ts
// ─────────────────────────────────────────────────────────────────
// WAS FIREBASE → NOW SUPABASE (Auth only)
// Supabase is used EXCLUSIVELY for authentication.
// All app data lives in Cloudflare D1 (via API routes).
// All files live in Cloudflare R2 (via /api/upload).
// ─────────────────────────────────────────────────────────────────

import { createClient, SupabaseClient } from "@supabase/supabase-js"

// Lazy singleton — validation deferred to first call so Next.js
// build-time module evaluation never hits this throw.
let _supabase: SupabaseClient | undefined

export function supabase(): SupabaseClient {
  if (_supabase) return _supabase

  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnon) {
    throw new Error(
      "[Supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
      "Add them to .env.local and to Vercel environment settings.",
    )
  }

  _supabase = createClient(supabaseUrl, supabaseAnon, {
    auth: {
      persistSession:     true,
      autoRefreshToken:   true,
      detectSessionInUrl: true,
    },
  })

  return _supabase
}
