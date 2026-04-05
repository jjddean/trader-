const CACHE_NAME = 'minimalist-pages-v2';
const ASSETS = [
  '/notes.html',
  '/notes.css?v=2',
  '/notes.js',
  '/notes-manifest.json?v=2',
  '/notes-icon.png?v=2'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.filter((cacheName) => {
            return cacheName !== CACHE_NAME;
          }).map((cacheName) => {
            return caches.delete(cacheName);
          })
        );
      })
    );
  });
