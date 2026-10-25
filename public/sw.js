// Cache only Signal's own shell/static files. Never prefetch or cache third-party map tiles.
const CACHE = "signal-shell-v1";
const APP_SHELL = ["/", "/offline", "/icon.svg", "/manifest.webmanifest"];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});
self.addEventListener("activate", event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))),
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
      if (response.ok) { const clone = response.clone(); caches.open(CACHE).then(cache => cache.put(request, clone)); }
      return response;
    }).catch(async () => (await caches.match(request)) || (await caches.match("/")) || (await caches.match("/offline"))));
  } else if (url.pathname.startsWith("/_next/static/") || url.pathname === "/icon.svg" || url.pathname === "/manifest.webmanifest") {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok) { const clone = response.clone(); caches.open(CACHE).then(cache => cache.put(request, clone)); }
      return response;
    })));
  }
});
