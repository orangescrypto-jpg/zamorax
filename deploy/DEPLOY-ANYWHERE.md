# deploy/DEPLOY-ANYWHERE.md — running Zamorax on any host

## Will it run on my host?
Zamorax is a normal Next.js 16 app: `npm run build` then `npm start`. It has no
Vercel-only packages, no Vercel-only APIs, and no reliance on Vercel's file system.

| Host type | Works? |
|---|---|
| VPS (DigitalOcean, Hetzner, Contabo, AWS EC2, Linode...) | Yes: this guide |
| Docker / Coolify / Railway / Render / Fly.io / any "run a Node server" platform | Yes: build command `npm run build`, start command `npm start` |
| Cloudflare Pages/Workers | Needs an adapter (OpenNext); the D1/R2 code already supports native bindings |
| Static-only hosting (GitHub Pages, S3, plain cPanel) | **No.** The app needs a running Node.js server (middleware, API routes, SSR) |

Requires **Node.js 20.9 or newer** (Next.js 16).

## What Vercel was doing for you silently (and what replaces it)
| Vercel did this | On a VPS use | File |
|---|---|---|
| Ran your app + restarted it | PM2 | `ecosystem.config.cjs` |
| HTTPS, domain, proxy, real client IP headers | nginx + certbot | `nginx.zamorax.conf` |
| Cron (`vercel.json`) | system cron | `crontab.txt` |
| Built on every git push | you run the build (below) | |

`vercel.json` and `.vercelignore` are simply ignored on other hosts. Leave or delete them.

## Steps
```bash
# 1. Server: Node 20.9+, nginx, certbot, pm2   (e.g. Ubuntu)
sudo npm i -g pm2

# 2. Get the code, then create the env file (copy every key from .env.local.example)
cp .env.local.example .env.production
nano .env.production     # fill in ALL values; also add the two lines below

#   NEXT_PUBLIC_APP_URL=https://yourdomain.com
#   CRON_SECRET=<long random string>
#   INTERNAL_APP_URL=http://127.0.0.1:3000     # optional; the PM2 file already sets it

# 3. Install + build.  Build AFTER .env.production exists:
npm ci
npm i sharp              # recommended for faster next/image optimisation on your own server
npm run build

# 4. Run
pm2 start deploy/ecosystem.config.cjs
pm2 save && pm2 startup

# 5. nginx + HTTPS + cron: see the comments at the top of each file
#    deploy/nginx.zamorax.conf   deploy/crontab.txt
```

### Two rules that catch people
1. **`NEXT_PUBLIC_*` variables are baked in at build time.** Changing one means running
   `npm run build` again, not just restarting. (This also applies to `NEXT_PUBLIC_APP_URL`,
   which drives your sitemap and robots.txt.)
2. **Build with the database credentials present** (`CF_ACCOUNT_ID`, `CF_D1_DATABASE_ID`,
   `CF_API_TOKEN`). The homepage and blog are pre-rendered; if D1 is unreachable at build
   time they are generated without listings/posts and only fill in after their first refresh.

### Keep it at one process
`middleware.ts` keeps rate-limit counters in memory. PM2 cluster mode or several containers
behind a load balancer would each keep separate counters (limits multiply). One process is
plenty to start with. If you scale out later, move that limiter to the database-backed one
in `lib/rateLimit.ts`.

## If the domain or IP changes
- Point DNS at the new server.
- Update webhook URLs at **Paystack** and **Flutterwave** if the domain changed.
- Update the Site URL / redirect URLs in **Supabase Auth** (and Google sign-in, if used).
- `ZAMORAXLOGIC_*` values, if that service calls back to this domain.

## Verify after going live
```bash
curl -sI https://yourdomain.com | head -1                                   # HTTP/2 200
curl -s  https://yourdomain.com/robots.txt | head
curl -s  https://yourdomain.com/sitemap.xml | grep -c "/listings/"          # > 0
curl -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3000/api/cron/layaway-sweep   # runs a sweep
pm2 logs zamorax --lines 50
```
