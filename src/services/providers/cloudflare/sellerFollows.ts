// src/services/providers/cloudflare/sellerFollows.ts
// WAS FIREBASE/FIRESTORE → NOW CLOUDFLARE D1
import { AdminService } from "@/src/services/admin"
import type { SellerFollow } from "@/src/types"

export const SellerFollowsService = {

  async followSeller(followerId: string, sellerId: string, followerName?: string): Promise<void> {
    // NOTE: seller_follows' real PK is `id` (a UUID), not the composite
    // "followerId_sellerId" string — AdminService.setDoc/getDoc/deleteDoc
    // always operate against `id` (see pkColumn() in
    // src/services/providers/cloudflare/admin.ts), so routing this through
    // setDoc(docId(...)) silently inserted a fresh random-id row on every
    // click (never matching the ON CONFLICT target) while isFollowing()
    // always queried a nonexistent id and returned false — the Follow
    // button looked broken and duplicate rows piled up. Query/write the
    // real columns directly instead of pretending there's a composite PK.
    const already = await this.isFollowing(followerId, sellerId)
    if (already) return
    await AdminService.addDoc("seller_follows", {
      followerId,
      sellerId,
      followerName: followerName ?? null,
    })
  },

  async unfollowSeller(followerId: string, sellerId: string): Promise<void> {
    const all = (await AdminService.getCollection("seller_follows")) as Record<string, unknown>[]
    const row = all.find(
      r => String(r.follower_id ?? r.followerId) === followerId && String(r.seller_id ?? r.sellerId) === sellerId,
    )
    if (row?.id) await AdminService.deleteDoc("seller_follows", String(row.id))
  },

  async isFollowing(followerId: string, sellerId: string): Promise<boolean> {
    const all = (await AdminService.getCollection("seller_follows")) as Record<string, unknown>[]
    return all.some(
      r => String(r.follower_id ?? r.followerId) === followerId && String(r.seller_id ?? r.sellerId) === sellerId,
    )
  },

  async getFollowerCount(sellerId: string): Promise<number> {
    const all = (await AdminService.getCollection("seller_follows")) as Record<string, unknown>[]
    return all.filter(r => String(r.seller_id ?? r.sellerId) === sellerId).length
  },

  async getFollowedSellers(followerId: string): Promise<string[]> {
    const all = (await AdminService.getCollection("seller_follows")) as Record<string, unknown>[]
    return all
      .filter(r => String(r.follower_id ?? r.followerId) === followerId)
      .map(r => String(r.seller_id ?? r.sellerId))
  },
}
