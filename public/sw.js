/// <reference lib="webworker" />
const sw = self;

const CACHE_NAME = "zamorax-v1";
const STATIC_ASSETS = ["/", "/listings", "/manifest.json", "/icon-192.svg", "/icon-512.svg"];

sw.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  sw.skipWaiting();
});

sw.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  sw.clients.claim();
});

sw.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (
    url.pathname.startsWith("/api/") ||
    url.hostname.includes("firebase") ||
    url.hostname.includes("googleapis") ||
    url.hostname.includes("paystack") ||
    url.hostname.includes("algolia")
  ) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && (url.pathname === "/" || url.pathname.startsWith("/listings"))) {
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached ?? Response.error()))
  );
});

sw.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    sw.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon ?? "/icon-192.svg",
      badge: "/icon-192.svg",
      tag: data.tag ?? "zamorax-notification",
      data: { url: data.url ?? "/" },
    })
  );
});

sw.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url ?? "/";
  event.waitUntil(
    sw.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url === targetUrl);
      if (existing) return existing.focus();
      return sw.clients.openWindow(targetUrl);
    })
  );
});
