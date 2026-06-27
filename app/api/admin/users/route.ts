// app/api/admin/users/route.ts
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-server"
import { d1Query } from "@/lib/d1"

type RouteContext = { params: Promise<Record<string, string>>; env?: { DB?: unknown } }

function rowToUser(row: Record<string, unknown>) {
  return {
    id:                 row.uid ?? row.id,
    uid:                row.uid ?? row.id,
    email:              row.email,
    phone:              row.phone,
    fullName:           row.full_name,
    username:           row.username,
    role:               row.role,
    plan:               row.plan,
    planExpiresAt:      row.plan_expires_at,
    verificationLevel:  row.verification_level,
    ninVerified:        !!row.nin_verified,
    bvnVerified:        !!row.bvn_verified,
    phoneVerified:      !!row.phone_verified,
    emailVerified:      !!row.email_verified,
    isBanned:           !!row.is_banned,
    banReason:          row.ban_reason,
    activeListingCount: row.active_listing_count,
    sellerRating:       row.seller_rating,
    totalSales:         row.total_sales,
    isSellerReady:      !!row.is_seller_ready,
    profilePhoto:       row.profile_photo,
    storeName:          row.store_name,
    storeDescription:   row.store_description,
    createdAt:          row.created_at,
    updatedAt:          row.updated_at,
  }
}

export async function GET(req: NextRequest, context: RouteContext) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.error

  const nativeDB = (context as any)?.env?.DB

  const { searchParams } = new URL(req.url)
  const search  = searchParams.get("search")?.trim() ?? ""
  const filter  = searchParams.get("filter") ?? "all"   // all | seller | buyer | banned | moderator | admin
  const page    = Math.max(0, parseInt(searchParams.get("page") ?? "0", 10))
  const limit   = 25

  const wheres: string[] = []
  const vals:   unknown[] = []

  if (search) {
    wheres.push(`(full_name LIKE ? OR email LIKE ? OR username LIKE ? OR phone LIKE ?)`)
    const q = `%${search}%`
    vals.push(q, q, q, q)
  }

  if (filter === "seller")    { wheres.push(`role IN ('seller','both')`);    }
  if (filter === "buyer")     { wheres.push(`role IN ('buyer','both')`);     }
  if (filter === "banned")    { wheres.push(`is_banned = 1`);                }
  if (filter === "moderator") { wheres.push(`role = 'moderator'`);           }
  if (filter === "admin")     { wheres.push(`role = 'admin'`);               }

  const where = wheres.length ? `WHERE ${wheres.join(" AND ")}` : ""

  try {
    const [countRows, rows] = await Promise.all([
      d1Query<{ total: number }>(
        `SELECT COUNT(*) as total FROM users ${where}`,
        vals, nativeDB,
      ),
      d1Query(
        `SELECT * FROM users ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...vals, limit, page * limit], nativeDB,
      ),
    ])

    const total = Number((countRows as any)?.[0]?.total ?? 0)
    const users = ((rows as any[]) ?? []).map(r => rowToUser(r as any))

    return NextResponse.json({ users, total, page, limit, hasMore: (page + 1) * limit < total })
  } catch (err: any) {
    console.error("[admin/users]", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// PATCH /api/admin/users — update role, plan, ban status
export async function PATCH(req: NextRequest, context: RouteContext) {
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth.error

  const nativeDB = (context as any)?.env?.DB

  try {
    const { uid, role, plan, isBanned, banReason, ninVerified } = await req.json()
    if (!uid) return NextResponse.json({ error: "uid required" }, { status: 400 })

    const sets: string[] = ["updated_at = ?"]
    const vals: unknown[] = [new Date().toISOString()]

    if (role       !== undefined) { sets.push("role = ?");         vals.push(role) }
    if (plan       !== undefined) { sets.push("plan = ?");         vals.push(plan) }
    if (isBanned   !== undefined) { sets.push("is_banned = ?");    vals.push(isBanned ? 1 : 0) }
    if (banReason  !== undefined) { sets.push("ban_reason = ?");   vals.push(banReason) }
    if (ninVerified!== undefined) { sets.push("nin_verified = ?"); vals.push(ninVerified ? 1 : 0) }

    vals.push(uid)
    await d1Query(`UPDATE users SET ${sets.join(", ")} WHERE uid = ?`, vals, nativeDB)

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
