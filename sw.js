// Service worker — caching strategy chosen to avoid the "stale app forever" trap.
//
// History: this used a pure cache-first strategy keyed on CACHE version, which
// meant every code change required manually bumping the version or returning
// PWA users would never get the update. That discipline slipped (20+ app.js
// deploys on one cache version), so the shell is now NETWORK-FIRST: online
// users always run the latest app.js/index.html; offline still works from cache.
// Stable assets (CDN libs, icons, audio) stay cache-first for speed.
const CACHE = 'jglab-v35';

const CDN = [
  'https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js',
];

// Bundled audio samples — same-origin, precached best-effort so the PWA has
// working audio offline even on first launch (native bundles these anyway).
const SAMPLES = [
  'E2','Fs2','A2','C3','Fs3','A3','C4','Fs4','A4','C5',
].map((n) => './samples/guitar-electric/' + n + '.mp3')
 .concat(['G1','As1','Cs2','E2','G2','As2'].map((n) => './samples/bass-electric/' + n + '.mp3'))
 .concat(['ride1','ride2','ridebell','hihat-closed','hihat-pedal','sidestick','kick']
   .map((n) => './samples/drums/' + n + '.mp3'));
const LOCAL = ['./', './index.html', './app.js', './manifest.json', './icons/icon.svg'];

// The app shell: always revalidate from network when online so updates ship.
const SHELL = ['/', '/index.html', '/app.js', '/manifest.json'];
const isShell = (req) => {
  if (req.mode === 'navigate') return true;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return false;
  const p = url.pathname.replace(/\/+$/, '') || '/';
  return SHELL.includes(p) || p.endsWith('/app.js') || p.endsWith('/index.html') || p.endsWith('/manifest.json');
};

self.addEventListener('install', (ev) => {
  ev.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // Same-origin shell must cache successfully (atomic).
    await c.addAll(LOCAL);
    // CDN is best-effort: a blocked/slow CDN must not abort the whole install
    // (which would leave the user on the previous service worker).
    await Promise.all(CDN.map((u) =>
      fetch(u, { mode: 'cors' }).then((r) => (r.ok ? c.put(u, r) : null)).catch(() => null)
    ));
    // Samples are best-effort too — a missing/blocked one must not abort install.
    await Promise.all(SAMPLES.map((u) =>
      fetch(u).then((r) => (r.ok ? c.put(u, r) : null)).catch(() => null)
    ));
  })());
  self.skipWaiting();
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (ev) => {
  const { request } = ev;
  if (request.method !== 'GET') return;

  if (isShell(request)) {
    // Network-first: fresh when online, cached fallback when offline.
    ev.respondWith((async () => {
      try {
        const res = await fetch(request);
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(request, clone));
          return res;
        }
        // Non-ok response (5xx/4xx): serve cached version rather than surfacing the error.
        const cached = await caches.match(request);
        if (cached) return cached;
        return res;
      } catch (err) {
        const cached = await caches.match(request);
        if (cached) return cached;
        // Last resort for navigations: serve the cached index.
        return (await caches.match('./index.html')) || (await caches.match('/index.html')) || Response.error();
      }
    })());
    return;
  }

  // Everything else (CDN libs, icons, audio): cache-first for speed.
  ev.respondWith(
    caches.match(request).then((hit) =>
      hit || fetch(request).then((res) => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(request, clone));
        }
        return res;
      })
    )
  );
});
