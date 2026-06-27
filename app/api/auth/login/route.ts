// app/api/auth/login/route.ts  — REPLACE EXISTING FILE
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"

function friendlyError(message: string): string {
  const map: Record<string, string> = {
    "Invalid login credentials":    "Incorrect email or password.",
    "Email not confirmed":          "Please verify your email before logging in.",
    "User account has been banned": "This account has been suspended. Contact support.",
  }
  return map[message] ?? message ?? "Login failed. Please try again."
}

async function d1Fetch(sql: string, params: unknown[]): Promise<any[]> {
  const accountId  = process.env.CF_ACCOUNT_ID
  const databaseId = process.env.CF_D1_DATABASE_ID
  const apiToken   = process.env.CF_API_TOKEN
  if (!accountId || !databaseId || !apiToken) return []

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiToken}` },
      body:   JSON.stringify({ sql, params }),
      cache:  "no-store",
    },
  )
  const json = await res.json() as any
  if (!json.success) return []
  return json.result?.[0]?.results ?? []
}

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()
    if (!email || !password)
      return NextResponse.json({ error: "Email and password required" }, { status: 400 })

    const responseCookies: Array<{ name: string; value: string; options: any }> = []

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return req.cookies.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach((c) => responseCookies.push(c))
          },
        },
      },
    )

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      return NextResponse.json({ error: friendlyError(error.message) }, { status: 401 })
    }

    const rows = await d1Fetch("SELECT * FROM users WHERE uid = ? LIMIT 1", [data.user.id])
    const profile = rows[0] ?? { uid: data.user.id, email: data.user.email }

    const response = NextResponse.json({ user: data.user, profile })

    // Write Supabase session cookies
    responseCookies.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options)
    })

    return response
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 })
  }
}
