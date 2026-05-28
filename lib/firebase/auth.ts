import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  UserCredential
} from "firebase/auth"
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore"
import { auth} from "@/lib/firebase/config"
import { RegisterData } from "@/src/types"

export async function registerUser(data: RegisterData) {
  // Step 1: Create Firebase Auth user
  const userCredential: UserCredential = await createUserWithEmailAndPassword(
    auth,
    data.email,
    data.password
  )
  
  const { user } = userCredential
  
  // Step 2: Create Firestore user document � NO mock
  await AdminService.setDoc("users", user.uid, {
    uid: user.uid,
    email: user.email,
    phone: data.phone,
    fullName: data.fullName,
    username: data.username?.toLowerCase(),
    role: data.role || "buyer",
    plan: data.role === "seller" ? "free" : "free",
    planExpiresAt: null,
    verificationLevel: "none",
    ninVerified: false,
    bvnVerified: false,
    phoneVerified: false,
    isBanned: false,
    activeListingCount: 0,
    sellerRating: 0,
    totalSales: 0,
    totalRentals:  0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  
  // Step 3: Send email verification
  await sendEmailVerification(user)
  
  return { user, needsPhoneVerification: true }
}

export async function loginUser(email: string, password: string) {
  const userCredential = await signInWithEmailAndPassword(auth, email, password)
  
  // Check if user is banned � real Firestore check
  const userDoc = await AdminService.getDoc("users", userCredential.user.uid)
  if (userDoc.exists() && userDoc.data().isBanned) {
    await auth.signOut()
    throw new Error(userDoc.data().banReason || "Account suspended")
  }
  
  return userCredential.user
}

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider()
  const result = await signInWithPopup(auth, provider)
  
  // Check if new user � create Firestore doc if needed
  const userDoc = await AdminService.getDoc("users", result.user.uid)
  if (!userDoc.exists()) {
    await AdminService.setDoc("users", result.user.uid, {
      uid: result.user.uid,
      email: result.user.email,
      fullName: result.user.displayName,
      profilePhoto: result.user.photoURL,
      role: "buyer",
      plan: "free",
      verificationLevel: "none",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }
  
  return result.user
}

export async function setupRecaptchaVerifier(containerId: string) {
  if (typeof window === "undefined") return null
  
  return new RecaptchaVerifier(auth, containerId, {
    size: "invisible",
    callback: () => {},
  })
}

export async function sendPhoneOTP(phone: string, recaptchaVerifier: RecaptchaVerifier) {
  return await signInWithPhoneNumber(auth, phone, recaptchaVerifier)
}

export async function resetPassword(email: string) {
  await sendPasswordResetEmail(auth, email)
}

export async function updateUserProfile(uid: string, updates: Partial<{
  fullName: string
  username: string
  profilePhoto: string
  storeName: string
  storeDescription: string
}>) {
  // Update Firebase Auth profile
  if (updates.fullName || updates.profilePhoto) {
    await updateProfile(auth.currentUser!, {
      displayName: updates.fullName,
      photoURL: updates.profilePhoto,
    })
  }
  
  // Update Firestore
  await AdminService.updateDoc("users", uid, {
    ...updates,
    updatedAt: serverTimestamp(),
  })
}
