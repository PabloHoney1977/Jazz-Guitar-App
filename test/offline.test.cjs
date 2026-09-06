// Offline-boot tests.
//
// Regression guard for the black-screen bug: React and ReactDOM were loaded
// from cdnjs, so with no internet (or a blocked/slow CDN) `React` was undefined,
// app.js threw on its very first line — `const e = React.createElement` — the
// #root div stayed empty, and the user got a black screen on a near-black body
// background. The native iOS build was hit hardest: it has no service worker to
// fall back on, so the app could not boot offline at all.
//
// These are static checks on the shipped files, so they run everywhere (no
// Playwright, no browser) and fail loudly if a remote <script> creeps back in.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const html = read('index.html');

// Every src="…" / href="…" that points at another origin.
const externalRefs = (s) =>
  [...s.matchAll(/\b(?:src|href)\s*=\s*"([^"]+)"/g)]
    .map((m) => m[1])
    .filter((u) => /^(https?:)?\/\//i.test(u));

test('index.html loads no scripts or stylesheets from a remote origin', () => {
  assert.deepEqual(externalRefs(html), [],
    'the app must boot with zero third-party requests — bundle it under vendor/ instead');
});

test('React and ReactDOM are vendored locally and actually present', () => {
  for (const f of ['vendor/react.production.min.js', 'vendor/react-dom.production.min.js']) {
    assert.ok(html.includes('src="' + f + '"'), 'index.html must load ' + f);
    const src = read(f);
    assert.ok(src.length > 5000, f + ' looks truncated (' + src.length + ' bytes)');
    assert.ok(src.includes('@license React'), f + ' must keep its MIT @license header');
  }
});

test('the vendored React scripts load before app.js', () => {
  const iReact = html.indexOf('vendor/react.production.min.js');
  const iDom = html.indexOf('vendor/react-dom.production.min.js');
  const iApp = html.indexOf('src="app.js"');
  assert.ok(iReact > -1 && iDom > -1 && iApp > -1, 'all three scripts must be present');
  assert.ok(iReact < iApp && iDom < iApp,
    'app.js dereferences React at module scope, so React must already be defined');
});

test('the build step copies vendor/ into www/ (the Capacitor webDir)', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.match(pkg.scripts.build, /vendor/,
    'without this the native iOS bundle ships no React and cannot boot at all');
});

test('the service worker precaches React atomically, not best-effort', () => {
  const sw = read('sw.js');
  const local = sw.match(/const LOCAL = \[[\s\S]*?\];/);
  assert.ok(local, 'sw.js must define a LOCAL precache list');
  for (const f of ['react.production.min.js', 'react-dom.production.min.js']) {
    assert.ok(local[0].includes(f), f + ' must be in the atomic LOCAL precache');
  }
  assert.ok(!/cdnjs\.cloudflare\.com/.test(sw), 'sw.js must not reference a CDN any more');
});

test('#root is not empty before React mounts, and app.js clears the placeholder', () => {
  const root = html.match(/<div id="root">([\s\S]*?)<\/div>\s*<!--/);
  assert.ok(root, '#root must contain a static boot placeholder');
  assert.match(root[1], /id="boot"/, 'placeholder must be identifiable as #boot');
  assert.match(html, /id="boot-err"[^>]*hidden/, 'the error state must start hidden');
  assert.match(html, /location\.reload\(\)/, 'the boot fallback needs a Reload affordance');

  const app = read('app.js');
  assert.match(app, /getElementById\('boot'\)/,
    'app.js must remove the boot placeholder before mounting so it cannot double-render');
});

test('purchase and restore distinguish "offline" from "no purchase found"', () => {
  const app = read('app.js');
  assert.match(app, /const isOffline=/, 'needs a connection check helper');
  // Telling an offline paying customer "no previous purchase found on this
  // Apple ID" reads as "your purchase is gone" — it must be conditioned.
  const restore = app.match(/No previous purchase found[^;]*/);
  assert.ok(restore, 'restore-failure copy should still exist');
  assert.match(app, /isOffline\(\)[\s\S]{0,240}No previous purchase found/,
    'the "no purchase" message must only show when actually online');
});
