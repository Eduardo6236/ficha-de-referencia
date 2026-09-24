// Bump this string on every deploy that changes a cached file — the browser only
// re-installs the service worker (and refreshes the cache) when sw.js's own bytes change.
const CACHE = 'ficha-referencia-14';
const ASSETS = ['./', './index.html', './styles.css', './db.js', './promptBuilder.js', './exportImport.js', './app.js', './manifest.json', './icons/icon-192.png', './icons/icon-512.png'];

// cache: 'reload' salta la caché HTTP del navegador; si no, addAll puede guardar versiones viejas.
self.addEventListener('install', e => e.waitUntil(
  caches.open(CACHE).then(c => c.addAll(ASSETS.map(url => new Request(url, { cache: 'reload' })))).then(() => self.skipWaiting())
));

self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
));

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('/api/')) return;
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
