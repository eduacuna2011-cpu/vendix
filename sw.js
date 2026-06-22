const CACHE = 'vendix-v4';

self.addEventListener('install', e => {
  e.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);

  // Solo manejar http/https del mismo origen. Ignorar chrome-extension, data:, etc.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (url.origin !== self.location.origin) return;
  if (req.method !== 'GET') return;

  // HTML y API: siempre red, con fallback a cache solo si existe
  if (url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(req).catch(async () => (await caches.match(req)) || Response.error())
    );
    return;
  }

  // CSS / JS / imágenes: red primero, cachea si se puede
  e.respondWith(
    fetch(req).then(res => {
      if (res && res.status === 200 && res.type === 'basic') {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(req, clone).catch(() => {}));
      }
      return res;
    }).catch(async () => (await caches.match(req)) || Response.error())
  );
});
