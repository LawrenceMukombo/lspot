const CACHE_NAME = 'lspot-pwa-cache-v1.6';
const APP_SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/images/food/nshima-chicken.jpg',
  '/images/food/nshima-beef.jpg',
  '/images/food/nshima-fish.jpg',
  '/images/food/nshima-beans.jpg',
  '/images/food/rice-chicken.jpg',
  '/images/food/coca-cola.jpg',
  '/images/food/mineral-water.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL_URLS))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return Promise.resolve();
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Network-first for API requests and HTML navigation, falling back to cache if offline
  if (
    url.pathname.startsWith('/api/') ||
    request.mode === 'navigate' ||
    url.pathname === '/' ||
    url.pathname === '/index.html'
  ) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((res) => res || caches.match('/index.html'))
        )
    );
    return;
  }

  // Stale-while-revalidate for static assets & app shell (never return index.html for missing JS/CSS assets)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            url.origin === self.location.origin
          ) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
