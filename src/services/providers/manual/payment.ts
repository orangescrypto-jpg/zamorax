// src/services/providers/manual/payment.ts
// WAS FIREBASE/FIRESTORE → NOW CLOUDFLARE D1 via AdminService
import { AdminService } from "@/src/services/admin"   // still used for pending_payments, orders, etc.
import { Emails } from "@/src/services/email"
import type { IPaymentService } from "@/src/services/payment"
import type {
  InitializePaymentInput, InitializePaymentResult,
  VerifyPaymentInput, VerifyPaymentResult,
  InitiatePayoutInput, InitiatePayoutResult,
  CreateRecipientInput, CreateRecipientResult,
  ResolveAccountInput, ResolveAccountResult,
  AdminConfirmPaymentInput, BankDetails,
} from "@/src/types/payment"

function generateReference(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`
}
function formatKobo(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString("en-NG")}`
}

export const ManualPaymentService: IPaymentService = {

  provider: "manual",

  async getBankDetails(): Promise<BankDetails | null> {
    try {
      // Bank details are stored in kv_store with key "settings:bankDetails".
      // Use the dedicated API route instead of AdminService.getDoc (which
      // queries the wrong table/key).
      const baseUrl = typeof window !== "undefined"
        ? ""
        : (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000")
      const res = await fetch(`${baseUrl}/api/payment/bank-details`, { cache: "no-store" })
      if (!res.ok) return null
      const { bankDetails } = await res.json() as { bankDetails: BankDetails | null }
      return bankDetails ?? null
    } catch {
      return null
    }
  },

  async initializePayment(input: InitializePaymentInput): Promise<InitializePaymentResult> {
    const { purpose, amount, userId, metadata } = input
    const prefix = purpose === "order" ? "ZMX-ORD" : purpose === "subscription" ? "ZMX-SUB" : "ZMX-BST"
    const reference_code = generateReference(prefix)
    const bankDetails = await ManualPaymentService.getBankDetails()

    await AdminService.addDoc("pending_payments", {
      reference: reference_code, purpose, amount, user_id: userId,
      metadata: JSON.stringify(metadata ?? {}),
      provider: "manual", status: "awaiting_transfer",
      admin_confirmed: false,
    })

    return {
      provider: "manual", manual: true,
      bankDetails: bankDetails ?? {
        bankName: "Bank name not set — contact admin",
        accountNumber: "Not configured", accountName: "Not configured",
      },
      reference_code,
    }
  },

  async verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    try {
      const all = await AdminService.getCollection("pending_payments") as Record<string, unknown>[]
      const payment = all.find(r => String(r.reference) === input.reference)
      if (!payment) return { verified: false }
      if (payment.admin_confirmed) {
        const meta = (() => { try { return JSON.parse(payment.metadata as string ?? "{}") } catch { return {} } })()
        return { verified: true, amount: Number(payment.amount), metadata: meta, manuallyConfirmed: true }
      }
      return { verified: false, manuallyConfirmed: false }
    } catch {
      return { verified: false }
    }
  },

  async adminConfirmPayment(input: AdminConfirmPaymentInput): Promise<void> {
    const { reference, adminId, purpose, orderId, boostId, subscriptionId } = input
    const all = await AdminService.getCollection("pending_payments") as Record<string, unknown>[]
    const payment = all.find(r => String(r.reference) === reference)
    if (!payment) throw new Error(`No pending payment found for reference: ${reference}`)

    await AdminService.updateDoc("pending_payments", String(payment.id), {
      admin_confirmed: true, admin_id: adminId,
      confirmed_at: new Date().toISOString(), status: "confirmed",
    })

    const meta = (() => { try { return JSON.parse(payment.metadata as string ?? "{}") } catch { return {} } })()

    if (purpose === "order" && orderId) {
      await AdminService.updateDoc("orders", orderId, {
        status: "escrow_held", escrow_status: "held",
        escrow_held_at: new Date().toISOString(), payment_reference: reference, payment_provider: "manual",
      })
      await AdminService.addDoc("notifications", {
        user_id: payment.user_id, type: "system", title: "✅ Payment Confirmed!",
        body: "Your payment has been confirmed by the admin. Escrow is now active.",
        link: `/dashboard/buyer/orders/${orderId}`, is_read: false,
      })
      // FIX: seller previously only got a name — deals in Nigeria move by
      // phone call/WhatsApp, not email. Look up the buyer's phone now that
      // payment is confirmed and include it so the seller can reach out.
      const buyerId = String(payment.user_id ?? "")
      const buyer = buyerId ? await AdminService.getDoc("users", buyerId) as Record<string, unknown> | null : null
      const buyerPhone = String(buyer?.phone ?? meta?.buyerPhone ?? "").trim()
      const buyerName  = String(buyer?.fullName ?? meta?.buyerName ?? "The buyer")
      await AdminService.addDoc("notifications", {
        user_id: meta?.sellerId, type: "system", title: "💰 Order Payment Confirmed",
        body: buyerPhone
          ? `Payment confirmed for order. Escrow is active — ship the item to complete. ${buyerName} can be reached on ${buyerPhone}.`
          : "Payment confirmed for order. Escrow is active — ship the item to complete.",
        link: `/dashboard/seller/orders/${orderId}`, is_read: false,
      })

      // FIX: neither buyer nor seller ever got an actual email on this path
      // — only in-app notifications. This function is only ever called
      // server-side (from app/api/payment/verify/route.ts), so it's safe
      // to call Emails.* directly here.
      const order = await AdminService.getDoc("orders", orderId) as Record<string, unknown> | null
      const buyerEmail = String(buyer?.email ?? "")
      if (buyerEmail) {
        Emails.orderConfirmed(buyerEmail, {
          buyerName,
          itemTitle:   String(order?.itemTitle ?? meta?.itemTitle ?? "your item"),
          orderId,
          totalAmount: `₦${(Number(order?.totalAmount ?? 0) / 100).toLocaleString("en-NG")}`,
          sellerName:  String(order?.sellerName ?? meta?.sellerName ?? "the seller"),
        }).catch(() => { /* fire-and-forget */ })
      }
      if (meta?.sellerId) {
        const seller = await AdminService.getDoc("users", String(meta.sellerId)) as Record<string, unknown> | null
        const sellerEmail = String(seller?.email ?? "")
        if (sellerEmail) {
          Emails.orderFundedSeller(sellerEmail, {
            sellerName:  String(seller?.fullName ?? meta?.sellerName ?? "there"),
            itemTitle:   String(order?.itemTitle ?? meta?.itemTitle ?? "your item"),
            orderId,
            totalAmount: `₦${(Number(order?.totalAmount ?? 0) / 100).toLocaleString("en-NG")}`,
            buyerName,
            buyerPhone,
          }).catch(() => { /* fire-and-forget */ })
        }
      }
    }

    if (purpose === "boost" && boostId) {
      await AdminService.updateDoc("boosts", boostId, {
        status: "active", payment_reference: reference, payment_provider: "manual",
        activated_at: new Date().toISOString(),
      })
      await AdminService.addDoc("notifications", {
        user_id: payment.user_id, type: "system", title: "⚡ Boost Activated!",
        body: "Your listing boost has been activated. It will appear in boosted slots now.",
        is_read: false,
      })
    }

    if (purpose === "subscription" && subscriptionId) {
      await AdminService.updateDoc("subscriptions", subscriptionId, {
        status: "active", payment_reference: reference, payment_provider: "manual",
        activated_at: new Date().toISOString(),
      })
      const plan = meta?.plan
      await AdminService.updateDoc("users", String(payment.user_id), {
        plan, plan_expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
      })
      await AdminService.addDoc("notifications", {
        user_id: payment.user_id, type: "system", title: "🎉 Subscription Activated!",
        body: `Your ${plan} plan is now active. Enjoy your benefits!`,
        link: "/dashboard/seller", is_read: false,
      })
    }
  },

  async initiatePayout(input: InitiatePayoutInput): Promise<InitiatePayoutResult> {
    const { sellerId, amountKobo, bankName, accountNumber, accountName, reference } = input
    try {
      const wallet = await AdminService.getDoc("seller_wallets", sellerId) as Record<string, unknown> | null
      const currentBalance = Number(wallet?.balance ?? 0)
      const currentEarned  = Number(wallet?.total_earned ?? wallet?.totalEarned ?? 0)
      const currentPending = Number(wallet?.pending_balance ?? wallet?.pendingBalance ?? 0)

      await AdminService.setDoc("seller_wallets", sellerId, {
        balance:         currentBalance + amountKobo,
        total_earned:    currentEarned  + amountKobo,
        pending_balance: Math.max(0, currentPending - amountKobo),
        updated_at:      new Date().toISOString(),
      }, { merge: true })

      await AdminService.addDoc("wallet_transactions", {
        user_id: sellerId, type: "credit", amount: amountKobo,
        description: `Escrow released — ${formatKobo(amountKobo)} credited to wallet`,
        reference,
      })

      await AdminService.addDoc("pending_payouts", {
        seller_id: sellerId, amount_kobo: amountKobo,
        bank_name: bankName, account_number: accountNumber, account_name: accountName,
        reference, provider: "manual", status: "pending",
      })

      return { success: true, reference, walletCredited: true }
    } catch (err: any) {
      return { success: false, reference, error: err.message }
    }
  },

  async createRecipient(input: CreateRecipientInput): Promise<CreateRecipientResult> {
    return { recipientCode: `MANUAL_${input.accountNumber}_${Date.now()}` }
  },

  async resolveAccount(input: ResolveAccountInput): Promise<ResolveAccountResult> {
    return { accountName: "Manual verification — admin will confirm", accountNumber: input.accountNumber }
  },
}
