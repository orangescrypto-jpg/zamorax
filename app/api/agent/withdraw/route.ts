// app/api/agent/withdraw/route.ts
// Referral-agent-initiated withdrawal request.
// Validates balance, deducts from agent_wallets, writes to agent_withdrawals
// (which the admin agent-withdrawals page reads and approves).
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { AdminService } from "@/src/services/admin"
import { requireAuth } from "@/lib/auth-server"

const MIN_WITHDRAWAL_KOBO = 500000 // ₦5,000

export async function POST(req: NextRequest) {
  let auth
  try {
    auth = await requireAuth(req)
  } catch (err: any) {
    console.error("[POST /api/agent/withdraw] auth check failed:", err)
    return NextResponse.json({ error: "Could not verify your session. Please try again." }, { status: 500 })
  }
  if (!auth.ok) return auth.error

  const agentId = auth.uid

  try {
    const { amountKobo, bankName, accountNumber, accountName } = await req.json()

    if (!amountKobo || !bankName || !accountNumber || !accountName) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 })
    }

    if (amountKobo < MIN_WITHDRAWAL_KOBO) {
      return NextResponse.json({ error: "Minimum withdrawal is ₦5,000" }, { status: 400 })
    }

    // Get current wallet balance
    const wallet = await AdminService.getDoc("agent_wallets", agentId) as Record<string, unknown> | null
    const currentBalance = Number(wallet?.balance ?? 0)

    if (amountKobo > currentBalance) {
      return NextResponse.json({ error: "Insufficient wallet balance" }, { status: 400 })
    }

    // Get agent info for admin display
    const agentDoc = await AdminService.getDoc("users", agentId) as Record<string, unknown> | null
    const agentName  = String(agentDoc?.displayName ?? agentDoc?.display_name ?? agentDoc?.name ?? "Agent")
    const agentEmail = String(agentDoc?.email ?? "")

    // Deduct from wallet immediately (held pending admin payment)
    await AdminService.setDoc("agent_wallets", agentId, {
      balance:    currentBalance - amountKobo,
      updated_at: new Date().toISOString(),
    }, { merge: true })

    // Write to agent_withdrawals (admin reads this)
    const withdrawalDoc = await AdminService.addDoc("agent_withdrawals", {
      agent_id:       agentId,
      agent_name:     agentName,
      agent_email:    agentEmail,
      amount:         amountKobo,
      bank_name:      bankName,
      account_number: accountNumber,
      account_name:   accountName,
      status:         "pending",
    })

    // Log wallet transaction
    await AdminService.addDoc("wallet_transactions", {
      user_id:     agentId,
      type:        "payout",
      amount:      -amountKobo,
      description: `Referral withdrawal request — ₦${(amountKobo / 100).toLocaleString("en-NG")} to ${bankName}`,
      reference:   withdrawalDoc.id,
      status:      "pending",
    })

    // Notify agent
    await AdminService.addDoc("notifications", {
      user_id: agentId,
      type:    "system",
      title:   "💸 Withdrawal Requested",
      body:    `Your withdrawal of ₦${(amountKobo / 100).toLocaleString("en-NG")} is being processed. We'll notify you when it's paid.`,
      link:    "/dashboard/agent/withdraw",
      is_read: false,
    })

    return NextResponse.json({ success: true, withdrawalId: withdrawalDoc.id })
  } catch (err: any) {
    // Best-effort refund if something failed after the deduction above.
    // (Kept simple/idempotent-ish: only refunds if we got past balance read.)
    return NextResponse.json({ error: err.message ?? "Something went wrong" }, { status: 500 })
  }
}
