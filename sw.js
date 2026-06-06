// PACcamélo Service Worker
const CACHE = 'paccamelo-v1';
const ASSETS = [
  '/PACcam-lo/',
  '/PACcam-lo/pac-tracker.html',
  '/PACcam-lo/manifest.json',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Solo richieste GET alla stessa origine
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      // Network first per pac-tracker.html (sempre aggiornato)
      if (url.pathname.endsWith('pac-tracker.html')) {
        return fetch(e.request)
          .then(r => { caches.open(CACHE).then(c => c.put(e.request, r.clone())); return r; })
          .catch(() => cached);
      }
      // Cache first per gli altri asset
      return cached || fetch(e.request);
    })
  );
});
