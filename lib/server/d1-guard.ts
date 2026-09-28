// lib/server/d1-guard.ts
// ─────────────────────────────────────────────────────────────────
// Column-level write guard for the browser -> D1 proxy
// (app/api/d1/query/route.ts).
//
// The proxy already restricts WHICH ROWS a user may touch. It did not restrict
// WHICH COLUMNS or which SQL shapes, so any logged-in user could:
//   - UPDATE any listing (price, seller_id, is_boosted, status = 'active')
//   - INSERT OR REPLACE / upsert over other users' rows (wallets, orders, users)
//   - set their own users.role / plan / is_seller_ready, or a wallet balance
//   - create an offer and accept it themselves at any price
//   - mark their own pending_payments row as admin-confirmed
//
// guardNonStaffWrite() runs ONLY for non-staff callers, ONLY on write
// statements, and either rejects, or returns rewritten SQL + params.
// Staff (admin/moderator) still bypass the proxy's row scoping as before.
// ─────────────────────────────────────────────────────────────────

export type GuardResult =
  | { ok: true; sql: string; vals: unknown[] }
  | { ok: false; status: number; error: string }

const deny = (error: string, status = 403): GuardResult => ({ ok: false, status, error })

// ── Tables non-staff can never write through the proxy ───────────
// Money ledgers. Credits/debits happen only in server routes.
export const READ_ONLY_FOR_NON_STAFF = new Set([
  "seller_wallets",
  "wallet_transactions",
  "agent_wallets",
  "pending_payouts",
  "withdrawals",
  "referrals", // created by POST /api/referrals/apply, never from the browser
])

// ── SQL parsing ──────────────────────────────────────────────────
interface ParsedInsert {
  kind: "insert"
  table: string
  orClause: string | null // REPLACE | IGNORE | ...
  cols: string[]
  hasConflictTail: boolean
}
interface ParsedUpdate {
  kind: "update"
  table: string
  assigns: { col: string; rhs: string; nParams: number }[]
  where: string
  whereParams: number
}

