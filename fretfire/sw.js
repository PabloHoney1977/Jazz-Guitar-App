// Fretfire offline cache.
//
// Every file the app needs is local — there is no CDN, no font host, no
// analytics beacon. So the precache list IS the app, and it is installed
// atomically: if any single file fails to cache, the install fails and the old
// version keeps serving. A half-installed app is how you get a black screen.

const CACHE = 'fretfire-v1';
const FILES = [
  './',
  './index.html',
  './manifest.json',
  './css/app.css',
  './js/main.js',
  './js/game.js',
  './js/ui.js',
  './js/audio.js',
  './js/pitch.js',
  './js/songs.js',
  './js/store.js',
  './js/theory.js',
  './js/fx.js',
  './icons/icon.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache-first: this app never needs the network, so going to it first would
// only add latency and a failure mode.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      if (res && res.status === 200 && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
