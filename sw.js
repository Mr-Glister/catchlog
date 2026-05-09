const CACHE = 'catchlog-v7';
const ASSETS = [
  '/catchlog/',
  '/catchlog/index.html',
  '/catchlog/app.jsx',
  '/catchlog/manifest.json',
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone/babel.min.js',
  'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Source+Code+Pro:wght@300;400;500&display=swap'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
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
  // Network first for API calls (tide, weather), cache first for app assets
  const url = new URL(e.request.url);
  const isApi = url.hostname.includes('kartverket') ||
                url.hostname.includes('open-meteo') ||
                url.hostname.includes('allorigins');

  if (isApi) {
    // Network only for live data — don't cache API responses
    e.respondWith(fetch(e.request).catch(() => new Response('', { status: 503 })));
  } else {
    // Cache first for app shell
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE).then(cache => cache.put(e.request, clone));
          }
          return response;
        });
      })
    );
  }
});