const unq = (s: string) => s.trim().replace(/^["'`]|["'`]$/g, "").toLowerCase()
const countQ = (s: string) => (s.match(/\?/g) ?? []).length

function splitTopLevel(s: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ""
  for (const ch of s) {
    if (ch === "(") depth++
    if (ch === ")") depth--
    if (ch === "," && depth === 0) { out.push(cur); cur = ""; continue }
    cur += ch
  }
  if (cur.trim()) out.push(cur)
  return out
}

export function parseInsert(sql: string): ParsedInsert | null {
  const m = /^INSERT\s+(?:OR\s+(\w+)\s+)?INTO\s+["'`]?([a-z_][a-z0-9_]*)["'`]?\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)\s*(ON\s+CONFLICT[\s\S]*)?;?\s*$/i.exec(sql.trim())
  if (!m) return null
  const cols = m[3].split(",").map(unq)
  const ph = m[4].split(",").map(s => s.trim())
  if (cols.length !== ph.length || ph.some(p => p !== "?")) return null
  return {
    kind: "insert",
    table: m[2].toLowerCase(),
    orClause: m[1] ? m[1].toUpperCase() : null,
    cols,
    hasConflictTail: !!m[5],
  }
}

export function parseUpdate(sql: string): ParsedUpdate | null {
  const m = /^UPDATE\s+["'`]?([a-z_][a-z0-9_]*)["'`]?\s+SET\s+([\s\S]+?)\s+WHERE\s+([\s\S]+?);?\s*$/i.exec(sql.trim())
  if (!m) return null
  const assigns: ParsedUpdate["assigns"] = []
  for (const part of splitTopLevel(m[2])) {
    const a = /^\s*["'`]?([a-z_][a-z0-9_]*)["'`]?\s*=\s*([\s\S]+)$/i.exec(part)
    if (!a) return null
    assigns.push({ col: a[1].toLowerCase(), rhs: a[2].trim(), nParams: countQ(a[2]) })
  }
  return { kind: "update", table: m[1].toLowerCase(), assigns, where: m[3], whereParams: countQ(m[3]) }
}

// Rebuild an UPDATE from (possibly filtered) assignments.
function buildUpdate(p: ParsedUpdate, keep: ParsedUpdate["assigns"], vals: unknown[], extraWhere?: { sql: string; params: unknown[] }): { sql: string; vals: unknown[] } {
  // vals layout: assignment params in order, then WHERE params.
  let idx = 0
  const kept: unknown[] = []
  for (const a of p.assigns) {
    const slice = vals.slice(idx, idx + a.nParams)
    idx += a.nParams
    if (keep.includes(a)) kept.push(...slice)
  }
  const whereVals = vals.slice(idx)
  const setSql = keep.map(a => `${a.col} = ${a.rhs}`).join(", ")
  let where = p.where
  let outWhereVals = whereVals
  if (extraWhere) {
    where = `(${p.where}) AND ${extraWhere.sql}`
    outWhereVals = [...whereVals, ...extraWhere.params]
  }
  return { sql: `UPDATE ${p.table} SET ${setSql} WHERE ${where}`, vals: [...kept, ...outWhereVals] }
}

// Value bound to an assignment (only meaningful for plain `col = ?`).
function assignValue(p: ParsedUpdate, vals: unknown[], target: ParsedUpdate["assigns"][number]): unknown {
  let idx = 0
  for (const a of p.assigns) {
    if (a === target) return a.nParams === 1 && /^\?$/.test(a.rhs) ? vals[idx] : undefined
    idx += a.nParams
  }
  return undefined
}

// ── Per-table policy ─────────────────────────────────────────────
const LISTING_PROTECTED = new Set([
  "id", "seller_id", "seller_plan", "seller_rating", "seller_verified",
  "is_boosted", "boost_type", "boost_expires_at",
  "is_hub_verified", "is_featured", "is_zamorax_pick", "is_fbz", "fulfilled_by",
  "approved_by", "approved_at", "rejected_by", "rejected_at", "rejection_reason",
  "delivery_fee_override_kobo", "views", "saves", "inquiries",
  "out_of_stock_since", "restock_notice_sent_at",
])
// Values a seller may put on the ad-boost flags (just "requested"/cleared).
const LISTING_FLAG_ALLOWED_VALUES = new Set(["ad_boost_status", "current_ad_boost_id"])
const LISTING_SELF_STATUS = new Set(["paused", "sold", "active", "draft"])
const LISTING_INSERT_STATUS = new Set(["pending", "pending_fbz", "draft"])

const ORDER_STRIP = new Set([
  "id", "buyer_id", "seller_id", "listing_id",
  "total_amount", "item_price", "platform_fee", "seller_payout",
  "delivery_fee_kobo", "delivery_fee",
  "payment_reference", "payment_provider", "flw_transaction_id", "cart_payment_ref",
  "escrow_status", "escrow_held_at", "released_to_seller", "completed_at", "refunded_at",
  "is_offer_order", "offer_id", "original_price", "line_items", "fulfilled_by",
])
const ORDER_BUYER_ONLY = new Set(["escrow_release_at", "delivered_at"])
const ORDER_ALLOWED_STATUS = new Set([
  "shipped", "delivered", "inspecting", "cancelled", "disputed",
  "return_disputed", "return_confirmed",
])

const USER_DENY = new Set([
  "uid", "email", "role", "plan", "plan_expires_at",
  "verification_level", "verification_status", "pro_verification_status",
  "nin", "bvn", "selfie_url",
  "nin_verified", "bvn_verified", "phone_verified", "email_verified",
  "is_banned", "ban_reason", "is_seller_ready", "is_official",
  "active_listing_count", "seller_rating", "total_sales", "total_rentals",
  "boost_credits_used", "boost_credits_reset_month", "created_at",
])

const OFFER_NEVER = new Set(["id", "buyer_id", "seller_id", "listing_id", "original_price", "quantity", "offer_amount", "created_by", "expires_at"])

const PAYMENT_NEVER = new Set([
  "id", "user_id", "reference", "purpose", "amount", "provider",
  "admin_confirmed", "admin_id", "confirmed_at",
  "rejection_reason", "rejected_at", "rejected_by",
])
const PAYMENT_SELF_STATUS = new Set(["awaiting_transfer", "awaiting_confirmation", "pending"])

const BOOST_NEVER = new Set([
  "id", "seller_id", "listing_id", "payment_reference", "payment_provider",
  "activated_at", "boost_ends_at", "expires_at", "starts_at", "start_date", "end_date",
  "amount", "amount_paid", "ad_spend_budget", "margin_amount",
  "impressions", "clicks", "reach", "week_number",
])

// ── Entry point ──────────────────────────────────────────────────
export function guardNonStaffWrite(input: {
  sql: string
  vals: unknown[]
  stmtType: "insert" | "update" | "delete"
  table: string
  uid: string
}): GuardResult {
  const { sql, vals, stmtType, table, uid } = input

  if (READ_ONLY_FOR_NON_STAFF.has(table)) {
    return deny(`${table} is read-only through this proxy — writes must go through a dedicated API route.`)
  }

  switch (table) {
    case "listings": return guardListings(sql, vals, stmtType, uid)
    case "orders": return guardOrders(sql, vals, stmtType, uid)
    case "users": return guardUsers(sql, vals, stmtType, uid)
    case "offers": return guardOffers(sql, vals, stmtType, uid)
    case "pending_payments": return guardPendingPayments(sql, vals, stmtType, uid)
    case "boosts":
    case "adboosts": return guardBoosts(sql, vals, stmtType, table, uid)
    default: return { ok: true, sql, vals }
  }
}

// Reject the SQL shapes that bypass row scoping.
function rejectUpsertShapes(p: ParsedInsert): GuardResult | null {
  if (p.orClause === "REPLACE" || p.hasConflictTail) {
    return deny(`Replace/upsert on ${p.table} is not allowed through this proxy.`)
  }
  return null
}

function setInsertValue(p: ParsedInsert, vals: unknown[], col: string, value: unknown) {
  const i = p.cols.indexOf(col)
  if (i !== -1) vals[i] = value
}
function insertValue(p: ParsedInsert, vals: unknown[], col: string): unknown {
  const i = p.cols.indexOf(col)
  return i === -1 ? undefined : vals[i]
}

// ── listings ─────────────────────────────────────────────────────
function guardListings(sql: string, valsIn: unknown[], stmtType: string, uid: string): GuardResult {
  const vals = [...valsIn]

  if (stmtType === "insert") {
    const p = parseInsert(sql)
    if (!p) return deny("Malformed listings insert.", 400)
    // ListingForm creates with a fresh UUID via INSERT OR REPLACE. Downgrade to a
    // plain INSERT so an id collision fails instead of overwriting someone's listing.
    if (p.hasConflictTail) return deny("Upsert on listings is not allowed.")
    let out = sql
    if (p.orClause === "REPLACE") out = sql.replace(/^\s*INSERT\s+OR\s+REPLACE\s+INTO/i, "INSERT INTO")

    setInsertValue(p, vals, "seller_id", uid)
    const status = String(insertValue(p, vals, "status") ?? "pending")
    if (!LISTING_INSERT_STATUS.has(status)) setInsertValue(p, vals, "status", "pending")
    for (const c of ["is_boosted", "is_hub_verified", "is_featured", "is_zamorax_pick", "is_fbz", "views", "saves", "inquiries"]) setInsertValue(p, vals, c, 0)
    for (const c of ["boost_type", "boost_expires_at", "approved_by", "approved_at", "rejected_by", "rejected_at", "rejection_reason", "delivery_fee_override_kobo", "seller_plan", "seller_verified", "seller_rating"]) setInsertValue(p, vals, c, null)
    setInsertValue(p, vals, "fulfilled_by", "seller")
    return { ok: true, sql: out, vals }
  }

  const p = parseUpdate(sql)
  if (!p) {
    if (stmtType === "delete") return scopeToOwner(sql, vals, "listings", "seller_id", uid)
    return deny("Malformed listings update.", 400)
  }

  // Anyone signed in may bump the view counter by exactly 1 — nothing else.
  const onlyViews = p.assigns.every(a => a.col === "views" || a.col === "updated_at")
  if (onlyViews && p.assigns.some(a => a.col === "views")) {
    const v = p.assigns.find(a => a.col === "views")!
    const n = Number(assignValue({ ...p, assigns: p.assigns }, vals, v) ?? NaN)
    const isIncrement = /^COALESCE\(\s*views\s*,\s*0\s*\)\s*\+\s*\?$/i.test(v.rhs)
    // For an increment the bound value is the delta; read it by position.
    let idx = 0
    let delta = NaN
    for (const a of p.assigns) { if (a === v) delta = Number(vals[idx]); idx += a.nParams }
    if (isIncrement && delta === 1) return { ok: true, sql, vals }
    void n
    return deny("Only a +1 view increment is allowed.")
  }

  // Owner edits: strip protected columns, keep the rest.
  const keep = p.assigns.filter(a => {
    if (LISTING_PROTECTED.has(a.col)) return false
    if (LISTING_FLAG_ALLOWED_VALUES.has(a.col)) {
      const val = assignValue(p, vals, a)
      return val === null || val === "pending"
    }
    return true
  })
  const statusAssign = keep.find(a => a.col === "status")
  let extra: { sql: string; params: unknown[] } | undefined
  if (statusAssign) {
    const val = String(assignValue(p, vals, statusAssign) ?? "")
    if (!LISTING_SELF_STATUS.has(val)) return deny("That listing status can only be set by staff.")
    // A seller can pause/resume/sell an approved listing, never self-approve
    // a pending, rejected or FBZ-hold one.
    extra = { sql: "status IN ('active','paused','sold','draft')", params: [] }
  }
  if (keep.length === 0) return { ok: true, sql: "UPDATE listings SET updated_at = updated_at WHERE 0", vals: [] }

  const built = buildUpdate(p, keep, vals, extra)
  return scopeToOwner(built.sql, built.vals, "listings", "seller_id", uid)
}

function scopeToOwner(sql: string, vals: unknown[], table: string, ownerCol: string, uid: string): GuardResult {
  if (/\bWHERE\b/i.test(sql)) {
    const out = sql.replace(/\bWHERE\b/i, `WHERE ${table}.${ownerCol} = ? AND (`).trimEnd().replace(/;$/, "") + ")"
    // Owner param sits BEFORE the original WHERE params; SET params (UPDATE) come first.
    const whereIdx = countQ(sql.slice(0, sql.search(/\bWHERE\b/i)))
    return { ok: true, sql: out, vals: [...vals.slice(0, whereIdx), uid, ...vals.slice(whereIdx)] }
  }
  return { ok: true, sql: `${sql.replace(/;$/, "")} WHERE ${table}.${ownerCol} = ?`, vals: [...vals, uid] }
}

// ── orders ───────────────────────────────────────────────────────
function guardOrders(sql: string, valsIn: unknown[], stmtType: string, uid: string): GuardResult {
  const vals = [...valsIn]

  if (stmtType === "insert") {
    const p = parseInsert(sql)
    if (!p) return deny("Malformed orders insert.", 400)
    const r = rejectUpsertShapes(p)
    if (r) return r
    // Client-created orders are manual bank-transfer orders awaiting admin confirmation.
    setInsertValue(p, vals, "buyer_id", uid)
    setInsertValue(p, vals, "status", "pending")
    setInsertValue(p, vals, "released_to_seller", 0)
    for (const c of ["escrow_held_at", "escrow_release_at", "completed_at", "refunded_at", "flw_transaction_id", "delivered_at"]) setInsertValue(p, vals, c, null)
    const prov = insertValue(p, vals, "payment_provider")
    if (prov != null && prov !== "manual") setInsertValue(p, vals, "payment_provider", "manual")
    return { ok: true, sql, vals }
  }

  if (stmtType !== "update") return { ok: true, sql, vals }
  const p = parseUpdate(sql)
  if (!p) return deny("Malformed orders update.", 400)

  const extraParts: string[] = []
  const extraParams: unknown[] = []
  const keep = p.assigns.filter(a => {
    if (ORDER_STRIP.has(a.col)) return false
    if (ORDER_BUYER_ONLY.has(a.col)) return false // handled below
    return true
  })

  // Buyer-only timing columns (confirm delivery): only when the caller is the buyer.
  const buyerOnly = p.assigns.filter(a => ORDER_BUYER_ONLY.has(a.col))
  if (buyerOnly.length) {
    keep.push(...buyerOnly)
    extraParts.push("buyer_id = ?")
    extraParams.push(uid)
  }

  const st = keep.find(a => a.col === "status")
  if (st) {
    const val = String(assignValue(p, vals, st) ?? "")
    if (!ORDER_ALLOWED_STATUS.has(val)) return deny(`Order status "${val}" can only be set by the system.`)
    if (val === "inspecting") { extraParts.push("buyer_id = ?"); extraParams.push(uid) }
  }
  if (keep.length === 0) return { ok: true, sql: "UPDATE orders SET updated_at = updated_at WHERE 0", vals: [] }

  const built = buildUpdate(p, keep, vals, extraParts.length ? { sql: extraParts.join(" AND "), params: extraParams } : undefined)
  return { ok: true, sql: built.sql, vals: built.vals }
}

// ── users ────────────────────────────────────────────────────────
function guardUsers(sql: string, vals: unknown[], stmtType: string, _uid: string): GuardResult {
  if (stmtType === "insert") return deny("User rows are created by the auth routes only.")
  if (stmtType === "delete") return deny("Users cannot be deleted through this proxy.")
  const p = parseUpdate(sql)
  if (!p) return deny("Malformed users update.", 400)
  const bad = p.assigns.find(a => USER_DENY.has(a.col))
  if (bad) return deny(`users.${bad.col} can only be changed by the server.`)
  return { ok: true, sql, vals }
}

// ── offers ───────────────────────────────────────────────────────
// created_by (migration 0015) records who created the row, so "accepted"
// can be restricted to the OTHER party — nobody can accept their own offer.
function guardOffers(sql: string, valsIn: unknown[], stmtType: string, uid: string): GuardResult {
  const vals = [...valsIn]

  if (stmtType === "insert") {
    const p = parseInsert(sql)
    if (!p) return deny("Malformed offers insert.", 400)
    const r = rejectUpsertShapes(p)
    if (r) return r
    const buyer = String(insertValue(p, vals, "buyer_id") ?? "")
    const seller = String(insertValue(p, vals, "seller_id") ?? "")
    if (buyer !== uid && seller !== uid) return deny("You can only create offers you are a party to.")
    setInsertValue(p, vals, "status", "pending")
    setInsertValue(p, vals, "responded_at", null)
    setInsertValue(p, vals, "counter_amount", null)
    const out = p.cols.includes("created_by")
      ? sql
      : sql.replace(/\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i, (_m, c, v) => `(${c}, created_by) VALUES (${v}, ?)`)
    return { ok: true, sql: out, vals: p.cols.includes("created_by") ? (setInsertValue(p, vals, "created_by", uid), vals) : [...vals, uid] }
  }

  if (stmtType !== "update") return { ok: true, sql, vals }
  const p = parseUpdate(sql)
  if (!p) return deny("Malformed offers update.", 400)
  const bad = p.assigns.find(a => OFFER_NEVER.has(a.col))
  if (bad) return deny(`offers.${bad.col} cannot be changed.`)

  const extraParts: string[] = []
  const extraParams: unknown[] = []
  const counter = p.assigns.find(a => a.col === "counter_amount")
  if (counter) { extraParts.push("seller_id = ?"); extraParams.push(uid) }

  const st = p.assigns.find(a => a.col === "status")
  if (st) {
    const val = String(assignValue(p, vals, st) ?? "")
    if (val === "accepted") {
      extraParts.push("(created_by IS NULL OR created_by <> ?)")
      extraParams.push(uid)
    } else if (val === "used") {
      extraParts.push("buyer_id = ?", "status = 'accepted'")
      extraParams.push(uid)
    }
  }
  const built = buildUpdate(p, p.assigns, vals, extraParts.length ? { sql: extraParts.join(" AND "), params: extraParams } : undefined)
  return { ok: true, sql: built.sql, vals: built.vals }
}

// ── pending_payments ─────────────────────────────────────────────
function guardPendingPayments(sql: string, valsIn: unknown[], stmtType: string, uid: string): GuardResult {
  const vals = [...valsIn]

  if (stmtType === "insert") {
    const p = parseInsert(sql)
    if (!p) return deny("Malformed pending_payments insert.", 400)
    const r = rejectUpsertShapes(p)
    if (r) return r
    setInsertValue(p, vals, "user_id", uid)
    const status = String(insertValue(p, vals, "status") ?? "awaiting_transfer")
    if (!PAYMENT_SELF_STATUS.has(status)) setInsertValue(p, vals, "status", "awaiting_transfer")
    setInsertValue(p, vals, "admin_confirmed", 0)
    for (const c of ["admin_id", "confirmed_at", "rejected_at", "rejected_by", "rejection_reason"]) setInsertValue(p, vals, c, null)
    return { ok: true, sql, vals }
  }
  if (stmtType !== "update") return { ok: true, sql, vals }
  const p = parseUpdate(sql)
  if (!p) return deny("Malformed pending_payments update.", 400)
  const bad = p.assigns.find(a => PAYMENT_NEVER.has(a.col))
  if (bad) return deny(`pending_payments.${bad.col} can only be changed by the server.`)
  const st = p.assigns.find(a => a.col === "status")
  if (st && !PAYMENT_SELF_STATUS.has(String(assignValue(p, vals, st) ?? ""))) {
    return deny("That payment status can only be set by staff.")
  }
  // Once staff/gateway confirmed it, it is frozen for the buyer.
  const built = buildUpdate(p, p.assigns, vals, { sql: "COALESCE(admin_confirmed, 0) = 0", params: [] })
  return { ok: true, sql: built.sql, vals: built.vals }
}

// ── boosts / adBoosts ────────────────────────────────────────────
function guardBoosts(sql: string, valsIn: unknown[], stmtType: string, table: string, uid: string): GuardResult {
  const vals = [...valsIn]
  const pendingValue = table === "boosts" ? "pending_payment" : "pending"

  if (stmtType === "insert") {
    const p = parseInsert(sql)
    if (!p) return deny(`Malformed ${table} insert.`, 400)
    const r = rejectUpsertShapes(p)
    if (r) return r
    setInsertValue(p, vals, "seller_id", uid)
    setInsertValue(p, vals, "status", pendingValue) // never self-activated
    for (const c of ["activated_at", "boost_ends_at", "payment_reference", "payment_provider"]) setInsertValue(p, vals, c, c === "payment_reference" ? "" : null)
    return { ok: true, sql, vals }
  }
  if (stmtType !== "update") return scopeDelete(sql, vals, table, uid)

  const p = parseUpdate(sql)
  if (!p) return deny(`Malformed ${table} update.`, 400)
  const bad = p.assigns.find(a => BOOST_NEVER.has(a.col))
  if (bad) return deny(`${table}.${bad.col} can only be changed by the server.`)
  const st = p.assigns.find(a => a.col === "status")
  let extra: { sql: string; params: unknown[] } | undefined
  if (st) {
    if (String(assignValue(p, vals, st) ?? "") !== "cancelled") return deny("Boost status can only be changed by staff.")
    extra = { sql: `status IN ('pending','pending_payment')`, params: [] }
  }
  const built = buildUpdate(p, p.assigns, vals, extra)
  return scopeToOwner(built.sql, built.vals, table === "adboosts" ? "adBoosts" : table, "seller_id", uid)
}

function scopeDelete(sql: string, vals: unknown[], table: string, uid: string): GuardResult {
  return scopeToOwner(sql, vals, table === "adboosts" ? "adBoosts" : table, "seller_id", uid)
}
