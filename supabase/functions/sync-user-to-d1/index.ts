// supabase/functions/sync-user-to-d1/index.ts
// Fires on "After user is created" auth hook.
// Syncs OAuth/magic-link users to D1 — email/password users are
// already inserted by /api/auth/register so ON CONFLICT DO NOTHING
// handles any accidental double-insert.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"

serve(async (req) => {
  try {
    const payload = await req.json()
    const user = payload.record ?? payload.user

    if (!user?.id || !user?.email) {
      return new Response("missing user", { status: 400 })
    }

    const accountId  = Deno.env.get("CF_ACCOUNT_ID")
    const databaseId = Deno.env.get("CF_D1_DATABASE_ID")
    const apiToken   = Deno.env.get("CF_API_TOKEN")

    const now  = new Date().toISOString()
    const name = user.user_metadata?.full_name
              ?? user.user_metadata?.name
              ?? user.email.split("@")[0]
    const role = user.user_metadata?.role ?? "buyer"

    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
      {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${apiToken}`,
        },
        body: JSON.stringify({
          sql: `INSERT INTO users (
            uid, email, phone, full_name, username, role, plan,
            verification_level, nin_verified, bvn_verified, phone_verified,
            email_verified, is_banned, active_listing_count, seller_rating,
            total_sales, total_rentals, is_seller_ready,
            wallet_balance, store_name, store_description, created_at, updated_at
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
          ON CONFLICT(uid) DO NOTHING`,
          params: [
            user.id, user.email, null, name, null,
            role, "free", "none",
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            null, null, now, now,
          ],
        }),
      }
    )

    const json = await res.json()
    if (!json.success) {
      console.error("D1 error:", json.errors)
      return new Response("d1 error", { status: 500 })
    }

    return new Response("ok", { status: 200 })
  } catch (err) {
    console.error("sync-user-to-d1 error:", err)
    return new Response("error", { status: 500 })
  }
})
