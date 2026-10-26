// Signal offline shell v2. Never cache/prefetch third-party OSM map tiles.
const CACHE = "signal-shell-v2";
const APP_SHELL = ["/", "/offline", "/icon.svg", "/manifest.webmanifest"];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Collect our own hashed Next.js assets referenced by the shell on first
    // installation. They were likely loaded before the SW could intercept them.
    // This makes the FIRST offline revisit useful, not just the second.
    let shell;
    try {
      const response = await fetch("/", { cache: "no-store" });
      if (response.ok) {
        shell = await response.clone().text();
        await cache.put("/", response);
      }
    } catch { /* proceed with whichever resources can be cached */ }
    const assets = [];
    if (shell) {
      for (const match of shell.matchAll(/(?:src|href)="([^"]+)"/g)) {
        try {
          const url = new URL(match[1].replaceAll("&amp;", "&"), self.location.origin);
          if (url.origin === self.location.origin && url.pathname.startsWith("/_next/static/")) {
            assets.push(url.pathname + url.search);
          }
        } catch { /* ignore malformed asset links */ }
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
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then(response => {
      if (response.ok) { const clone = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put(request, clone))); }
      return response;
    }).catch(async () => (await caches.match(request)) || (await caches.match("/")) || (await caches.match("/offline"))));
  } else if (url.pathname.startsWith("/_next/static/") || url.pathname === "/icon.svg" || url.pathname === "/manifest.webmanifest") {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok) { const clone = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put(request, clone))); }
      return response;
    })));
  }
});
