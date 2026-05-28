// src/services/providers/firebase/referrals.ts

import {
  doc, getDoc, setDoc, updateDoc, addDoc,
  collection, increment, serverTimestamp,
} from "firebase/firestore"
import { db } from "@/lib/firebase/config"
import type { IReferralsService } from "@/src/services/referrals"

const REFERRAL_REWARDS_DEFAULT = {
  buyer_signup: 50000,   // ₦500 in kobo
  first_order:  200000,  // ₦2,000 in kobo
}

export const ReferralsService: IReferralsService = {

  async getReferralRewards() {
    try {
      const snap = await getDoc(doc(db, "config", "platform"))
      if (!snap.exists()) return REFERRAL_REWARDS_DEFAULT
      const data = snap.data()
      return {
        buyer_signup: data.referralSignupRewardKobo ?? REFERRAL_REWARDS_DEFAULT.buyer_signup,
        first_order:  data.referralOrderRewardKobo  ?? REFERRAL_REWARDS_DEFAULT.first_order,
      }
    } catch {
      return REFERRAL_REWARDS_DEFAULT
    }
  },

  getReferralLink(userId) {
    const base = typeof window !== "undefined" ? window.location.origin : "https://zamorax.ng"
    return `${base}?ref=${userId}`
  },

  async applyReferralCode(newUserId, referrerId) {
    if (newUserId === referrerId) return
    const rewards = await this.getReferralRewards()

    await setDoc(doc(db, "referrals", newUserId), {
      referrerId,
      newUserId,
      status:            "signed_up",
      signupRewardPaid:  false,
      orderRewardPaid:   false,
      createdAt:         serverTimestamp(),
    })

    await this.creditReferralAgent(referrerId, rewards.buyer_signup, "signup", newUserId)
  },

  async triggerFirstOrderBonus(buyerId) {
    const snap = await getDoc(doc(db, "referrals", buyerId))
    if (!snap.exists()) return

    const referral = snap.data()
    if (referral.orderRewardPaid) return

    const rewards = await this.getReferralRewards()

    await updateDoc(doc(db, "referrals", buyerId), {
      orderRewardPaid:    true,
      status:             "ordered",
      orderRewardPaidAt:  serverTimestamp(),
    })

    await this.creditReferralAgent(
      referral.referrerId, rewards.first_order, "first_order", buyerId,
    )
  },

  async creditReferralAgent(agentId, amountKobo, reason, fromUserId) {
    const ref  = doc(db, "agentWallets", agentId)
    const snap = await getDoc(ref)

    if (snap.exists()) {
      await updateDoc(ref, {
        balance:     increment(amountKobo),
        totalEarned: increment(amountKobo),
        updatedAt:   serverTimestamp(),
      })
    } else {
      await setDoc(ref, {
        balance:     amountKobo,
        totalEarned: amountKobo,
        ownerId:     agentId,
        createdAt:   serverTimestamp(),
      })
    }

    await addDoc(collection(db, "agentWallets", agentId, "transactions"), {
      amount: amountKobo, type: "referral", reason, fromUserId, createdAt: serverTimestamp(),
    })
  },
}
