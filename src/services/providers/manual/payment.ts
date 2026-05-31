// src/services/providers/manual/payment.ts
import {
  doc, getDoc, setDoc, updateDoc, addDoc,
  collection, serverTimestamp,
} from "firebase/firestore"
import { db } from "@/lib/firebase/config"
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
      const snap = await getDoc(doc(db, "settings", "bankDetails"))
      if (!snap.exists()) return null
      return snap.data() as BankDetails
    } catch (err) {
      console.error("ManualPayment: could not fetch bank details", err)
      return null
    }
  },

  async initializePayment(input: InitializePaymentInput): Promise<InitializePaymentResult> {
    const { purpose, amount, userId, metadata } = input
    const prefix = purpose === "order" ? "ZMX-ORD" : purpose === "subscription" ? "ZMX-SUB" : "ZMX-BST"
    const reference_code = generateReference(prefix)
    const bankDetails = await ManualPaymentService.getBankDetails()

    await addDoc(collection(db, "pendingPayments"), {
      reference: reference_code, purpose, amount, userId, metadata,
      provider: "manual", status: "awaiting_transfer",
      adminConfirmed: false,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
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
      const { getDocs, query, where } = await import("firebase/firestore")
      const snap = await getDocs(
        query(collection(db, "pendingPayments"), where("reference", "==", input.reference))
      )

      if (snap.size === 0) return { verified: false }

      const payment = snap.docs[0].data()

      if (payment.adminConfirmed) {
        return { verified: true, amount: payment.amount, metadata: payment.metadata, manuallyConfirmed: true }
      }

      return { verified: false, manuallyConfirmed: false }
    } catch (err) {
      console.error("ManualPayment: verifyPayment error", err)
      return { verified: false }
    }
  },

  async adminConfirmPayment(input: AdminConfirmPaymentInput): Promise<void> {
    const { reference, adminId, purpose, orderId, boostId, subscriptionId } = input

    const { getDocs, query, where } = await import("firebase/firestore")
    const snap = await getDocs(
      query(collection(db, "pendingPayments"), where("reference", "==", reference))
    )

    if (snap.size === 0) throw new Error(`No pending payment found for reference: ${reference}`)

    const paymentDoc = snap.docs[0]
    const payment = paymentDoc.data()

    await updateDoc(paymentDoc.ref, {
      adminConfirmed: true, adminId,
      confirmedAt: serverTimestamp(), status: "confirmed", updatedAt: serverTimestamp(),
    })

    if (purpose === "order" && orderId) {
      await updateDoc(doc(db, "orders", orderId), {
        status: "escrow_held", escrowStatus: "held",
        escrowHeldAt: serverTimestamp(), paymentReference: reference,
        paymentProvider: "manual", updatedAt: serverTimestamp(),
      })
      await addDoc(collection(db, "notifications"), {
        userId: payment.userId, type: "system",
        title: "✅ Payment Confirmed!",
        body: "Your payment has been confirmed by the admin. Escrow is now active.",
        link: `/dashboard/buyer/orders/${orderId}`, read: false, createdAt: serverTimestamp(),
      })
      await addDoc(collection(db, "notifications"), {
        userId: payment.metadata?.sellerId, type: "system",
        title: "💰 Order Payment Confirmed",
        body: `Payment confirmed for order. Escrow is active — ship the item to complete.`,
        link: `/dashboard/seller/orders/${orderId}`, read: false, createdAt: serverTimestamp(),
      })
    }

    if (purpose === "boost" && boostId) {
      await updateDoc(doc(db, "boosts", boostId), {
        status: "active", paymentReference: reference,
        paymentProvider: "manual", activatedAt: serverTimestamp(), updatedAt: serverTimestamp(),
      })
      await addDoc(collection(db, "notifications"), {
        userId: payment.userId, type: "system",
        title: "⚡ Boost Activated!",
        body: "Your listing boost has been activated. It will appear in boosted slots now.",
        read: false, createdAt: serverTimestamp(),
      })
    }

    if (purpose === "subscription" && subscriptionId) {
      await updateDoc(doc(db, "subscriptions", subscriptionId), {
        status: "active", paymentReference: reference,
        paymentProvider: "manual", activatedAt: serverTimestamp(), updatedAt: serverTimestamp(),
      })
      const plan = payment.metadata?.plan
      await updateDoc(doc(db, "users", payment.userId), {
        plan, planExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: serverTimestamp(),
      })
      await addDoc(collection(db, "notifications"), {
        userId: payment.userId, type: "system",
        title: "🎉 Subscription Activated!",
        body: `Your ${plan} plan is now active. Enjoy your benefits!`,
        link: "/dashboard/seller", read: false, createdAt: serverTimestamp(),
      })
    }
  },

  async initiatePayout(input: InitiatePayoutInput): Promise<InitiatePayoutResult> {
    const { sellerId, amountKobo, bankName, accountNumber, accountName, reference } = input
    try {
      const { FieldValue } = await import("firebase/firestore") as any
      const walletRef = doc(db, "sellerWallets", sellerId)
      await setDoc(walletRef, {
        balance: FieldValue.increment(amountKobo),
        totalEarned: FieldValue.increment(amountKobo),
        pendingBalance: FieldValue.increment(-amountKobo),
        updatedAt: serverTimestamp(),
      }, { merge: true })
      await addDoc(collection(db, "walletTransactions"), {
        sellerId, type: "credit", amount: amountKobo,
        description: `Escrow released — ${formatKobo(amountKobo)} credited to wallet`,
        reference, createdAt: serverTimestamp(),
      })
      await addDoc(collection(db, "pendingPayouts"), {
        sellerId, amountKobo, bankName, accountNumber, accountName,
        reference, provider: "manual", status: "pending",
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      })
      return { success: true, reference, walletCredited: true }
    } catch (err: any) {
      console.error("ManualPayment: initiatePayout error", err)
      return { success: false, reference, error: err.message }
    }
  },

  async createRecipient(input: CreateRecipientInput): Promise<CreateRecipientResult> {
    const recipientCode = `MANUAL_${input.accountNumber}_${Date.now()}`
    return { recipientCode }
  },

  async resolveAccount(input: ResolveAccountInput): Promise<ResolveAccountResult> {
    return {
      accountName: "Manual verification — admin will confirm",
      accountNumber: input.accountNumber,
    }
  },
}
