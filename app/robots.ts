// app/robots.ts
import type { MetadataRoute } from "next"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://zamorax.com"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        // No "allow" list needed: everything not disallowed is crawlable.
        // (An allow-list of "/listings/*" etc. adds nothing and is easy to
        // get out of sync with real routes.)
        allow: "/",
        disallow: [
          "/api/",
          "/admin/",
          "/moderator/",
          "/dashboard/",
          "/seller/dashboard/",
          "/chat",          // private conversations (also matches /chat/...)
          "/wishlist",      // private + shared wishlists
          "/notifications",
          "/track",         // order tracking
          "/login",
          "/register",
          "/maintenance",
          "/search?",       // faceted/filtered result URLs → duplicate content
          "/*?ref=",        // referral-tagged duplicates of every page
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    // NOTE: `host` is a Yandex-only directive; Google ignores it. Removed.
  }
}
