// app/(moderator)/layout.tsx
// Server component — role check runs on the server before any page renders.

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { adminAuth } from "@/lib/firebase/admin"
import ModeratorLayoutClient from "./ModeratorLayoutClient"

export default async function ModeratorLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const session = cookieStore.get("__session")?.value

  if (!session) {
    redirect("/login")
  }

  try {
    const decoded = await adminAuth.verifySessionCookie(session, true)
    const { getFirestore } = await import("firebase-admin/firestore")
    const db = getFirestore()
    const userSnap = await db.collection("users").doc(decoded.uid).get()
    const role = userSnap.data()?.role

    if (role !== "moderator" && role !== "admin") {
      redirect("/")
    }
  } catch {
    redirect("/login")
  }

  return <ModeratorLayoutClient>{children}</ModeratorLayoutClient>
}
