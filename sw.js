const CACHE = 'catchlog-v29-29';
const ASSETS = [
  '/catchlog/',
  '/catchlog/index.html',
  '/catchlog/manifest.json',
  '/catchlog/icon-192.png',
  '/catchlog/icon-512.png',
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage-compat.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Source+Code+Pro:wght@300;400;500&display=swap'
];

self.addEventListener('install', e => {
  // Tolerant precache: one failed asset must not abort the whole install
  // (cache.addAll is all-or-nothing and would silently leave us with no
  // offline support at all)
  e.waitUntil(
    caches.open(CACHE)
      .then(cache => Promise.allSettled(ASSETS.map(a => cache.add(a))))
      .then(() => self.skipWaiting())
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
  // Never intercept writes (Firestore POSTs etc.) — cache.put on non-GET throws
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // Live data APIs: network only, never cached
  const isApi = url.hostname.includes('kartverket') ||
                url.hostname.includes('met.no') ||
                url.hostname.includes('allorigins') ||
                url.hostname.includes('corsproxy');
  if (isApi) {
    e.respondWith(fetch(e.request).catch(() => new Response('', { status: 503 })));
    return;
  }

  // Firebase auth/firestore/storage traffic: leave it alone entirely —
  // caching it bloats storage and risks stale reads (the SDK has its own
  // offline persistence, photos are cached in IndexedDB by the app)
  if (url.hostname.endsWith('googleapis.com') ||
      url.hostname.endsWith('firebasestorage.app') ||
      url.hostname.endsWith('firebaseapp.com')) {
    return;
  }

  // App shell: network FIRST so every online launch runs the latest deployed
  // version immediately; fall back to cache offline
  const isShell = e.request.mode === 'navigate' ||
                  url.pathname === '/catchlog/' ||
                  url.pathname === '/catchlog/index.html';
  if (isShell) {
    e.respondWith(
      fetch(e.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, clone)).catch(() => {});
        }
        return response;
      }).catch(() => caches.match(e.request).then(c => c || caches.match('/catchlog/index.html')))
    );
    return;
  }

  // Static assets (CDN scripts, fonts, icons): cache first
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, clone)).catch(() => {});
        }
        return response;
      });
    })
  );
});
