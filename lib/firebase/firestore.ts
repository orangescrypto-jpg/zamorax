import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  startAfter, 
  getDocs, 
  doc, 
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  DocumentData,
  QueryConstraint
} from "firebase/firestore"
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
    ? AdminService._query_("listings", [...constraints, startAfter(pageParam]))
    : AdminService._query_("listings", [...constraints])

  const snapshot = await getDocs(q)
  
  return {
    listings: snapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data() 
    } as Listing)),
    lastVisible: snapshot.docs[snapshot.docs.length - 1],
    hasMore: snapshot.docs.length === 20
  }
}

export async function getListingById(id: string): Promise<Listing | null> {
  const docRef = doc( "listings", id)
  const docSnap = await getDoc(docRef)
  
  if (!docSnap.exists()) return null
  return { id: docSnap.id, ...docSnap.data() } as Listing
}

export async function getCategories(phase?: number): Promise<Category[]> {
  let q = AdminService._query_("categories", [orderBy("order", "asc"]))
  
  if (phase !== undefined) {
    q = query(q, where("phase", "==", phase))
  }
  
  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category))
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const q = AdminService._ref_("categories", [where("slug", "==", slug]), limit(1))
  const snapshot = await getDocs(q)
  
  if (snapshot.empty) return null
  const doc = snapshot.docs[0]
  return { id: doc.id, ...doc.data() } as Category
}

export async function createListing(data: Partial<Listing>, sellerId: string) {
  return await AdminService.addDoc("listings", {
    ...data,
    sellerId,
    isActive: false, // Requires admin approval or auto-activate based on rules
    status: "pending",
    views: 0,
    saves: 0,
    inquiries: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp() })
}

export async function updateListing(id: string, data: Partial<Listing>) {
  const docRef = doc( "listings", id)
  await updateDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp() })
}

export async function deleteListing(id: string) {
  await AdminService.deleteDoc("listings", id)
}

// Real-time listener for insurance pool counter (used in TrustBar)
import { onSnapshot, DocumentSnapshot } from "firebase/firestore"

export function subscribeToInsurancePool(callback: (balance: number) => void) {
  const currentMonth = new Date().toISOString().slice(0, 7) // "2025-01"
  const docRef = doc( "insurancePool", currentMonth)
  
  return onSnapshot(docRef, (snap: DocumentSnapshot) => {
    if (snap.exists()) {
      const data = snap.data()
      callback(data?.netBalance || 0)
    } else {
      callback(0)
    }
  })
}
