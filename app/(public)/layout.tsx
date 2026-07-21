import { Navbar } from "@/components/layout/Navbar"
import { Footer } from "@/components/layout/Footer"
import { BottomNav } from "@/components/layout/BottomNav"
import { FooterBanner } from "@/components/shared/FooterBanner"
import { CartAbandonmentReminder } from "@/components/cart/CartAbandonmentReminder"

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="flex-1 pt-16">
        {children}
      </main>
      <FooterBanner />
      <Footer />
      <BottomNav />
      <CartAbandonmentReminder />
    </>
  )
}
