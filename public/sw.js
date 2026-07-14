/// <reference lib="webworker" />
const sw = self;

const CACHE_NAME = "zamorax-v4";
const STATIC_ASSETS = [
  "/",
  "/search",
  "/manifest.json",
  "/favicon.svg",
];

// ── Install — cache static assets ─────────────────────────────────────────
sw.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => sw.skipWaiting()) // skipWaiting INSIDE waitUntil
  );
});

// ── Activate — delete old caches ──────────────────────────────────────────
sw.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => sw.clients.claim())
  );
});

// ── Fetch — network first, cache fallback ─────────────────────────────────
sw.addEventListener("fetch", (event) => {
  // Only handle GET requests
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Skip non-http(s) (chrome-extension etc)
  if (!url.protocol.startsWith("http")) return;

  // Skip API calls and third-party services — always go to network
  const skipPatterns = [
    "/api/",
    "cloudflare",
    "supabase",
    "firebase",
    "googleapis",
    "paystack",
    "flutterwave",
    "algolia",
    "r2.cloudflarestorage",
  ];
  if (skipPatterns.some((p) => url.href.includes(p))) return;

  // For navigation requests (page loads) — network first, cache fallback
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache homepage and search page
          if (
            response.ok &&
            (url.pathname === "/" || url.pathname.startsWith("/search"))
          ) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() =>
          // Offline fallback — serve cached version if available
          caches.match(event.request).then((cached) => {
            if (cached) return cached;
            // Last resort — serve cached homepage
            return caches.match("/") ?? new Response("Offline — please check your connection", {
              status: 503,
              headers: { "Content-Type": "text/plain" },
            });
          })
        )
    );
    return;
  }

  // For static assets (JS, CSS, images) — stale-while-revalidate:
  // serve the cached copy instantly if present, but always refetch in the
  // background and update the cache so the NEXT load gets the fresh build.
  // (Plain cache-first would serve old, content-hashed Next.js bundles
  // forever once cached, even after a new deploy — causing mismatches
  // between fresh HTML and stale JS/CSS.)
  if (
    url.pathname.match(/\.(js|css|woff2?|png|jpg|jpeg|svg|webp|ico)$/)
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(event.request).then((cached) => {
          const networkFetch = fetch(event.request)
            .then((response) => {
              if (response.ok) cache.put(event.request, response.clone());
              return response;
            })
            .catch(() => cached); // offline — fall back to cache if network fails

          return cached || networkFetch;
        })
      )
    );
    return;
  }
});

// ── Push notifications ─────────────────────────────────────────────────────
sw.addEventListener("push", (event) => {
  if (!event.data) return;

  let data = { title: "Zamorax", body: "You have a new notification", url: "/" };
  try {
    data = { ...data, ...event.data.json() };
  } catch {
    data.body = event.data.text();
  }

  event.waitUntil(
    sw.registration.showNotification(data.title, {
      body:  data.body,
      icon:  "/icon-192.png",
      badge: "/icon-192.png",
      tag:   data.tag ?? "zamorax-notification",
      data:  { url: data.url ?? "/" },
      vibrate: [200, 100, 200],
    })
  );
});

// ── Notification click ─────────────────────────────────────────────────────
sw.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url ?? "/";

  event.waitUntil(
    sw.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        // Focus existing tab if already open
        const existing = clients.find(
          (c) => new URL(c.url).pathname === new URL(targetUrl, sw.location.origin).pathname
        );
        if (existing) return existing.focus();
        return sw.clients.openWindow(targetUrl);
      })
  );
});
