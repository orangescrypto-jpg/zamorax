// src/services/providers/cloudflare/listings.ts
// WAS FIREBASE/FIRESTORE → NOW CLOUDFLARE D1
import { AdminService } from "@/src/services/admin"
import type { IListingsService } from "@/src/services/listings"
import type { Listing, ListingFilters, PaginatedResult, Category } from "@/src/types"

const PAGE_SIZE = 20

function mapRow(row: Record<string, unknown>): Listing {
  const parse = (v: unknown) => {
    if (!v) return undefined
    try { return JSON.parse(v as string) } catch { return v }
  }
  return {
    ...row,
    id:             String(row.id),
    sellerId:       String(row.seller_id ?? row.sellerId ?? ""),
    title:          String(row.title ?? ""),
    categorySlug:   String(row.category_slug ?? row.categorySlug ?? ""),
    listingType:    String(row.listing_type ?? row.listingType ?? "sale"),
    condition:      row.condition ? String(row.condition) : undefined,
    priceSale:      Number(row.price_sale ?? row.priceSale ?? 0),
    priceRentDay:   row.price_rent_day   ? Number(row.price_rent_day)   : undefined,
    priceRentWeek:  row.price_rent_week  ? Number(row.price_rent_week)  : undefined,
    priceRentMonth: row.price_rent_month ? Number(row.price_rent_month) : undefined,
    images:         parse(row.images) ?? [],
    videos:         parse(row.videos) ?? [],
    nigerianState:  row.nigerian_state ? String(row.nigerian_state) : undefined,
    lga:            row.lga ? String(row.lga) : undefined,
    isActive:       !!row.is_active,
    status:         String(row.status ?? "pending"),
    isBoosted:      !!row.is_boosted,
    boostExpiresAt: row.boost_expires_at ? String(row.boost_expires_at) : undefined,
    flashDeal:      parse(row.flash_deal) ?? null,
    sellerVerified: !!row.seller_verified,
    sellerRating:   Number(row.seller_rating ?? 0),
    sellerName:     row.seller_name ? String(row.seller_name) : undefined,
    sellerPhoto:    row.seller_photo ? String(row.seller_photo) : undefined,
    views:          Number(row.views ?? 0),
    saves:          Number(row.saves ?? 0),
    inquiries:      Number(row.inquiries ?? 0),
    tags:           parse(row.tags) ?? [],
    searchableTitle: row.searchable_title ? String(row.searchable_title) : undefined,
    createdAt:      String(row.created_at ?? new Date().toISOString()),
    updatedAt:      String(row.updated_at ?? new Date().toISOString()),
  } as Listing
}

function mapCategoryRow(row: Record<string, unknown>): Category {
  return {
    id:          String(row.id),
    name:        String(row.name ?? ""),
    slug:        String(row.slug ?? ""),
    icon:        row.icon ? String(row.icon) : undefined,
    imageUrl:    row.image_url ? String(row.image_url) : undefined,
    description: row.description ? String(row.description) : undefined,
    parentId:    row.parent_id ? String(row.parent_id) : undefined,
    phase:       Number(row.phase ?? 1),
    order:       Number(row.order ?? 0),
    isActive:    !!row.is_active,
  } as Category
}

