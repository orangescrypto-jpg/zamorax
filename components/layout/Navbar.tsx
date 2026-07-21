"use client"

import { AdminService, limit, onSnapshot, where } from "@/src/services"

import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { usePlatformSettings } from "@/hooks/usePlatformSettings"
import { useCartItemsStore } from "@/store/cartStore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Menu, X, Bell, Heart, Search, LogOut,
  User, Store, ShieldCheck, Gift, Package,
  LayoutDashboard, ChevronRight, BadgeCheck, ShoppingCart,
  ShoppingBag, ShieldAlert } from "lucide-react"
import { CartDrawer } from "@/components/cart/CartDrawer"
import { HOMEPAGE_CATEGORIES } from "@/constants/categories"

// Auth pages should never be used as a post-login redirect target — e.g.
// tapping "Log In" while on /register shouldn't send the user back to
// /register after they log in.
const AUTH_PAGE_PREFIXES = ["/login", "/register", "/forgot-password", "/reset-password", "/verify-email"]
function loginHref(pathname: string) {
  const isAuthPage = AUTH_PAGE_PREFIXES.some(p => pathname === p || pathname.startsWith(`${p}/`))
  return isAuthPage ? "/login" : `/login?next=${encodeURIComponent(pathname)}`
}

export function Navbar() {
  const { user, isAuthenticated, signOut, isSeller } = useAuth()
  const { settings } = usePlatformSettings()
  const { cartItems } = useCartItemsStore()
  const pathname = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [notifCount, setNotifCount] = useState(0)
  const [scrolled, setScrolled] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  // Close menu on route change
  useEffect(() => { setMenuOpen(false); setCategoriesOpen(false) }, [pathname])

  // Lock body scroll when sidebar open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [menuOpen])

  useEffect(() => {
    if (!user?.uid) { setNotifCount(0); return }
    const q = AdminService._ref_("notifications", [where("userId", "==", user.uid),
      where("isRead", "==", false),
      limit(50)
    ])
    const unsub = onSnapshot(q, (snap) => setNotifCount(snap.docs.length))
    return () => unsub()
  }, [user?.uid])

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const navLinks = [
    { href: "/search",       label: "Browse" },
    { href: "/rentals",      label: "Rentals" },
    { href: "/pricing",      label: "Pricing" },
    { href: "/how-it-works", label: "How It Works" },
    { href: "/safety",       label: "Safety" },
  ]

  const close = () => setMenuOpen(false)

  const isAdmin     = user?.role === "admin"
  const isModerator = user?.role === "moderator"
  const isBuyer     = user?.role === "buyer"
  const seller      = isSeller()
  const authed      = isAuthenticated()
  const cartCount   = cartItems.length

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-300 ${
          scrolled ? "bg-background/90 backdrop-blur-md shadow-sm" : "bg-background"
        }`}
      >
        <div className="container flex h-16 items-center justify-between gap-2">
          {/* Logo */}
          <Link href="/" className="font-heading font-extrabold text-2xl tracking-tight text-secondary shrink-0">
            ZAMORAX<span className="text-primary">.</span>
          </Link>

          {/* Desktop Search */}
          <div className="hidden md:flex flex-1 max-w-xl mx-6">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search phones, laptops, fashion..."
                className="pl-10 bg-muted/50 border-none focus-visible:ring-primary"
              />
            </div>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-6">
            <div
              className="relative"
              onMouseEnter={() => setCategoriesOpen(true)}
              onMouseLeave={() => setCategoriesOpen(false)}
            >
              <button className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
                Categories
                <ChevronRight className={`h-3.5 w-3.5 transition-transform ${categoriesOpen ? "rotate-90" : ""}`} />
              </button>
              {categoriesOpen && (
                <div className="absolute top-full left-0 pt-2 z-[110]">
                  <div className="w-64 max-h-96 overflow-y-auto bg-background border border-border rounded-xl shadow-lg p-2 grid grid-cols-1 gap-0.5">
                    {HOMEPAGE_CATEGORIES.map(cat => (
                      <Link
                        key={cat.id}
                        href={`/categories/${cat.slug}`}
                        className="px-3 py-2 rounded-lg text-sm text-secondary hover:bg-muted transition-colors"
                      >
                        {cat.name}
                      </Link>
                    ))}
                    <Link
                      href="/search"
                      className="px-3 py-2 rounded-lg text-sm text-primary font-medium hover:bg-primary/5 transition-colors border-t border-border/60 mt-1 pt-2.5"
                    >
                      Browse all categories
                    </Link>
                  </div>
                </div>
              )}
            </div>
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  pathname === link.href ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            {authed ? (
              <>
                {/* Notification Bell */}
                <Button variant="ghost" size="icon" className="relative hidden sm:inline-flex" asChild>
                  <Link href="/notifications">
                    <Bell className="h-5 w-5" />
                    {notifCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                        {notifCount > 9 ? "9+" : notifCount}
                      </span>
                    )}
                  </Link>
                </Button>

                {/* Saved / Wishlist */}
                <Button variant="ghost" size="icon" className="hidden sm:inline-flex" asChild>
                  <Link href="/dashboard/buyer/saved"><Heart className="h-5 w-5" /></Link>
                </Button>

                {/* Cart icon — only when multiCartEnabled */}
                {settings.multiCartEnabled && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="relative inline-flex"
                    onClick={() => setCartOpen(true)}
                    aria-label="Open cart"
                  >
                    <ShoppingCart className="h-5 w-5" />
                    {cartCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                        {cartCount > 9 ? "9+" : cartCount}
                      </span>
                    )}
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" className="hidden sm:inline-flex px-3" asChild>
                  <Link href={loginHref(pathname)}>Log In</Link>
                </Button>
                <Button size="sm" className="bg-primary hover:bg-primary/90 text-white px-3 whitespace-nowrap" asChild>
                  <Link href="/register">Register</Link>
                </Button>
              </>
            )}

            <Button
              className="bg-primary hover:bg-primary/90 text-white hidden md:flex ml-1"
              onClick={() => {
                if (!authed) router.push("/register?role=seller")
                else if (seller) router.push("/dashboard/seller/post")
                else router.push("/dashboard/become-seller")
              }}
            >
              Post Ad
            </Button>

            {/* Mobile Menu Toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden ml-1"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </header>

      {/* Cart Drawer — mounted at root level */}
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />

      {/* ── Mobile Sidebar — rendered via Portal directly into document.body ── */}
      {mounted && createPortal(
        <>
          {/* Backdrop */}
          <div
            onClick={close}
            className={`lg:hidden fixed inset-0 bg-black/50 z-[9998] transition-opacity duration-200 ${
              menuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
            }`}
          />

          {/* Drawer */}
          <aside
            className={`lg:hidden fixed top-0 right-0 h-full w-[80vw] max-w-sm bg-background z-[9999] shadow-2xl flex flex-col transition-transform duration-200 ease-out ${
              menuOpen ? "translate-x-0" : "translate-x-full"
            }`}
          >
            {/* Drawer header */}
            <div className="flex items-center justify-between px-5 h-16 border-b shrink-0">
              <span className="font-heading font-extrabold text-lg text-secondary">
                ZAMORAX<span className="text-primary">.</span>
              </span>
              <button onClick={close} className="p-1 rounded-md hover:bg-muted transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">

              {/* ── Logged-in profile block ── */}
              {authed && user && (
                <Link
                  href="/dashboard/profile"
                  onClick={close}
                  className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20 mb-4 hover:bg-primary/10 transition-colors"
                >
                  <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-secondary truncate">{user.fullName}</p>
                    <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
                    <span className="inline-block text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full capitalize mt-0.5">
                      {user.plan || "free"} plan
                    </span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
                </Link>
              )}

              {/* Search */}
              <div className="pb-3">
                <Input placeholder="Search Zamorax..." className="bg-muted/50" />
              </div>

              {/* Browse links */}
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-1 pt-2 pb-1">Explore</p>

              {/* Categories — expandable list, mobile drawer */}
              <button
                onClick={() => setCategoriesOpen(v => !v)}
                className="w-full flex items-center justify-between py-2.5 px-3 rounded-lg text-sm font-medium text-secondary hover:bg-muted transition-colors"
              >
                Categories
                <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${categoriesOpen ? "rotate-90" : ""}`} />
              </button>
              {categoriesOpen && (
                <div className="pl-3 pb-1 grid grid-cols-1 gap-0.5">
                  {HOMEPAGE_CATEGORIES.map(cat => (
                    <Link
                      key={cat.id}
                      href={`/categories/${cat.slug}`}
                      onClick={close}
                      className="py-2 px-3 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-secondary transition-colors"
                    >
                      {cat.name}
                    </Link>
                  ))}
                </div>
              )}

              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={close}
                  className={`flex items-center justify-between py-2.5 px-3 rounded-lg text-sm font-medium hover:bg-muted transition-colors ${
                    pathname === link.href ? "text-primary bg-primary/5" : "text-secondary"
                  }`}
                >
                  {link.label}
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))}

              {/* Post Ad */}
              <button
                className="w-full flex items-center justify-between py-2.5 px-3 rounded-lg text-sm font-medium text-primary hover:bg-primary/5 transition-colors"
                onClick={() => {
                  close()
                  if (!authed) router.push("/register")
                  else if (seller) router.push("/dashboard/seller/post")
                  else router.push("/dashboard/become-seller")
                }}
              >
                Post Free Ad
                <ChevronRight className="h-4 w-4" />
              </button>

              {/* Cart shortcut in mobile menu */}
              {authed && settings.multiCartEnabled && (
                <button
                  className="w-full flex items-center justify-between py-2.5 px-3 rounded-lg text-sm font-medium hover:bg-muted transition-colors"
                  onClick={() => { close(); setCartOpen(true) }}
                >
                  <span className="flex items-center gap-3">
                    <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                    My Cart
                  </span>
                  {cartCount > 0 && (
                    <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">
                      {cartCount}
                    </span>
                  )}
                </button>
              )}

              {/* ── Authenticated user section ── */}
              {authed && (
                <>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-1 pt-4 pb-1">My Account</p>

                  <Link
                    href="/dashboard/profile"
                    onClick={close}
                    className="flex items-center gap-3 py-2.5 px-3 rounded-lg text-sm font-medium hover:bg-muted transition-colors"
                  >
                    <User className="h-4 w-4 text-muted-foreground" />
                    My Profile
                  </Link>

                  <Link
                    href="/notifications"
                    onClick={close}
                    className="flex items-center gap-3 py-2.5 px-3 rounded-lg text-sm font-medium hover:bg-muted transition-colors"
                  >
                    <Bell className="h-4 w-4 text-muted-foreground" />
                    Notifications
                    {notifCount > 0 && (
                      <span className="ml-auto bg-primary text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">
                        {notifCount > 9 ? "9+" : notifCount}
                      </span>
                    )}
                  </Link>

                  <Link
                    href="/dashboard/buyer/saved"
                    onClick={close}
                    className="flex items-center gap-3 py-2.5 px-3 rounded-lg text-sm font-medium hover:bg-muted transition-colors"
                  >
                    <Heart className="h-4 w-4 text-muted-foreground" />
                    Saved Items
                  </Link>

                  {/* Buyer dashboard — visible to buyers (and all roles, since anyone can buy) */}
                  <Link
                    href="/dashboard/buyer"
                    onClick={close}
                    className="flex items-center gap-3 py-2.5 px-3 rounded-lg text-sm font-medium hover:bg-muted transition-colors"
                  >
                    <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                    Buyer Dashboard
                  </Link>

                  {/* Admin dashboard */}
                  {isAdmin && (
                    <Link
                      href="/admin"
                      onClick={close}
                      className="flex items-center gap-3 py-2.5 px-3 rounded-lg text-sm font-medium text-primary hover:bg-primary/5 transition-colors"
                    >
                      <LayoutDashboard className="h-4 w-4" />
                      Admin Dashboard
                    </Link>
                  )}

                  {/* Moderator dashboard */}
                  {(isModerator || isAdmin) && (
                    <Link
                      href="/moderator"
                      onClick={close}
                      className="flex items-center gap-3 py-2.5 px-3 rounded-lg text-sm font-medium text-amber-700 hover:bg-amber-50 transition-colors"
                    >
                      <ShieldAlert className="h-4 w-4" />
                      Moderator Dashboard
                    </Link>
                  )}

                  {seller ? (
                    <>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-1 pt-4 pb-1">Seller</p>
                      <Link
                        href="/dashboard/seller"
                        onClick={close}
                        className="flex items-center gap-3 py-2.5 px-3 rounded-lg text-sm font-medium hover:bg-muted transition-colors"
                      >
                        <Store className="h-4 w-4 text-muted-foreground" />
                        Seller Dashboard
                      </Link>
                      <Link
                        href="/dashboard/verify"
                        onClick={close}
                        className="flex items-center gap-3 py-2.5 px-3 rounded-lg text-sm font-medium hover:bg-muted transition-colors"
                      >
                        <ShieldCheck className="h-4 w-4 text-green-600" />
                        Verify Identity
                      </Link>
                    </>
                  ) : (
                    <>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-1 pt-4 pb-1">Selling</p>
                      <Link
                        href="/dashboard/become-seller"
                        onClick={close}
                        className="flex items-center gap-3 py-2.5 px-3 rounded-lg text-sm font-medium hover:bg-muted transition-colors"
                      >
                        <Store className="h-4 w-4 text-primary" />
                        Become a Seller
                      </Link>
                    </>
                  )}

                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-1 pt-4 pb-1">Earn</p>

                  <Link
                    href="/dashboard/referrals"
                    onClick={close}
                    className="flex items-center gap-3 py-2.5 px-3 rounded-lg text-sm font-medium hover:bg-amber-50 border border-transparent hover:border-amber-200 transition-colors"
                  >
                    <Gift className="h-4 w-4 text-amber-500" />
                    <span>
                      Refer and Earn
                      <span className="block text-[10px] text-muted-foreground font-normal">Refer buyers or sellers — earn cash</span>
                    </span>
                  </Link>

                  <Link
                    href="/dashboard/zla"
                    onClick={close}
                    className="flex items-center gap-3 py-2.5 px-3 rounded-lg text-sm font-medium hover:bg-blue-50 border border-transparent hover:border-blue-200 transition-colors"
                  >
                    <Package className="h-4 w-4 text-blue-500" />
                    <span>
                      Zamorax Logistics (ZLA)
                      <span className="block text-[10px] text-muted-foreground font-normal">Earn per parcel handled</span>
                    </span>
                  </Link>

                  <div className="pt-4">
                    <button
                      className="w-full flex items-center gap-3 py-2.5 px-3 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/5 transition-colors"
                      onClick={() => { signOut(); close() }}
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </button>
                  </div>
                </>
              )}

              {/* Not logged in */}
              {!authed && (
                <div className="pt-4 space-y-2">
                  <Link
                    href={loginHref(pathname)}
                    onClick={close}
                    className="flex items-center justify-center w-full py-2.5 rounded-lg border text-sm font-medium hover:bg-muted transition-colors"
                  >
                    Log In
                  </Link>
                  <Link
                    href="/register"
                    onClick={close}
                    className="flex items-center justify-center w-full py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    Register
                  </Link>
                </div>
              )}
            </div>
          </aside>
        </>,
        document.body
      )}
    </>
  )
}
