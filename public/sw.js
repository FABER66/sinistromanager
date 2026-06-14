// SinistroManager — service worker (installabilità + shell offline)
const CACHE = 'sm-v1';
const SHELL = ['/', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png', '/manifest.webmanifest'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // API: sempre rete (dati freschi), mai cache
  if (url.pathname.startsWith('/api/')) return;

  // Navigazione (HTML): network-first così l'app è sempre aggiornata, fallback offline
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(r => { caches.open(CACHE).then(c => c.put('/', r.clone())); return r; })
        .catch(() => caches.match('/'))
    );
    return;
  }

  // Statici (icone, font, ecc.): cache-first
  e.respondWith(
    caches.match(req).then(c => c || fetch(req).then(r => {
      if (r.ok && url.origin === location.origin) caches.open(CACHE).then(cc => cc.put(req, r.clone()));
      return r;
    }))
  );
});
