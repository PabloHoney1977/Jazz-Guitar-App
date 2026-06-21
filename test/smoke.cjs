// Smoke tests: launch the app in a headless Chromium with an iPhone 14 viewport
// (390×844, Safari UA) to exercise the real DOM and catch layout/render bugs
// that the vm-sandbox unit tests can't see.
//
// What's covered:
//   - App bootstraps without JS errors
//   - All 5 nav tabs render
//   - Guide tab: first load scrolls to top (nothing done)
//   - Guide auto-scroll: scrollY > 0 when some stages done
//   - Tour spotlight aligns with its target element (within 60px)
//   - Keys (Diatonic) tab: 7 diatonic chord buttons, correct Roman numeral casing
//   - Play tab: BPM display visible, Start button present
//   - Ear Training tab: renders without JS error
//   - Dark/light theme toggle: data-theme flips
//   - Reduced-motion: animation-duration collapses under prefers-reduced-motion
//   - Viewport meta present and sets user-scalable=no
//   - PWA manifest linked
//
// Network restriction: WebKit binary unavailable in this CI environment, so we
// use Chromium with an iPhone 14 UA + viewport. This exercises the real DOM
// layout engine and catches viewport/positioning bugs like the iOS tour fix.
//
// Run:  node test/smoke.cjs
//
// Setup (once, to get local React copies — CDN is blocked in this CI env):
//   cd /tmp && npm install react@18.2.0 react-dom@18.2.0
//   cp /tmp/node_modules/react/umd/react.production.min.js test/
//   cp /tmp/node_modules/react-dom/umd/react-dom.production.min.js test/

const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

// ── Static file server ────────────────────────────────────────────────────────
const ROOT = path.join(__dirname, '..');
const MIME = {
  '.html': 'text/html', '.js': 'application/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
};

// CDN requests served from local copies (CDN blocked in CI).
const CDN_MAP = {
  'https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js':
    path.join(__dirname, 'react.production.min.js'),
  'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js':
    path.join(__dirname, 'react-dom.production.min.js'),
};

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const u = new URL(req.url, 'http://localhost');
      const fp = path.join(ROOT, u.pathname === '/' ? 'index.html' : u.pathname);
      if (!fp.startsWith(ROOT) || !fs.existsSync(fp)) { res.writeHead(404); res.end(); return; }
      const ext = path.extname(fp);
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      fs.createReadStream(fp).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

// ── Test runner ───────────────────────────────────────────────────────────────
const results = [];
let passed = 0, failed = 0;

function ok(name, val, msg) {
  if (val) {
    passed++;
    results.push(`  ✓ ${name}`);
  } else {
    failed++;
    results.push(`  ✗ ${name}${msg ? ' — ' + msg : ''}`);
  }
}

