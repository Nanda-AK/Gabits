// Minimal service worker for online-first behavior with offline fallback
const APP_VERSION = '2026-01-01-1';
const CACHE_NAME = 'gabits-cache-v3';
const APP_SHELL = [
  '/',
  '/index.html',
];
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  // Activate new worker immediately
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Remove old caches
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));

    // Take control of all clients
    try {
      if (self.clients && self.clients.claim) {
        await self.clients.claim();
      }
    } catch {}

    // Notify all controlled windows about the current app version
    try {
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      clientList.forEach((client) => {
        client.postMessage({ type: 'APP_VERSION', version: APP_VERSION });
      });
    } catch {}
  })());
});
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Online-first: always try network, fall back to cache if offline
  event.respondWith(
    fetch(req)
      .then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
        return resp;
      })
      .catch(() => caches.match(req))
  );
});
