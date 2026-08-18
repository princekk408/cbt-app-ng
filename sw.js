// Service worker for offline app-shell caching.
// Bump CACHE_NAME whenever you deploy a new index.html so returning
// users get the update instead of a stale cached copy.
const CACHE_NAME = 'rsu-jamb-cbt-v1';
const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

// Strategy:
// - Supabase API calls (data): network-first, so the app always tries
//   live data first and only fails when truly offline (those calls
//   already have their own offline-queue fallback in the app code).
// - Everything else (the app shell — HTML/JS/CSS/icons): cache-first,
//   so the app itself opens instantly with no network at all.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  const isSupabaseApi = url.hostname.endsWith('.supabase.co');

  if (isSupabaseApi) {
    event.respondWith(
      fetch(req).catch(() => caches.match(req))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (req.method === 'GET' && res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
