const CACHE = 'vendix-v3';

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
  const url = new URL(e.request.url);

  // HTML y API: siempre red, nunca cache
  if (url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname.startsWith('/api/')) {
    return e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
  }

  // CSS / JS / imágenes: network-first con cache fallback
  e.respondWith(
    fetch(e.request).then(res => {
      if (!res || res.status !== 200 || res.type === 'opaque') return res;
      const clone = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone));
      return res;
    }).catch(() => caches.match(e.request))
  );
});
