# Cron triggers for Zamorax (layaway sweep and escrow release)

This project can run its scheduled jobs a few different ways. Use whichever
matches your setup. You do not need more than one.

## Option A -- cron-job.org (recommended, what this project uses)

1. Set a CRON_SECRET environment variable on your hosting platform (any
   long random string).
2. On cron-job.org, create a new cron job with this URL:
   `https://yourdomain.com/api/cron/layaway-sweep?secret=YOUR_CRON_SECRET`
3. Set the schedule to run daily (e.g. every day at 3:00 AM).
4. Save. cron-job.org will call the endpoint on schedule with a plain GET
   request, no custom headers needed -- the secret in the query string is
   enough to authorise it.

You can add a second cron-job.org job the same way for
`/api/cron/escrow-release?secret=YOUR_CRON_SECRET` if that one is not
already scheduled elsewhere.

## Option B -- Vercel Cron (if deployed on Vercel)

Already configured in vercel.json at the project root. Vercel calls the
route on schedule and automatically sends the Authorization header using
the CRON_SECRET environment variable you set in the Vercel dashboard.
Nothing else to do beyond setting that environment variable.

## Option C -- Cloudflare Cron Triggers (if deployed on Cloudflare Pages)

Cloudflare Pages projects can attach Cron Triggers directly, without
GitHub Actions. Add this to your project's wrangler.toml (create one at
the project root if it does not exist yet):

```toml
[triggers]
crons = ["0 3 * * *"]
```

Then add a scheduled handler. If your Pages project uses the Pages
Functions model, create functions/scheduled.ts:

```ts
export const onSchedule: PagesFunction = async (context) => {
  const secret = context.env.CRON_SECRET
  await fetch(`${context.env.SITE_URL}/api/cron/layaway-sweep`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
  })
}
```

Cloudflare invokes this on the schedule in wrangler.toml, independent of
GitHub, Vercel, or any external uptime pinger.

## Option D -- GitHub Actions (fallback, works anywhere)

See .github/workflows/layaway-sweep-cron.yml. Useful if your host has no
built-in cron feature, or as a second, independent trigger in addition to
Option A or B for redundancy -- calling the sweep endpoint twice in a row
is harmless since every job inside it only acts on rows that still match
its condition.

## Notes

- The sweep endpoint accepts both GET (Authorization header) and POST
  (Authorization header OR a ?secret= query param), so any scheduler that
  cannot set custom headers can still call it.
- Running the sweep more than once for the same time window is safe. Each
  job only touches rows matching its current status, so a plan already
  moved to "expired" is not touched again by a second run.
