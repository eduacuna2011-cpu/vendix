const CACHE = 'vendix-v1';
const STATIC = [
  '/',
  '/index.html',
  '/landing.html',
  '/inventory.html',
  '/sales.html',
  '/sellers.html',
  '/settings.html',
  '/styles.css',
  '/dashboard.css',
  '/inventory.css',
  '/sales.css',
  '/sellers.css',
  '/settings.css',
  '/animations.css',
  '/sidebar.js',
  '/auth.js',
  '/api-client.js',
  '/script.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
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
  const url = new URL(e.request.url);

  // API calls: network first, no cache
  if (url.pathname.startsWith('/api/')) {
    return e.respondWith(fetch(e.request).catch(() => new Response(JSON.stringify({ error: 'offline' }), { headers: { 'Content-Type': 'application/json' } })));
  }

  // Static: cache first, fallback network
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (!res || res.status !== 200 || res.type === 'opaque') return res;
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      });
    })
  );
});
