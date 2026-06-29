import { Navbar } from "@/components/layout/Navbar"
import { BottomNav } from "@/components/layout/BottomNav"

// Notifications gets its own clean layout — no footer, just Navbar + content
export default function NotificationsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="flex-1 pt-16 pb-24">
        {children}
      </main>
      <BottomNav />
    </>
  )
}
