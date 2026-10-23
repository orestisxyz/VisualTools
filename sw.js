// keeps the instruments on the phone, so they also work without internet
const CACHE = 'visuals-v5';
const FILES = ['./', 'index.html', 'polychoron.html', 'polychoron.js', 'ink.html', 'ink.js', 'frame.html', 'frame.js', 'frame.webmanifest',
  'home.webmanifest', 'polychoron.webmanifest', 'ink.webmanifest',
  'icon-home-180.png', 'icon-home-192.png', 'icon-home-512.png', 'icon-poly-180.png', 'icon-poly-192.png', 'icon-poly-512.png',
  'icon-ink-180.png', 'icon-ink-192.png', 'icon-ink-512.png',
  'icon-frame-180.png', 'icon-frame-192.png', 'icon-frame-512.png'];
const P5 = 'https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.4/p5.min.js';
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES).then(() => fetch(P5, { mode: 'cors' }).then((r) => c.put(P5, r)).catch(() => {}))));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
// the newest version when online, the saved copy when offline
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then((r) => {
    if (r && (r.ok || r.type === 'opaque')) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
