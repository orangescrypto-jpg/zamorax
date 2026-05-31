"use client"

import { Hero } from "@/components/home/Hero"
import { TrustBar } from "@/components/home/TrustBar"
import { CategoryGrid } from "@/components/home/CategoryGrid"
import { PromoStrip } from "@/components/home/PromoStrip"
import { CategoryListings } from "@/components/home/CategoryListings"
import { BlogPreview } from "@/components/home/BlogPreview"
import { FlashDealsSection } from "@/components/home/FlashDealsSection"
import { FeaturedListings } from "@/components/home/FeaturedListings"
import { HomeQuickFilters } from "@/components/home/HomeQuickFilters"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { Zap } from "lucide-react"

export default function HomePage() {
  const router = useRouter()
  const { isAuthenticated, isSeller } = useAuth()

  const handleStartSelling = () => {
    if (!isAuthenticated()) router.push("/register")
    else if (isSeller()) router.push("/dashboard/seller/post")
    else router.push("/dashboard/become-seller")
  }

  return (
    <>
      <Hero />
      <TrustBar />

      <main className="container py-6 space-y-8">

        {/* Post Free Ad CTA */}
        <button
          onClick={handleStartSelling}
          className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 active:scale-[0.98] text-white font-bold text-sm rounded-2xl py-3.5 transition-all shadow-md shadow-primary/20"
        >
          <Zap className="h-4 w-4" />
          Post a Free Ad — It's Quick & Easy
        </button>

        {/* Quick Filters */}
        <HomeQuickFilters />

        {/* Categories */}
        <CategoryGrid />

        {/* Promo banners */}
        <PromoStrip />

        {/* Flash Deals */}
        <FlashDealsSection />

        {/* Featured / Boosted Listings */}
        <FeaturedListings />

        {/* Blog slider — latest posts */}
        <BlogPreview />

        {/* Live listings by category */}
        <CategoryListings />

        {/* Seller CTA */}
        <section className="relative overflow-hidden bg-secondary rounded-2xl p-6 md:p-10 text-center">
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-primary/10 pointer-events-none" />
          <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-accent/10 pointer-events-none" />

          <div className="relative z-10 space-y-4 max-w-lg mx-auto">
            <span className="inline-block bg-primary/20 text-primary text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
              For Sellers
            </span>
            <h2 className="text-2xl md:text-3xl font-extrabold text-white leading-tight">
              Start Selling Today.<br />
              <span className="text-primary">Zero listing fees.</span>
            </h2>
            <p className="text-white/60 text-sm">
              Reach millions of buyers across Nigeria. Get paid safely via escrow.
            </p>
            <Button
              size="lg"
              className="bg-primary hover:bg-primary/90 text-white font-bold rounded-xl px-8"
              onClick={handleStartSelling}
            >
              <Zap className="mr-2 h-4 w-4" />
              Post Free Ad Now
            </Button>
          </div>
        </section>

      </main>
    </>
  )
}
