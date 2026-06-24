// lib/supabase/client.ts
// ─────────────────────────────────────────────────────────────────
// WAS FIREBASE → NOW SUPABASE (Auth only)
// Supabase is used EXCLUSIVELY for authentication.
// All app data lives in Cloudflare D1 (via API routes).
// All files live in Cloudflare R2 (via /api/upload).
// ─────────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js"

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnon) {
  throw new Error(
    "[Supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
    "Add them to .env.local and to Vercel/Cloudflare environment settings.",
  )
}

// Singleton — safe to import anywhere (client + server components)
export const supabase = createClient(supabaseUrl, supabaseAnon, {
  auth: {
    persistSession:    true,
    autoRefreshToken:  true,
    detectSessionInUrl: true,
  },
})
