const CACHE = 'jgv-v1';
const CDN = [
  'https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js',
];
const LOCAL = ['./', './index.html', './app.js', './manifest.json', './icons/icon.svg'];

self.addEventListener('install', ev => {
  ev.waitUntil(
    caches.open(CACHE).then(c => c.addAll([...LOCAL, ...CDN]))
  );
  self.skipWaiting();
});

self.addEventListener('activate', ev => {
  ev.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', ev => {
  ev.respondWith(
    caches.match(ev.request).then(hit => hit || fetch(ev.request).then(res => {
      if (res.ok) {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(ev.request, clone));
      }
      return res;
    }))
  );
});