export const ListingsService: IListingsService = {

  async getListings(filters: ListingFilters = {}, cursor?: unknown): Promise<PaginatedResult<Listing>> {
    // Build WHERE clauses
    const conditions: string[] = ["is_active = 1", "status = 'active'"]
    const params: unknown[] = []

    if (filters.category)      { conditions.push("category_slug = ?");   params.push(filters.category) }
    if (filters.listingType)   { conditions.push("listing_type = ?");    params.push(filters.listingType) }
    if (filters.condition)     { conditions.push("condition = ?");       params.push(filters.condition) }
    if (filters.nigerianState) { conditions.push("nigerian_state = ?");  params.push(filters.nigerianState) }
    if (filters.verified)      { conditions.push("seller_verified = 1") }
    if (filters.minPrice !== undefined) { conditions.push("price_sale >= ?"); params.push(filters.minPrice) }
    if (filters.maxPrice !== undefined) { conditions.push("price_sale <= ?"); params.push(filters.maxPrice) }
    if (filters.q) { conditions.push("searchable_title LIKE ?"); params.push(`${filters.q.toLowerCase()}%`) }

    // Cursor-based pagination using created_at offset
    if (cursor && typeof cursor === "string") {
      conditions.push("created_at < ?")
      params.push(cursor)
    }

    const where  = conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""
    const sql    = `SELECT * FROM listings ${where} ORDER BY is_boosted DESC, created_at DESC LIMIT ${PAGE_SIZE + 1}`
    const rows   = await AdminService.getCollection("_raw_sql_listings") as any[]
    // Fallback to direct getCollection (shim handles it)
    const all    = (await AdminService.getCollection("listings")) as Record<string, unknown>[]
    const mapped = all.map(mapRow)

    // Client-side filter (D1 HTTP shim fetches all — replace with real SQL when on CF Pages)
    let filtered = mapped.filter(l => l.isActive && l.status === "active")
    if (filters.category)      filtered = filtered.filter(l => l.categorySlug === filters.category)
    if (filters.listingType)   filtered = filtered.filter(l => l.listingType === filters.listingType)
    if (filters.condition)     filtered = filtered.filter(l => l.condition === filters.condition)
    if (filters.nigerianState) filtered = filtered.filter(l => l.nigerianState === filters.nigerianState)
    if (filters.verified)      filtered = filtered.filter(l => l.sellerVerified)
    if (filters.minPrice !== undefined) filtered = filtered.filter(l => (l.priceSale ?? 0) >= filters.minPrice!)
    if (filters.maxPrice !== undefined) filtered = filtered.filter(l => (l.priceSale ?? 0) <= filters.maxPrice!)
    if (filters.q)             filtered = filtered.filter(l => l.title?.toLowerCase().includes(filters.q!.toLowerCase()))

    filtered.sort((a: any, b: any) => (b.isBoosted ? 1 : 0) - (a.isBoosted ? 1 : 0) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    const page = filtered.slice(0, PAGE_SIZE)
    return {
      items:      page,
      nextCursor: page.length === PAGE_SIZE ? page[page.length - 1]?.createdAt ?? null : null,
      hasMore:    filtered.length > PAGE_SIZE,
    }
  },

  async getListingById(id) {
    const row = await AdminService.getDoc("listings", id)
    if (!row) return null
    return mapRow(row as Record<string, unknown>)
  },

  async getListingsByIds(ids) {
    if (!ids.length) return []
    const all = (await AdminService.getCollection("listings")) as Record<string, unknown>[]
    return all.filter(r => ids.includes(String(r.id))).map(mapRow)
  },

  async getCategories(phase) {
    const all = (await AdminService.getCollection("categories")) as Record<string, unknown>[]
    const filtered = phase !== undefined ? all.filter(r => Number(r.phase) === phase) : all
    return filtered.sort((a: any, b: any) => Number(a.order) - Number(b.order)).map(mapCategoryRow)
  },

  async getCategoryBySlug(slug) {
    const all = (await AdminService.getCollection("categories")) as Record<string, unknown>[]
    const row = all.find(r => String(r.slug) === slug)
    return row ? mapCategoryRow(row) : null
  },

  async createListing(data, sellerId) {
    return AdminService.addDoc("listings", {
      ...data,
      seller_id:  sellerId,
      is_active:  false,
      status:     "pending",
      views:      0,
      saves:      0,
      inquiries:  0,
      is_boosted: false,
      images:     JSON.stringify(data.images ?? []),
      videos:     JSON.stringify(data.videos ?? []),
      tags:       JSON.stringify(data.tags ?? []),
      searchable_title: data.title?.toLowerCase() ?? "",
    })
  },

  async updateListing(id, data) {
    const patch: Record<string, unknown> = { ...data }
    if (data.images) patch.images = JSON.stringify(data.images)
    if (data.videos) patch.videos = JSON.stringify(data.videos)
    if (data.tags)   patch.tags   = JSON.stringify(data.tags)
    if (data.title)  patch.searchable_title = data.title.toLowerCase()
    await AdminService.updateDoc("listings", id, patch)
  },

  async deleteListing(id) {
    await AdminService.deleteDoc("listings", id)
  },

  async pauseListing(id) {
    await AdminService.updateDoc("listings", id, { is_active: false, status: "paused" })
  },

  async resumeListing(id) {
    await AdminService.updateDoc("listings", id, { is_active: true, status: "active" })
  },

  async saveListing(listingId, userId) {
    await AdminService.addDoc("saved_listings", {
      user_id: userId,
      listing_id: listingId,
    })
  },

  async unsaveListing(listingId, userId) {
    const all = (await AdminService.getCollection("saved_listings")) as Record<string, unknown>[]
    const row = all.find(r => String(r.user_id) === userId && String(r.listing_id) === listingId)
    if (row) await AdminService.deleteDoc("saved_listings", String(row.id))
  },

  async getSavedListings(userId) {
    const all = (await AdminService.getCollection("saved_listings")) as Record<string, unknown>[]
    const ids = all.filter(r => String(r.user_id) === userId).map(r => String(r.listing_id))
    if (!ids.length) return []
    return this.getListingsByIds(ids)
  },

  async createFlashDeal(listingId, discountPercent, hours) {
    const expiresAt = new Date(Date.now() + hours * 3600000).toISOString()
    await AdminService.updateDoc("listings", listingId, {
      flash_deal:    JSON.stringify({ discountPercent, expiresAt, createdAt: new Date().toISOString() }),
      is_flash_deal: true,
    })
  },

  async cancelFlashDeal(listingId) {
    await AdminService.updateDoc("listings", listingId, { flash_deal: null, is_flash_deal: false })
  },

  async approveListing(listingId, adminUid) {
    await AdminService.updateDoc("listings", listingId, {
      status:           "active",
      is_active:        true,
      approved_by:      adminUid,
      approved_at:      new Date().toISOString(),
      rejection_reason: null,
    })
  },

  async rejectListing(listingId, adminUid, reason) {
    if (!reason.trim()) throw new Error("Rejection reason is required")
    await AdminService.updateDoc("listings", listingId, {
      status:           "rejected",
      is_active:        false,
      rejected_by:      adminUid,
      rejected_at:      new Date().toISOString(),
      rejection_reason: reason.trim(),
    })
  },

  isFlashDealActive(listing: Listing): boolean {
    if (!listing?.flashDeal?.expiresAt) return false
    return new Date(listing.flashDeal.expiresAt) > new Date()
  },

  getFlashPrice(originalKobo: number, discountPercent: number): number {
    return Math.round(originalKobo * (1 - discountPercent / 100))
  },

  // WAS: onSnapshot(doc(db, "insurancePool", month)) → NOW: poll
  // TODO: Durable Objects realtime later
  subscribeToInsurancePool(callback) {
    const month = new Date().toISOString().slice(0, 7)
    let active = true
    const run = async () => {
      if (!active) return
      try {
        const row = await AdminService.getDoc("insurance_pool", month)
        callback(row ? Number((row as any).net_balance ?? 0) : 0)
      } catch { callback(0) }
      if (active) setTimeout(run, 60_000)
    }
    run()
    return () => { active = false }
  },
}
