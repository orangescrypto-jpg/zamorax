// app/api/auth/signout/route.ts
// Clears all Firebase auth cookies. The client-side Firebase SDK
// handles its own session state independently.
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"

function clearCookie(res: NextResponse, name: string) {
  res.cookies.set(name, "", {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    path:     "/",
    maxAge:   0,
  })
}

export async function POST(_req: NextRequest) {
  const response = NextResponse.json({ ok: true })

  clearCookie(response, "fb-access-token")
  clearCookie(response, "fb-refresh-token")
  clearCookie(response, "fb-uid")

  return response
}
