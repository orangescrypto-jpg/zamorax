# Zamorax SEO + portability fixes

Unzip over your project root (paths match your repo), then:
1. Delete the stray 1-byte files `app/a` and `app/g`.
2. Add env var `NEXT_PUBLIC_GSC_VERIFICATION` (Google Search Console "HTML tag" token).
3. Run `npm run build` and click through: `/`, `/categories/<slug>`, `/blog`, `/blog/<slug>`.

Hosting: see `deploy/DEPLOY-ANYWHERE.md`. The app is NOT tied to Vercel.

## Files in this package
NEW
  deploy/DEPLOY-ANYWHERE.md, deploy/ecosystem.config.cjs, deploy/nginx.zamorax.conf, deploy/crontab.txt
  lib/server/listings.ts          server-side D1 query for SSR (60s cache)
  lib/server/blog.ts              single-post query that throws on DB errors (no cached fake 404s)
  components/home/HomeClient.tsx, components/home/LatestListingsServer.tsx
  components/blog/BlogIndexClient.tsx
  app/(public)/blog/[slug]/BlogPostExtras.tsx
  app/(public)/categories/page.tsx, app/(public)/listings/page.tsx
  app/api/blog/[id]/views/route.ts
  app/(public)/{flash-deals,rentals,free-delivery,group-buy,pricing,contact,search}/layout.tsx
  app/(public)/seller/[uid]/layout.tsx
  public/icon-192.png, public/icon-512.png
REPLACED
  app/robots.ts, app/sitemap.ts, app/layout.tsx, middleware.ts (1 line)
  app/(public)/page.tsx, app/(public)/blog/page.tsx, app/(public)/blog/[slug]/page.tsx
  app/(public)/categories/[slug]/page.tsx, app/(public)/listings/[id]/page.tsx
  app/(public)/zamorax-direct/page.tsx
  components/categories/CategoryView.tsx, hooks/useListings.ts
  src/services/providers/cloudflare/listings.ts (+1 export line)

## Behaviour notes (please read)
- Not build-tested: no node_modules/network here. All 30 code files pass a TypeScript
  syntax check and server/client boundaries were reviewed by hand, but run `npm run build`.
- 404 status codes: unknown categories and missing blog posts call notFound() before
  streaming starts, which should give a true HTTP 404. Because app/(public)/loading.tsx
  exists, a not-found that happens LATER in a streamed page comes back as HTTP 200 with a
  Next-injected <meta name="robots" content="noindex">. Google treats that as not indexable,
  but check with `curl -I` on a bad URL.
- Category pages are `force-dynamic`; they do one cached D1 query per category per minute.
- Sitemap deliberately omits /flash-deals, /rentals, /free-delivery, /group-buy, /search
  until those pages are server-rendered.
- /api/listings still returns `_debugError` to the browser on failures (your own TODO).
  Remove before launch.

## Scaling ceiling (same on every host)
Every database call goes through Cloudflare's D1 HTTP API. Cloudflare documents a limit
of 1,200 API requests per 5 minutes per token, and blocks ALL calls for the next 5 minutes
when exceeded (HTTP 429). I did not find D1-specific wording, but D1's HTTP endpoint is part
of that API, so plan for it to apply. This changes nothing between Vercel and a VPS. It is
your architecture's real ceiling. The SSR changes here lower D1 traffic (cached server
queries replace one uncached browser fetch per visitor), but the middleware's role lookup
and most API routes still hit D1 directly. Long term: a Cloudflare Worker in front of D1
(native binding), or a database reachable directly from your server.
