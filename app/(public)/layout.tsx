import { Navbar } from "@/components/layout/Navbar"
import { Footer } from "@/components/layout/Footer"
import { BottomNav } from "@/components/layout/BottomNav"

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="flex-1 pt-16">
        {children}
      </main>
      <Footer />
      <BottomNav />
    </>
  )
}