// ── iPhone 14 device profile ──────────────────────────────────────────────────
const IPHONE14 = {
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) ' +
    'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
};

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  const server = await serve();
  const port = server.address().port;
  const BASE = `http://127.0.0.1:${port}`;

  const browser = await chromium.launch({
    headless: true,
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  });

  // ── Helper: new page with CDN intercept ────────────────────────────────────
  // suppressTour=true (default): sets jg-toured so the overlay doesn't block clicks.
  // suppressTour=false: leaves tour intact (for the tour alignment test).
  async function freshPage({ suppressTour = true, extraContextOpts = {}, storage = {} } = {}) {
    const ctx = await browser.newContext({
      ...IPHONE14,
      serviceWorkers: 'block',
      ...extraContextOpts,
    });
    const page = await ctx.newPage();
    await page.route('https://cdnjs.cloudflare.com/**', (route) => {
      const local = CDN_MAP[route.request().url()];
      if (local && fs.existsSync(local)) {
        return route.fulfill({ path: local, contentType: 'application/javascript' });
      }
      return route.abort();
    });
    const jsErrors = [];
    page.on('pageerror', (e) => jsErrors.push(e.message));

    // First navigation to set localStorage
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.evaluate(({ suppressTour: st, storage: s }) => {
      localStorage.clear();
      if (st) localStorage.setItem('jg-toured', '1');
      for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
    }, { suppressTour, storage });
    await page.reload({ waitUntil: 'domcontentloaded' });

    // Wait for React to mount
    await page.waitForFunction(
      () => document.querySelector('#root button') !== null,
      { timeout: 8000 }
    ).catch(() => {});
    await page.waitForTimeout(300);
    return { page, ctx, jsErrors };
  }

  // Noise filters for expected headless-env errors
  const isNoise = (e) =>
    e.includes('AudioContext') || e.includes('serviceWorker') ||
    e.includes('speechSynthesis') || e.includes('NotAllowedError') ||
    e.includes('AbortError') || e.includes('Failed to fetch');

  // Per-test wrapper: log label, catch errors as failures
  async function test(label, fn) {
    console.log(`\n${label}`);
    try {
      await fn();
    } catch (err) {
      failed++;
      results.push(`  ✗ ${label} — threw: ${err.message.split('\n')[0]}`);
    }
  }

  try {
    // ── 1: App bootstraps, no JS errors ──────────────────────────────────────
    await test('Test 1: Bootstrap', async () => {
      const { page, ctx, jsErrors } = await freshPage();
      const root = await page.$('#root');
      ok('root div exists', !!root);
      const navBtns = await page.$$('[data-tour^="nav-"]');
      ok('5 nav tab buttons rendered', navBtns.length === 5, `got ${navBtns.length}`);
      const realErrors = jsErrors.filter(e => !isNoise(e));
      ok('no JS errors on load', realErrors.length === 0, realErrors.join('; ').slice(0, 300));
      await ctx.close();
    });

    // ── 2: Nav tab labels ─────────────────────────────────────────────────────
    await test('Test 2: Nav tab labels', async () => {
      const { page, ctx } = await freshPage();
      const labels = await page.$$eval('[data-tour^="nav-"]', els =>
        els.map(el => el.querySelector('span:last-child')?.textContent?.trim())
      );
      ok('Guide tab present', labels.some(l => /guide/i.test(l)), `labels: ${labels.join(', ')}`);
      ok('Play tab present',  labels.some(l => /play/i.test(l)),  `labels: ${labels.join(', ')}`);
      ok('Train tab present', labels.some(l => /train/i.test(l)), `labels: ${labels.join(', ')}`);
      ok('Keys tab present',  labels.some(l => /keys/i.test(l)),  `labels: ${labels.join(', ')}`);
      await ctx.close();
    });

    // ── 3: Guide tab renders stages ───────────────────────────────────────────
    await test('Test 3: Guide tab renders stages', async () => {
      const { page, ctx } = await freshPage();
      // Guide is the default tab — may already be shown; click to be sure
      const guideBtn = await page.$('[data-tour="nav-guide"]');
      if (guideBtn) await guideBtn.click({ timeout: 5000 });
      await page.waitForTimeout(300);
      const stages = await page.$$('[id^="guide-stage-"]');
      ok('guide stages rendered (≥10)', stages.length >= 10, `got ${stages.length}`);
      await ctx.close();
    });

    // ── 4: Guide starts at top when nothing done ──────────────────────────────
    await test('Test 4: Guide starts at top when nothing done', async () => {
      const { page, ctx } = await freshPage();
      const guideBtn = await page.$('[data-tour="nav-guide"]');
      if (guideBtn) await guideBtn.click({ timeout: 5000 });
      await page.waitForTimeout(500);
      const scrollY = await page.evaluate(() => window.scrollY);
      ok('scrollY near zero with no progress', scrollY < 200, `scrollY=${scrollY}`);
      await ctx.close();
    });

    // ── 5: Guide auto-scroll when some stages done ────────────────────────────
    await test('Test 5: Guide auto-scrolls when progress exists', async () => {
      // jg-path maps stage IDs to done booleans; marking 'qualities' done
      // makes firstIncomplete() return 'shells', triggering auto-scroll.
      const { page, ctx } = await freshPage({
        storage: {
          'jg-path': JSON.stringify({ qualities: true }),
        },
      });
      const guideBtn = await page.$('[data-tour="nav-guide"]');
      if (guideBtn) await guideBtn.click({ timeout: 5000 });
      await page.waitForTimeout(600);
      const scrollY = await page.evaluate(() => window.scrollY);
      ok('guide scrolls down when some stages done', scrollY > 50, `scrollY=${scrollY}`);
      await ctx.close();
    });

    // ── 6: Tour spotlight aligns with target element ──────────────────────────
    // suppressTour=false so the overlay actually renders
    await test('Test 6: Tour spotlight alignment', async () => {
      const { page, ctx } = await freshPage({ suppressTour: false });
      await page.waitForTimeout(600);

      // Tour overlay: fixed, full-screen, z-index 200
      const tourVisible = await page.evaluate(() => {
        const all = Array.from(document.querySelectorAll('*'));
        return all.some(el => {
          const s = getComputedStyle(el);
          return s.position === 'fixed' && parseInt(s.zIndex) >= 200 && parseFloat(s.width) > 300;
        });
      });
      ok('tour overlay present on fresh load', tourVisible, 'fixed z-index≥200 element not found');

      if (!tourVisible) { await ctx.close(); return; }

      // The spotlight "ring" is position:absolute inside the fixed overlay,
      // has border: 2px solid gold and borderRadius 8px
      const ringBox = await page.evaluate(() => {
        const all = Array.from(document.querySelectorAll('*'));
        for (const el of all) {
          const s = getComputedStyle(el);
          if (
            s.position === 'absolute' &&
            s.border.includes('2px') &&
            s.pointerEvents === 'none' &&
            parseFloat(s.width) > 30
          ) {
            const r = el.getBoundingClientRect();
            return { top: r.top, left: r.left, w: r.width, h: r.height };
          }
        }
        return null;
      });

      // First nav button (Guide) is the first tour target
      const navBox = await page.$eval('[data-tour="nav-guide"]', el => {
        const r = el.getBoundingClientRect();
        return { top: r.top, left: r.left, w: r.width, h: r.height };
      }).catch(() => null);

      if (ringBox && navBox) {
        const ringCx = ringBox.left + ringBox.w / 2;
        const navCx  = navBox.left  + navBox.w  / 2;
        const ringCy = ringBox.top  + ringBox.h  / 2;
        const navCy  = navBox.top   + navBox.h   / 2;
        const dx = Math.abs(ringCx - navCx);
        const dy = Math.abs(ringCy - navCy);
        ok(`spotlight within 60px of nav-guide target (dx=${Math.round(dx)}, dy=${Math.round(dy)})`,
          dx < 60 && dy < 60,
          `ring center=(${Math.round(ringCx)},${Math.round(ringCy)}), nav center=(${Math.round(navCx)},${Math.round(navCy)})`);
      } else {
        ok('spotlight ring and nav box found for alignment check', false,
          `ring=${JSON.stringify(ringBox)}, nav=${JSON.stringify(navBox)}`);
      }
      await ctx.close();
    });

    // ── 7: Keys (Diatonic) tab — 7 chord buttons, correct Roman numeral casing
    await test('Test 7: Keys tab — diatonic chord buttons', async () => {
      const { page, ctx } = await freshPage();
      // Keys tab is data-tour="nav-diatonic"
      const keysBtn = await page.$('[data-tour="nav-diatonic"]');
      if (!keysBtn) {
        ok('Keys nav button found (nav-diatonic)', false, 'data-tour="nav-diatonic" not found');
        await ctx.close();
        return;
      }
      await keysBtn.click({ timeout: 5000 });
      await page.waitForTimeout(400);
      // Chord buttons in the Keys tab include both the Roman numeral AND the note name:
      // e.g. "IC△7", "iiDm7", "IVF△7". The note name (A-G) always immediately follows
      // the Roman numeral, distinguishing chord buttons from other buttons like "Interval".
      const romanPrefixes = await page.$$eval('button', btns => {
        const RE = /^(vii|iii|ii|vi|IV|V|I)[A-G]/;
        return btns
          .map(b => b.textContent?.trim())
          .filter(t => t && RE.test(t))
          .map(t => t.match(/^(vii|iii|ii|vi|IV|V|I)/)[1]);
      });
      ok('7 diatonic chord buttons with Roman numeral prefix', romanPrefixes.length === 7,
        `found ${romanPrefixes.length}: ${romanPrefixes.join(', ')}`);
      ok('minor chords lowercase (ii, iii, vi)',
        romanPrefixes.includes('ii') && romanPrefixes.includes('iii') && romanPrefixes.includes('vi'));
      ok('major chords uppercase (I, IV, V)',
        romanPrefixes.includes('I') && romanPrefixes.includes('IV') && romanPrefixes.includes('V'));
      await ctx.close();
    });

    // ── 8: Play tab — BPM and Start button ───────────────────────────────────
    await test('Test 8: Play tab — BPM and Start button', async () => {
      const { page, ctx } = await freshPage();
      const playBtn = await page.$('[data-tour="nav-iivi"]');
      if (!playBtn) { ok('Play nav button found', false); await ctx.close(); return; }
      await playBtn.click({ timeout: 5000 });
      await page.waitForTimeout(400);
      const bpmFound = await page.evaluate(() => {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
          const txt = node.textContent.trim();
          const n = parseInt(txt, 10);
          if (n >= 35 && n <= 150 && txt === String(n)) return n;
        }
        return null;
      });
      ok('BPM value displayed', bpmFound !== null, 'no text node with value 35–150');
      const hasStart = await page.evaluate(() =>
        Array.from(document.querySelectorAll('button'))
          .some(b => /start|play|stop/i.test(b.textContent + (b.getAttribute('aria-label') || '')))
      );
      ok('Start/Stop button present', hasStart);
      await ctx.close();
    });

    // ── 9: Ear Training tab ───────────────────────────────────────────────────
    await test('Test 9: Ear Training tab renders', async () => {
      const { page, ctx, jsErrors } = await freshPage();
      const earBtn = await page.$('[data-tour="nav-quiz"]');
      if (!earBtn) { ok('Ear Training nav button found', false); await ctx.close(); return; }
      await earBtn.click({ timeout: 5000 });
      await page.waitForTimeout(400);
      const realErrors = jsErrors.filter(e => !isNoise(e));
      ok('no JS errors in Ear Training', realErrors.length === 0,
        realErrors.join('; ').slice(0, 200));
      const btns = await page.$$('button');
      ok('Ear Training has UI buttons', btns.length > 2, `got ${btns.length}`);
      await ctx.close();
    });

    // ── 10: Theme toggle ──────────────────────────────────────────────────────
    await test('Test 10: Dark/light theme toggle', async () => {
      const { page, ctx } = await freshPage();
      const before = await page.evaluate(() =>
        document.documentElement.getAttribute('data-theme') || 'dark'
      );
      const toggled = await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button'))
          .find(b => (b.getAttribute('aria-label') || '').toLowerCase().includes('toggle theme'));
        if (btn) { btn.click(); return true; }
        return false;
      });
      ok('theme toggle button found', toggled);
      if (toggled) {
        await page.waitForTimeout(200);
        const after = await page.evaluate(() =>
          document.documentElement.getAttribute('data-theme') || 'dark'
        );
        ok('data-theme flips on toggle', before !== after, `before=${before}, after=${after}`);
      }
      await ctx.close();
    });

    // ── 11: Reduced-motion ────────────────────────────────────────────────────
    await test('Test 11: Reduced-motion media query', async () => {
      const { page, ctx } = await freshPage({ extraContextOpts: { reducedMotion: 'reduce' } });
      const dur = await page.evaluate(() => getComputedStyle(document.body).animationDuration);
      // CSS rule sets 0.01ms; browser may stringify as '0.01ms', '1e-05s', or '0s'
      const ms = parseFloat(dur) * (dur.endsWith('ms') ? 1 : 1000);
      ok('animation-duration collapsed under reduced-motion (≤1ms)',
        ms <= 1,
        `got '${dur}' (${ms}ms)`);
      await ctx.close();
    });

    // ── 12: Viewport meta ─────────────────────────────────────────────────────
    await test('Test 12: Viewport meta tag', async () => {
      const { page, ctx } = await freshPage();
      const content = await page.$eval('meta[name="viewport"]', el => el.content).catch(() => null);
      ok('viewport meta present', !!content);
      ok('user-scalable=no set', content?.includes('user-scalable=no'), `content='${content}'`);
      await ctx.close();
    });

    // ── 13: PWA manifest linked ───────────────────────────────────────────────
    await test('Test 13: PWA manifest linked', async () => {
      const { page, ctx } = await freshPage();
      const href = await page.$eval('link[rel="manifest"]', el => el.href).catch(() => null);
      ok('manifest.json link present', !!href);
      await ctx.close();
    });

  } finally {
    await browser.close();
    server.close();
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n── Smoke test results ───────────────────────────────────');
  for (const r of results) console.log(r);
  console.log(`\n${passed + failed} checks: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
})();
