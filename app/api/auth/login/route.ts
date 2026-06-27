// app/api/auth/login/route.ts  — REPLACE EXISTING FILE
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { d1Query } from "@/lib/d1"

type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

function friendlyError(message: string): string {
  const map: Record<string, string> = {
    "Invalid login credentials":    "Incorrect email or password.",
    "Email not confirmed":          "Please verify your email before logging in.",
    "User account has been banned": "This account has been suspended. Contact support.",
  }
  return map[message] ?? message ?? "Login failed. Please try again."
}

export async function POST(req: NextRequest, context: RouteContext) {
  const nativeDB = (context as any)?.env?.DB

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
          setAll(cookiesToSet: { name: string; value: string; options: any }[]) {
            cookiesToSet.forEach((c) => responseCookies.push(c))
          },
        },
      },
    )

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      return NextResponse.json({ error: friendlyError(error.message) }, { status: 401 })
    }

    let profile: any = { uid: data.user.id, email: data.user.email }
    try {
      const result = await d1Query("SELECT * FROM users WHERE uid = ? LIMIT 1", [data.user.id], nativeDB)
      const rows = (result as any)?.results ?? []
      if (rows[0]) profile = rows[0]
    } catch {
      // fall back to minimal profile if D1 lookup fails
    }

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
