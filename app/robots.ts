import type { MetadataRoute } from "next"

const BASE_URL = "https://zamorax.com"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/listings", "/listings/*", "/blog", "/blog/*", "/search", "/how-it-works", "/safety", "/pricing", "/contact"],
        disallow: ["/dashboard/", "/admin/", "/moderator/", "/api/", "/seller/dashboard/"],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  }
}
