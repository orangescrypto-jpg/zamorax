// app/(admin)/layout.tsx
// Server component — role check runs on the server before any page renders.
// The client AdminLayout below handles the sidebar/nav UI.

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { adminAuth } from "@/lib/firebase/admin"
import AdminLayoutClient from "./AdminLayoutClient"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Read the Firebase session cookie set by your auth flow
  const cookieStore = await cookies()
  const session = cookieStore.get("__session")?.value

  if (!session) {
    redirect("/login")
  }

  try {
    const decoded = await adminAuth.verifySessionCookie(session, true)
    // Fetch the user's Firestore role via Admin SDK
    const { getFirestore } = await import("firebase-admin/firestore")
    const db = getFirestore()
    const userSnap = await db.collection("users").doc(decoded.uid).get()
    const role = userSnap?.role

    if (role !== "admin") {
      redirect("/")
    }
  } catch {
    redirect("/login")
  }

  return <AdminLayoutClient>{children}</AdminLayoutClient>
}
