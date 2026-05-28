"use client"

import {AdminService, query, limit, orderBy, where, serverTimestamp} from "@/src/services"

import { useEffect, useState, useCallback } from "react"
import { Listing } from "@/src/types"
import { ListingCard } from "@/components/listings/ListingCard"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/useAuth"
import { useRouter } from "next/navigation"
import { Sparkles, TrendingUp } from "lucide-react"

// ─────────────────────────────────────────────
// BROWSE TRACKER
// Call this in listings/[id]/page.tsx useEffect to record category views
// e.g: trackCategoryView(user.uid, listing.categoryId)
// ─────────────────────────────────────────────
export async function trackCategoryView(userId: string, categoryId: string) {
  if (!userId || !categoryId) return
  try {
    const ref = doc( "browseHistory", `${userId}_${categoryId}`)
    const snap = await AdminService.getDoc("browseHistory", `${userId}_${categoryId}`)
    const current = snap.exists() ? snap.data().viewCount || 0 : 0
    await AdminService.setDoc("stockAlerts", `${user.uid}_${listingId}`, {
      userId,
      categoryId,
      viewCount: current + 1,
      lastViewedAt: serverTimestamp() }, { merge: true })
  } catch (e) {
    console.error("trackCategoryView error:", e)
  }
}

// ─────────────────────────────────────────────
// GET USER'S TOP CATEGORIES (sorted by view count)
// ─────────────────────────────────────────────
async function getUserTopCategories(userId: string): Promise<string[]> {
  try {
    const q = await AdminService.getCollection("browseHistory", [where("userId", "==", userId]),
      orderBy("viewCount", "desc"),
      limit(4)
    )
    const snap = await AdminService.getCollection(q)
    return snap.docs.map(d => d.data().categoryId as string)
  } catch {
    return []
  }
}

// ─────────────────────────────────────────────
// PERSONALISED FEED COMPONENT
// ─────────────────────────────────────────────
interface PersonalisedSection {
  categoryId: string
  categoryName: string
  listings: Listing[]
}

const CATEGORY_NAMES: Record<string, string> = {
  "phones-tablets": "Phones & Tablets",
  "computing": "Computing",
  "electronics": "Electronics",
  "fashion": "Fashion",
  "home-office": "Home & Office",
  "health-beauty": "Health & Beauty",
  "baby-products": "Baby Products",
  "sporting-goods": "Sporting Goods",
  "groceries": "Groceries",
  "other": "Other" }

export function PersonalisedFeed() {
  const { user, isAuthenticated } = useAuth()
  const router = useRouter()

  const [sections, setSections] = useState<PersonalisedSection[]>([])
  const [loading, setLoading] = useState(true)
  const [isPersonalised, setIsPersonalised] = useState(false)

  const fetchFeed = useCallback(async () => {
    setLoading(true)

    let topCategories: string[] = []

    if (isAuthenticated() && user?.uid) {
      topCategories = await getUserTopCategories(user.uid)
    }

    const hasPersonalData = topCategories.length >= 2
    setIsPersonalised(hasPersonalData)

    // If not enough browse history, fall back to all categories
    if (!hasPersonalData) {
      topCategories = [
        "phones-tablets", "computing", "fashion", "electronics"
      ]
    }

    const results: PersonalisedSection[] = []

    for (const categoryId of topCategories) {
      try {
        const q = await AdminService.getCollection("listings", [where("categoryId", "==", categoryId]),
          where("status", "==", "active"),
          where("isActive", "==", true),
          orderBy("createdAt", "desc"),
          limit(8)
        )
        const snap = await AdminService.getCollection(q)
        const listings = snap.docs.map(d => ({ id: d.id, ...d.data() } as Listing))

        if (listings.length > 0) {
          results.push({
            categoryId,
            categoryName: CATEGORY_NAMES[categoryId] || categoryId,
            listings })
        }
      } catch {
        // skip on error
      }
    }

    setSections(results)
    setLoading(false)
  }, [user?.uid, isAuthenticated])

  useEffect(() => {
    fetchFeed()
  }, [fetchFeed])

  if (loading) {
    return (
      <div className="space-y-10">
        {[1, 2, 3].map(i => (
          <div key={i} className="space-y-4">
            <div className="h-8 w-48 bg-muted rounded-lg animate-pulse" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="h-56 bg-muted/50 rounded-xl animate-pulse" />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (sections.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground text-lg">No listings yet. Be the first to post!</p>
        <Button className="mt-4" onClick={() => router.push("/dashboard/become-seller")}>
          Post Free Ad
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-12">
      {/* Personalisation label */}
      {isPersonalised && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-primary/5 px-4 py-2.5 rounded-xl w-fit">
          <Sparkles className="h-4 w-4 text-primary" />
          <span>Inspired by your browsing</span>
        </div>
      )}

      {!isPersonalised && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <TrendingUp className="h-4 w-4 text-primary" />
          <span>Trending on Zamorax</span>
        </div>
      )}

      {sections.map(section => (
        <div key={section.categoryId}>
          <div className="flex items-center justify-between mb-4 border-b pb-3">
            <h2 className="text-xl font-heading font-bold text-secondary">
              {section.categoryName}
            </h2>
            <Button variant="link" asChild className="text-primary text-sm font-medium p-0">
              <a href={`/categories/${section.categoryId}`}>See All →</a>
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {section.listings.map(listing => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
