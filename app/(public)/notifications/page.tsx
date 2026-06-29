// app/(public)/dashboard/notifications/page.tsx
// Redirect: /dashboard/notifications → /notifications
// The Navbar links here, but the real page lives at /notifications.
import { redirect } from "next/navigation"

export default function DashboardNotificationsRedirect() {
  redirect("/notifications")
}
