// Signal offline shell v3. Never cache or prefetch third-party OSM map tiles.
const CACHE = "signal-shell-v3";
const APP_SHELL = ["/", "/offline", "/icon.svg", "/manifest.webmanifest"];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    let shell;
    try {
      const response = await fetch("/", { cache: "no-store" });
      if (response.ok) {
        shell = await response.clone().text();
        await cache.put("/", response);
      }
    } catch { /* Some shell files may still be cached below. */ }
    // Find this build's own Next.js JS/CSS resources in the initial HTML.
    // This is not an offline map-tile fetch.
    const assets = [];
    if (shell) {
      for (const match of shell.matchAll(/(?:src|href)="([^"]+)"/g)) {
        try {
          const url = new URL(match[1].replaceAll("&amp;", "&"), self.location.origin);
          if (url.origin === self.location.origin && url.pathname.startsWith("/_next/static/")) {
            assets.push(url.pathname + url.search);
          }
        } catch { /* Ignore malformed asset links. */ }
      }
    }
    await Promise.allSettled([...new Set([...APP_SHELL, ...assets])].map(path => cache.add(path)));
  })());
  self.skipWaiting();
});
self.addEventListener("activate", event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("signal-shell-") && key !== CACHE).map(key => caches.delete(key)))),
    self.clients.claim()
  ]));
});
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // Never intercept Wi-Fi API calls, postcode calls or third-party OSM tile traffic.
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const copy = response.clone();
          await caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => {});
        }
        return response;
      } catch {
        return (await caches.match(request)) || (await caches.match("/")) || (await caches.match("/offline")) || Response.error();
      }
    })());
  } else if (url.pathname.startsWith("/_next/static/") || url.pathname === "/icon.svg" || url.pathname === "/manifest.webmanifest") {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) {
        const copy = response.clone();
        await caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => {});
      }
      return response;
    })());
  }
});
