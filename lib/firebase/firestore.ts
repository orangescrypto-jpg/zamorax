import { 
  getDocs,
  startAfter,
  orderBy,
  serverTimestamp,
  DocumentData,
  QueryConstraint,
  where,
  limit,
  onSnapshot,
  DocumentSnapshot,
  query
} from "firebase/firestore"
import { AdminService } from "@/src/services"
import { db } from "@/lib/firebase/config"
import { doc } from "firebase/firestore"
import { Listing, ListingFilters } from "@/src/types"
import { Category } from "@/src/types"

// ❌ NO mock data fallbacks anywhere

export async function getListings(filters: ListingFilters = {}, pageParam?: DocumentData) {
  let constraints: QueryConstraint[] = [
    where("isActive", "==", true),
    where("status", "==", "active"),
    orderBy("isBoosted", "desc"),
    orderBy("createdAt", "desc"),
    limit(20)
  ]

  if (filters.category) {
    constraints.unshift(where("categorySlug", "==", filters.category))
  }
  
  if (filters.listingType) {
    constraints.unshift(where("listingType", "==", filters.listingType))
  }
  
  if (filters.condition) {
    constraints.unshift(where("condition", "==", filters.condition))
  }
  
  if (filters.nigerianState) {
    constraints.unshift(where("nigerianState", "==", filters.nigerianState))
  }
  
  if (filters.minPrice !== undefined) {
    constraints.unshift(where("priceSale", ">=", filters.minPrice))
  }
  
  if (filters.maxPrice !== undefined) {
    constraints.unshift(where("priceSale", "<=", filters.maxPrice))
  }
  
  if (filters.verified) {
    constraints.unshift(where("sellerVerified", "==", true))
  }

  const q = pageParam
    ? AdminService._ref_("listings", [...constraints, startAfter(pageParam)])
    : AdminService._ref_("listings", [...constraints])

  const snapshot = await getDocs(q)
  
  return {
    listings: snapshot.docs.map(d => ({ 
      id: d.id, 
      ...d.data() 
    } as Listing)),
    lastVisible: snapshot.docs[snapshot.docs.length - 1],
    hasMore: snapshot.docs.length === 20
  }
}

export async function getListingById(id: string): Promise<Listing | null> {
  const result = await AdminService.getDoc("listings", id)
  if (!result) return null
  return result as unknown as Listing
}

export async function getCategories(phase?: number): Promise<Category[]> {
  const baseQ = AdminService._ref_("categories", [orderBy("order", "asc")])
  const q = phase !== undefined ? query(baseQ, where("phase", "==", phase)) : baseQ
  const snapshot = await getDocs(q)
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Category))
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const q = AdminService._ref_("categories", [where("slug", "==", slug), limit(1)])
  const snapshot = await getDocs(q)
  if (snapshot.empty) return null
  const d = snapshot.docs[0]
  return { id: d.id, ...d.data() } as Category
}

export async function createListing(data: Partial<Listing>, sellerId: string) {
  return await AdminService.addDoc("listings", {
    ...data,
    sellerId,
    isActive: false,
    status: "pending",
    views: 0,
    saves: 0,
    inquiries: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp() })
}

export async function updateListing(id: string, data: Partial<Listing>) {
  await AdminService.updateDoc("listings", id, {
    ...data,
    updatedAt: serverTimestamp() })
}

export async function deleteListing(id: string) {
  await AdminService.deleteDoc("listings", id)
}

// Real-time listener for insurance pool counter (used in TrustBar)

export function subscribeToInsurancePool(callback: (balance: number) => void) {
  const currentMonth = new Date().toISOString().slice(0, 7)
  const docRef = doc(db, "insurancePool", currentMonth)
  
  return onSnapshot(docRef, (snap: DocumentSnapshot) => {
    if (snap.exists()) {
      const data = snap.data()
      callback(data?.netBalance || 0)
    } else {
      callback(0)
    }
  })
}
