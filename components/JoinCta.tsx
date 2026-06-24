"use client"

// components/JoinCta.tsx
// Generic auth-aware "join the platform" CTA.
//
// Why this exists:
// Several public pages (about, how-it-works, pricing, shared wishlists, etc.)
// show a "Get Started / Join Zamorax" button. A few of these were hardcoded as
// <a href="/register">, which sends already-registered/logged-in users back
// through the signup flow instead of their dashboard. This component checks
// auth state via useAuth() and routes accordingly, so any page that needs a
// "join us" CTA can use this instead of hand-rolling the link.
//
// Usage:
//   <JoinCta />                                  // default label + style
//   <JoinCta label="Start Trading on Zamorax" />  // custom label
//   <JoinCta variant="outline" size="default" />  // shadcn Button variants
//   <JoinCta loggedInLabel="Go to Wishlist" loggedInHref="/dashboard/buyer/saved" />

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/useAuth"

interface JoinCtaProps {
  /** Label shown to logged-out visitors. Default: "Get Started — It's Free" */
  label?: string
  /** Label shown to logged-in users. Default: "Go to Dashboard" */
  loggedInLabel?: string
  /** Where logged-in users go if you want to override the role-based default dashboard route */
  loggedInHref?: string
  /** Where logged-out visitors go. Default: "/register" */
  href?: string
  className?: string
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive"
  size?: "default" | "sm" | "lg" | "icon"
}

export function JoinCta({
  label = "Get Started — It's Free",
  loggedInLabel = "Go to Dashboard",
  loggedInHref,
  href = "/register",
  className,
  variant = "default",
  size = "lg",
}: JoinCtaProps) {
  const { isAuthenticated, isSeller, loading } = useAuth()

  if (loading) return null

  const loggedIn = isAuthenticated()
  const resolvedHref = loggedIn
    ? loggedInHref ?? (isSeller() ? "/dashboard/seller" : "/dashboard/buyer")
    : href
  const resolvedLabel = loggedIn ? loggedInLabel : label

  return (
    <Button asChild variant={variant} size={size} className={className}>
      <Link href={resolvedHref}>{resolvedLabel}</Link>
    </Button>
  )
}
