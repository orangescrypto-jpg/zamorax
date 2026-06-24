// src/services/providers/cloudflare/sellerFollows.ts
// WAS FIREBASE/FIRESTORE → NOW CLOUDFLARE D1
import { AdminService } from "@/src/services/admin"
import type { SellerFollow } from "@/src/types"

function docId(followerId: string, sellerId: string) { return `${followerId}_${sellerId}` }

export const SellerFollowsService = {

  async followSeller(followerId: string, sellerId: string, followerName?: string): Promise<void> {
    await AdminService.setDoc("seller_follows", docId(followerId, sellerId), {
      follower_id:   followerId,
      seller_id:     sellerId,
      follower_name: followerName ?? null,
    })
  },

  async unfollowSeller(followerId: string, sellerId: string): Promise<void> {
    await AdminService.deleteDoc("seller_follows", docId(followerId, sellerId))
  },

  async isFollowing(followerId: string, sellerId: string): Promise<boolean> {
    const row = await AdminService.getDoc("seller_follows", docId(followerId, sellerId))
    return !!row
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
