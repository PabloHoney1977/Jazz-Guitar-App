// Smoke tests: launch the app in a headless Chromium with an iPhone 14 viewport
// (390×844, Safari UA) to exercise the real DOM and catch layout/render bugs
// that the vm-sandbox unit tests can't see.
//
// What's covered (85 checks across 26 test blocks):
//
//  Static / layout checks (Tests 1–16):
//   - App bootstraps without JS errors
//   - All 5 nav tabs render with correct labels
//   - Guide tab: renders ≥10 stages; starts at top; auto-scrolls when progress exists
//   - Tour spotlight aligns with its target element (within 60px)
//   - Keys tab: 7 chord buttons with correct Roman numeral casing
//   - Play tab: BPM in range, Start/Stop button present
//   - Ear Training tab: renders without JS error
//   - Dark/light theme toggle: data-theme flips
//   - Reduced-motion: animation-duration collapses to ≤1ms
//   - Viewport meta present with user-scalable=no
//   - PWA manifest linked
//   - Visual snapshots (16 PNGs): Pro dark, Essentials, light theme
//
//  Interactive / flow checks (Tests 17–24):
//   - Tour: spotlight stays stable after paint (regression guard for rAF-jump bug)
//   - Tour: step through all steps, screenshot each viewport frame
//   - Keys tab: open key picker, change key, verify chords update
//   - Keys tab: click a chord, verify neck renders without errors, screenshot
//   - Ear Training: skip intro, click a choice, check revealed state,
//     verify ← ♪ → row stays in viewport without scrolling
//   - Essentials: trigger upgrade sheet, verify pricing text present
//   - Play Essentials: Pro forms shown as a locked horizontal-scroll shelf;
//     tapping a locked chip opens the paywall without switching the form
//   - Play BPM: keyboard-control the knob, verify displayed value updates
//   - Onboarding: questionnaire answers persist, personalize tour copy, and
//     surface a goal-based suggestion card in the Guide
//   - Play tab: goal-based voicing nudge applies Drop 2 on tap
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
const SHOTS_DIR = path.join(__dirname, 'screenshots');
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
      // Onboarding questionnaire is a separate first-run gate from the tour;
      // default it to "seen" so it doesn't intercept unrelated tour/UI checks.
      // Tests that want to exercise the onboarding sheet itself pass
      // storage:{'jg-onboard-seen':undefined-equivalent} by omitting it — see
      // the dedicated onboarding test, which clears it explicitly below.
      localStorage.setItem('jg-onboard-seen', '1');
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
      // The toggle lives in the ··· menu now — the header is a single row and
      // couldn't hold brand + tier + streak + three buttons without clipping.
      const opened = await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button'))
          .find(b => /menu, help/i.test(b.getAttribute('aria-label') || ''));
        if (btn) { btn.click(); return true; }
        return false;
      });
      ok('··· menu button found in header', opened);
      await page.waitForTimeout(250);
      const toggled = await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button'))
          .find(b => /switch to (light|dark) theme/i.test(b.textContent || ''));
        if (btn) { btn.click(); return true; }
        return false;
      });
      ok('theme toggle found in the ··· menu', toggled);
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

    // ── 14: Visual snapshots — capture every tab for human/vision review ───────
    // Not pass/fail assertions about correctness. These exist so a reviewer (or a
    // vision-capable agent) can SEE each screen and catch layout/confusion bugs
    // that DOM assertions can't express — e.g. two near-duplicate controls that
    // read as redundant. Captured in Pro mode so every gated control renders.
    await test('Test 14: Visual snapshots of every tab', async () => {
      fs.mkdirSync(SHOTS_DIR, { recursive: true });
      const { page, ctx } = await freshPage({ storage: { 'jg-level': 'pro' } });
      const shoot = async (name) => {
        await page.waitForTimeout(400);
        const file = path.join(SHOTS_DIR, `${name}.png`);
        await page.screenshot({ path: file, fullPage: true });
        ok(`captured ${name}.png`, fs.existsSync(file) && fs.statSync(file).size > 1000,
          `missing/empty: ${file}`);
      };
      const tabs = [
        ['nav-guide', 'guide'], ['nav-diatonic', 'keys'],
        ['nav-custom', 'chords'], ['nav-iivi', 'play'], ['nav-quiz', 'train'],
      ];
      for (const [tour, name] of tabs) {
        const btn = await page.$(`[data-tour="${tour}"]`);
        if (btn) await btn.click({ timeout: 5000 });
        await shoot(name);
      }
      // Play tab with the per-bar voicing override expanded, to review that state
      const playBtn = await page.$('[data-tour="nav-iivi"]');
      if (playBtn) await playBtn.click({ timeout: 5000 });
      await page.waitForTimeout(300);
      const expanded = await page.evaluate(() => {
        const link = Array.from(document.querySelectorAll('button'))
          .find(b => /customize this bar/i.test(b.textContent || ''));
        if (link) { link.click(); return true; }
        return false;
      });
      if (expanded) await shoot('play-bar-override');
      await ctx.close();
    });

    // Test 15: Visual snapshots — Essentials (free) tier
    // Verifies that the free-user experience looks intentional rather than broken:
    // lock badges visible, upgrade prompts present, no layout regressions.
    await test('Test 15: Visual snapshots — Essentials tier', async () => {
      const { page, ctx } = await freshPage({ storage: { 'jg-level': 'essentials' } });
      const shoot = async (name) => {
        await page.waitForTimeout(400);
        const file = path.join(SHOTS_DIR, `${name}.png`);
        await page.screenshot({ path: file, fullPage: true });
        ok(`captured ${name}.png`, fs.existsSync(file) && fs.statSync(file).size > 1000,
          `missing/empty: ${file}`);
      };
      const tabs = [
        ['nav-guide', 'guide-essentials'], ['nav-diatonic', 'keys-essentials'],
        ['nav-custom', 'chords-essentials'], ['nav-iivi', 'play-essentials'], ['nav-quiz', 'train-essentials'],
      ];
      for (const [tour, name] of tabs) {
        const btn = await page.$(`[data-tour="${tour}"]`);
        if (btn) await btn.click({ timeout: 5000 });
        await shoot(name);
      }
      await ctx.close();
    });

    // Test 16: Visual snapshots — light theme
    // Confirms contrast, color-variable usage, and layout in the light theme.
    await test('Test 16: Visual snapshots — light theme', async () => {
      // Seed jg-theme so the app mounts in light mode without needing a button click.
      const { page, ctx } = await freshPage({ storage: { 'jg-level': 'pro', 'jg-theme': 'light' } });
      const shoot = async (name) => {
        await page.waitForTimeout(400);
        const file = path.join(SHOTS_DIR, `${name}.png`);
        await page.screenshot({ path: file, fullPage: true });
        ok(`captured ${name}.png`, fs.existsSync(file) && fs.statSync(file).size > 1000,
          `missing/empty: ${file}`);
      };
      const tabs = [
        ['nav-guide', 'guide-light'], ['nav-diatonic', 'keys-light'],
        ['nav-custom', 'chords-light'], ['nav-iivi', 'play-light'], ['nav-quiz', 'train-light'],
      ];
      for (const [tour, name] of tabs) {
        const btn = await page.$(`[data-tour="${tour}"]`);
        if (btn) await btn.click({ timeout: 5000 });
        await shoot(name);
      }
      await ctx.close();
    });

    // ── 17: Tour spotlight stability ─────────────────────────────────────────
    // Regression guard for the post-paint rAF jump: measure the spotlight center
    // immediately after mount, wait 700ms, measure again. Should not drift.
    await test('Test 17: Tour spotlight stays stable after paint', async () => {
      const { page, ctx } = await freshPage({ suppressTour: false });
      await page.waitForTimeout(300);
      const getSpotCenter = () => page.evaluate(() => {
        const el = Array.from(document.querySelectorAll('*')).find(e => {
          const s = getComputedStyle(e);
          return s.position === 'absolute' && s.border.includes('2px') &&
                 s.pointerEvents === 'none' && parseFloat(s.width) > 30;
        });
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
      const pos1 = await getSpotCenter();
      await page.waitForTimeout(700);
      const pos2 = await getSpotCenter();
      if (pos1 && pos2) {
        const drift = Math.sqrt((pos2.x - pos1.x) ** 2 + (pos2.y - pos1.y) ** 2);
        ok(`spotlight stable after 700ms (drift=${Math.round(drift)}px ≤ 8px)`,
           drift <= 8,
           `jumped from (${Math.round(pos1.x)},${Math.round(pos1.y)}) to (${Math.round(pos2.x)},${Math.round(pos2.y)})`);
      } else {
        ok('spotlight element found for stability check', false,
           `pos1=${JSON.stringify(pos1)}, pos2=${JSON.stringify(pos2)}`);
      }
      await ctx.close();
    });

    // ── 18: Tour step-through — screenshot each step ──────────────────────────
    // Clicks "Next →" / "Done" through all tour steps, capturing a viewport
    // screenshot at each step. Exposes misaligned spotlights or broken card text.
    await test('Test 18: Tour step-through screenshots', async () => {
      fs.mkdirSync(SHOTS_DIR, { recursive: true });
      const { page, ctx, jsErrors } = await freshPage({ suppressTour: false });
      await page.waitForTimeout(500);
      let stepCount = 0;
      for (let i = 0; i < 8; i++) {
        const hasOverlay = await page.evaluate(() =>
          Array.from(document.querySelectorAll('*')).some(el => {
            const s = getComputedStyle(el);
            return s.position === 'fixed' && parseInt(s.zIndex) >= 200 && parseFloat(s.width) > 300;
          })
        );
        if (!hasOverlay) break;
        const file = path.join(SHOTS_DIR, `tour-step-${stepCount + 1}.png`);
        await page.screenshot({ path: file, fullPage: false });
        stepCount++;
        await page.evaluate(() => {
          // Find Next / Done button inside the tour card (fixed overlay)
          const btn = Array.from(document.querySelectorAll('button'))
            .find(b => /^(Next →|Done)$/.test(b.textContent?.trim()));
          if (btn) btn.click();
        });
        await page.waitForTimeout(450);
      }
      ok(`stepped through tour (≥4 steps captured, got ${stepCount})`, stepCount >= 4);
      const realErrors = jsErrors.filter(e => !isNoise(e));
      ok('no JS errors during tour step-through', realErrors.length === 0,
         realErrors.join('; ').slice(0, 200));
      await ctx.close();
    });

    // ── 19: Keys tab — key change updates chord display ───────────────────────
    // Opens the key picker, selects G, then verifies the chord button labels
    // changed to reflect the new key (proves re-render on key change works).
    await test('Test 19: Keys tab — key change updates chords', async () => {
      fs.mkdirSync(SHOTS_DIR, { recursive: true });
      const { page, ctx, jsErrors } = await freshPage();
      const keysBtn = await page.$('[data-tour="nav-diatonic"]');
      if (!keysBtn) { ok('Keys nav found', false); await ctx.close(); return; }
      await keysBtn.click({ timeout: 5000 });
      await page.waitForTimeout(400);

      // Record chord button text before key change
      const chordsBefore = await page.$$eval('button', btns =>
        btns.map(b => b.textContent?.trim()).filter(t => /^(vii|iii|ii|vi|IV|V|I)[A-G]/.test(t))
      );
      // Record neck highlight dot positions before key change
      const neckDotsBefore = await page.evaluate(() => {
        const neck = document.querySelector('[data-tour="neck-area"]');
        if (!neck) return '';
        const gs = neck.querySelectorAll('g[filter] circle');
        return Array.from(gs).map(c => c.getAttribute('cx')).join(',');
      });

      // Open key picker and select G (index 7 = G)
      const keyChip = await page.$('[data-tour="key-chip"] button');
      if (keyChip) await keyChip.click({ timeout: 3000 });
      await page.waitForTimeout(200);
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button'))
          .find(b => /^G$/.test(b.textContent?.trim()));
        if (btn) btn.click();
      });
      await page.waitForTimeout(400);

      const chordsAfter = await page.$$eval('button', btns =>
        btns.map(b => b.textContent?.trim()).filter(t => /^(vii|iii|ii|vi|IV|V|I)[A-G]/.test(t))
      );

      // Record neck highlight dot positions after key change
      const neckDotsAfter = await page.evaluate(() => {
        const neck = document.querySelector('[data-tour="neck-area"]');
        if (!neck) return '';
        const gs = neck.querySelectorAll('g[filter] circle');
        return Array.from(gs).map(c => c.getAttribute('cx')).join(',');
      });

      ok('key change: still 7 chord buttons after switching to G', chordsAfter.length === 7,
         `got ${chordsAfter.length}: ${chordsAfter.join(', ')}`);
      ok('key change: chord labels differ from C key', JSON.stringify(chordsBefore) !== JSON.stringify(chordsAfter),
         `before=${chordsBefore.join(',')}, after=${chordsAfter.join(',')}`);
      ok('key change: neck highlight dots moved (fret positions updated)', neckDotsBefore !== neckDotsAfter,
         `dots unchanged: ${neckDotsBefore}`);

      const screenshotFile = path.join(SHOTS_DIR, 'keys-key-change.png');
      await page.screenshot({ path: screenshotFile, fullPage: true });
      ok('captured keys-key-change.png', fs.existsSync(screenshotFile) && fs.statSync(screenshotFile).size > 1000);

      const realErrors = jsErrors.filter(e => !isNoise(e));
      ok('no JS errors during key change', realErrors.length === 0, realErrors.join('; ').slice(0, 200));
      await ctx.close();
    });

    // ── 20: Keys tab — chord selection, neck diagram updates ─────────────────
    // Clicks the ii chord, verifies the fretboard SVG is still present and no
    // errors are thrown. Guards against crashes on chord-click re-render.
    await test('Test 20: Keys tab — chord click updates neck', async () => {
      fs.mkdirSync(SHOTS_DIR, { recursive: true });
      const { page, ctx, jsErrors } = await freshPage();
      const keysBtn = await page.$('[data-tour="nav-diatonic"]');
      if (!keysBtn) { ok('Keys nav found', false); await ctx.close(); return; }
      await keysBtn.click({ timeout: 5000 });
      await page.waitForTimeout(400);

      // Click the ii chord button
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button'))
          .find(b => /^ii[A-G]/.test(b.textContent?.trim()));
        if (btn) btn.click();
      });
      await page.waitForTimeout(500);

      const hasNeck = await page.evaluate(() => !!document.querySelector('svg'));
      ok('neck SVG present after chord click', hasNeck);

      const screenshotFile = path.join(SHOTS_DIR, 'keys-chord-click.png');
      await page.screenshot({ path: screenshotFile, fullPage: true });
      ok('captured keys-chord-click.png', fs.existsSync(screenshotFile) && fs.statSync(screenshotFile).size > 1000);

      const realErrors = jsErrors.filter(e => !isNoise(e));
      ok('no JS errors on chord click', realErrors.length === 0, realErrors.join('; ').slice(0, 200));
      await ctx.close();
    });

    // ── 21: Ear training — answer flow, nav row stays in viewport ─────────────
    // Seeds jg-ear-intro so we land directly on a question. Verifies the ← ♪ →
    // row and choice grid render, then clicks a choice. After reveal, checks that
    // the → button's bottom edge is within the iPhone 14 viewport (844px) — the
    // exact layout bug that required scrolling before the fix.
    await test('Test 21: Ear training — answer flow, → in viewport', async () => {
      fs.mkdirSync(SHOTS_DIR, { recursive: true });
      const { page, ctx, jsErrors } = await freshPage({
        storage: { 'jg-ear-intro': '1' },
      });
      const earBtn = await page.$('[data-tour="nav-quiz"]');
      if (!earBtn) { ok('Ear Training nav found', false); await ctx.close(); return; }
      await earBtn.click({ timeout: 5000 });
      await page.waitForTimeout(600);

      // ♪ play button and → arrow should both be visible before answering
      const playBtnInView = await page.evaluate(() => {
        const btn = document.querySelector('[data-tour="ear-play-btn"]');
        if (!btn) return false;
        const r = btn.getBoundingClientRect();
        return r.top >= 0 && r.bottom <= window.innerHeight;
      });
      ok('♪ play button visible in viewport', playBtnInView);

      const nextArrowInViewBefore = await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button'))
          .find(b => b.getAttribute('aria-label') === 'Next');
        if (!btn) return null;
        const r = btn.getBoundingClientRect();
        return { inView: r.top >= 0 && r.bottom <= window.innerHeight, bottom: Math.round(r.bottom) };
      });
      ok('→ arrow button visible in viewport before answering',
         nextArrowInViewBefore && nextArrowInViewBefore.inView,
         `bottom=${nextArrowInViewBefore?.bottom}, viewport=844`);

      // Wait for choices to appear, then click the first one
      const choiceClicked = await page.evaluate(() => {
        const grid = document.querySelector('[data-tour="ear-choices"]');
        if (!grid) return false;
        const btn = grid.querySelector('button:not([disabled])');
        if (btn) { btn.click(); return true; }
        return false;
      });
      ok('clicked a choice button', choiceClicked);
      await page.waitForTimeout(400);

      // After reveal: → should be golden/active AND still in viewport
      const nextArrowInViewAfter = await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button'))
          .find(b => b.getAttribute('aria-label') === 'Next');
        if (!btn) return null;
        const r = btn.getBoundingClientRect();
        return { inView: r.top >= 0 && r.bottom <= window.innerHeight, bottom: Math.round(r.bottom) };
      });
      ok('→ arrow still in viewport after revealing answer',
         nextArrowInViewAfter && nextArrowInViewAfter.inView,
         `bottom=${nextArrowInViewAfter?.bottom}, viewport=844`);

      const screenshotFile = path.join(SHOTS_DIR, 'train-revealed.png');
      await page.screenshot({ path: screenshotFile, fullPage: false }); // viewport-only
      ok('captured train-revealed.png', fs.existsSync(screenshotFile) && fs.statSync(screenshotFile).size > 1000);

      const realErrors = jsErrors.filter(e => !isNoise(e));
      ok('no JS errors during ear training answer flow', realErrors.length === 0,
         realErrors.join('; ').slice(0, 200));
      await ctx.close();
    });

    // ── 22: Essentials — upgrade sheet trigger ────────────────────────────────
    // Clicks the consolidated "3 more modes" upgrade CTA in Essentials tier.
    // Verifies the upgrade sheet renders with the Pro price and an unlock action.
    await test('Test 22: Essentials — upgrade sheet appears on locked feature', async () => {
      fs.mkdirSync(SHOTS_DIR, { recursive: true });
      const { page, ctx, jsErrors } = await freshPage({
        storage: { 'jg-level': 'essentials', 'jg-ear-intro': '1' },
      });
      const earBtn = await page.$('[data-tour="nav-quiz"]');
      if (!earBtn) { ok('Ear Training nav found', false); await ctx.close(); return; }
      await earBtn.click({ timeout: 5000 });
      await page.waitForTimeout(400);

      // Click the consolidated "3 more modes" upgrade CTA (Essentials)
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button'))
          .find(b => /3 more modes/.test(b.textContent));
        if (btn) btn.click();
      });
      await page.waitForTimeout(400);

      const sheetText = await page.evaluate(() => document.body.innerText);
      ok('upgrade sheet contains pricing ($14.99)', sheetText.includes('14.99'),
         'upgrade sheet did not appear or lacks price text');
      ok('upgrade sheet contains unlock action', /unlock|upgrade/i.test(sheetText));

      const screenshotFile = path.join(SHOTS_DIR, 'upgrade-sheet.png');
      await page.screenshot({ path: screenshotFile, fullPage: false });
      ok('captured upgrade-sheet.png', fs.existsSync(screenshotFile) && fs.statSync(screenshotFile).size > 1000);

      const realErrors = jsErrors.filter(e => !isNoise(e));
      ok('no JS errors when upgrade sheet triggered', realErrors.length === 0,
         realErrors.join('; ').slice(0, 200));
      await ctx.close();
    });

    // ── 23: Play Essentials — locked-forms discovery shelf ────────────────────
    // Essentials deliberately shows every Pro progression as a dimmed 🔒 chip in
    // a horizontal-scroll shelf, so a free user can see what they'd be buying.
    // (This replaced an older "one consolidated CTA" design — the assertions
    // below describe the shelf, which is the intended behaviour.)
    // What actually matters and is guarded here:
    //   1. exactly one form is selectable — Essentials can't reach a Pro form
    //   2. the rest are present but locked, i.e. discoverable
    //   3. the shelf scrolls horizontally instead of wrapping into a wall, and
    //      does not push the page itself into horizontal overflow
    //   4. tapping a locked chip opens the paywall and does NOT switch the form
    await test('Test 23: Play Essentials — locked forms shown as a scrollable shelf', async () => {
      const { page, ctx, jsErrors } = await freshPage({ storage: { 'jg-level': 'essentials' } });
      const playBtn = await page.$('[data-tour="nav-iivi"]');
      if (!playBtn) { ok('Play nav found', false); await ctx.close(); return; }
      await playBtn.click({ timeout: 5000 });
      await page.waitForTimeout(400);

      const formRow = await page.$('[data-tour="play-form-row"]');
      ok('play-form-row rendered', !!formRow);

      if (formRow) {
        const split = await formRow.evaluate(el => {
          const btns = Array.from(el.querySelectorAll('button'));
          const locked = btns.filter(b => b.textContent.includes('🔒'));
          return { total: btns.length, locked: locked.length, unlocked: btns.length - locked.length };
        });
        ok(`exactly 1 selectable form in Essentials, got ${split.unlocked}`,
           split.unlocked === 1, `expected 1 unlocked, got ${split.unlocked} of ${split.total}`);
        ok(`Pro forms shown as locked chips, got ${split.locked}`,
           split.locked >= 8, `expected ≥8 locked chips, got ${split.locked}`);

        // The shelf must scroll, not wrap — and must not drag the page with it.
        const overflow = await formRow.evaluate(el => {
          const strip = Array.from(el.querySelectorAll('div')).find(
            d => getComputedStyle(d).overflowX === 'auto');
          return {
            hasScrollStrip: !!strip,
            stripScrolls: strip ? strip.scrollWidth > strip.clientWidth : false,
            pageOverflows: document.documentElement.scrollWidth > window.innerWidth + 1,
          };
        });
        ok('locked forms live in a horizontal-scroll strip', overflow.hasScrollStrip);
        ok('strip actually overflows (chips not wrapped into a wall)', overflow.stripScrolls);
        ok('shelf does not cause page-level horizontal overflow', !overflow.pageOverflows);

        // Tapping a locked chip sells, it does not switch the progression.
        const formBefore = await page.evaluate(() => localStorage.getItem('jg-form'));
        await formRow.evaluate(el => {
          const chip = Array.from(el.querySelectorAll('button'))
            .find(b => b.textContent.includes('🔒'));
          if (chip) chip.click();
        });
        await page.waitForTimeout(400);
        const body = await page.evaluate(() => document.body.innerText);
        ok('locked form chip opens the paywall', body.includes('14.99'),
           'upgrade sheet did not appear after tapping a locked form');
        const formAfter = await page.evaluate(() => localStorage.getItem('jg-form'));
        ok('locked form chip does not switch the progression', formBefore === formAfter,
           `jg-form changed ${formBefore} → ${formAfter}`);
      }

      const realErrors = jsErrors.filter(e => !isNoise(e));
      ok('no JS errors in Play Essentials', realErrors.length === 0, realErrors.join('; ').slice(0, 200));
      await ctx.close();
    });

    // ── 24: BPM — keyboard control moves the displayed value ─────────────────
    // Focuses the BPM knob (aria-label="BPM N") and fires ArrowUp keypresses.
    // Verifies the displayed number increases, proving the knob's keyboard
    // handler and React state update are wired correctly.
    await test('Test 24: BPM knob responds to keyboard input', async () => {
      const { page, ctx, jsErrors } = await freshPage();
      const playBtn = await page.$('[data-tour="nav-iivi"]');
      if (!playBtn) { ok('Play nav found', false); await ctx.close(); return; }
      await playBtn.click({ timeout: 5000 });
      await page.waitForTimeout(400);

      // BPM knob has aria-label "BPM <number>"
      const knob = await page.$('[aria-label^="BPM "]');
      ok('BPM knob found', !!knob);

      if (knob) {
        const bpmBefore = await page.evaluate(el => {
          const m = el.getAttribute('aria-label').match(/BPM (\d+)/);
          return m ? parseInt(m[1]) : null;
        }, knob);

        await knob.focus();
        // Each ArrowUp press = +5 BPM per the handler; press 3 times = +15
        await page.keyboard.press('ArrowUp');
        await page.keyboard.press('ArrowUp');
        await page.keyboard.press('ArrowUp');
        await page.waitForTimeout(200);

        const bpmAfter = await page.evaluate(el => {
          const m = el.getAttribute('aria-label').match(/BPM (\d+)/);
          return m ? parseInt(m[1]) : null;
        }, knob);

        ok(`BPM increased after 3×ArrowUp (before=${bpmBefore}, after=${bpmAfter})`,
           bpmAfter !== null && bpmAfter > bpmBefore,
           `bpmBefore=${bpmBefore}, bpmAfter=${bpmAfter}`);
      }

      const realErrors = jsErrors.filter(e => !isNoise(e));
      ok('no JS errors during BPM keyboard control', realErrors.length === 0,
         realErrors.join('; ').slice(0, 200));
      await ctx.close();
    });

    // ── 25: Onboarding questionnaire — answers personalize tour + Guide nudge ─
    // Answers "Advanced" / "Ear training", then verifies: profile is persisted,
    // the tour that follows picks up goal-specific copy, and the Guide's
    // goal-based suggestion card points at the "Train your ear" stage.
    await test('Test 25: Onboarding questionnaire personalizes tour + Guide', async () => {
      const { page, ctx, jsErrors } = await freshPage({
        suppressTour: false, storage: { 'jg-onboard-seen': '' },
      });

      const sheetText = await page.evaluate(() => document.body.innerText);
      ok('onboarding questionnaire shown on fresh load', /tailor your path/i.test(sheetText));

      // Pick "Advanced" then "Ear training", then Continue.
      await page.evaluate(() => {
        const clickByText = (re) => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => re.test(b.textContent));
          if (btn) btn.click();
          return !!btn;
        };
        clickByText(/^Advanced/);
        clickByText(/^Ear training/);
      });
      await page.waitForTimeout(150);
      const continued = await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Continue');
        if (btn && !btn.disabled) { btn.click(); return true; }
        return false;
      });
      ok('Continue enabled and clicked after answering both questions', continued);
      await page.waitForTimeout(300);

      const profile = await page.evaluate(() => localStorage.getItem('jg-onboard-profile'));
      ok('profile persisted to localStorage', profile === JSON.stringify({ level: 'advanced', goal: 'ear' }),
         `got ${profile}`);

      // Tour should now be showing, personalized for the "ear" goal.
      const tourText = await page.evaluate(() => document.body.innerText);
      ok('tour appears after onboarding completes', /learning path/i.test(tourText));
      ok('tour copy personalized for stated goal', /exactly what you told us you want to focus on/i.test(tourText)
         || /flagged for you at the top/i.test(tourText));

      // Skip the tour and land on Guide — check the goal-based suggestion card.
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Skip tour');
        if (btn) btn.click();
      });
      await page.waitForTimeout(300);
      const guideText = await page.evaluate(() => document.body.innerText);
      ok('Guide shows goal-based suggestion card', /Based on your goal.*ear training/i.test(guideText));
      ok('suggestion card names the ear-training stage', /Train your ear/.test(guideText));

      const realErrors = jsErrors.filter(e => !isNoise(e));
      ok('no JS errors during onboarding flow', realErrors.length === 0, realErrors.join('; ').slice(0, 200));
      await ctx.close();
    });

    // ── 26: Play tab goal nudge — comping/improv goal offers Drop 2 voicings ──
    await test('Test 26: Play tab nudge applies Drop 2 for improv goal', async () => {
      const { page, ctx, jsErrors } = await freshPage({
        storage: {
          'jg-level': 'pro',
          'jg-onboard-profile': JSON.stringify({ level: 'advanced', goal: 'improv' }),
        },
      });
      const playBtn = await page.$('[data-tour="nav-iivi"]');
      if (!playBtn) { ok('Play nav found', false); await ctx.close(); return; }
      await playBtn.click({ timeout: 5000 });
      await page.waitForTimeout(400);

      const bodyText = await page.evaluate(() => document.body.innerText);
      ok('Play tab shows improv-goal voicing nudge', /focused on improvisation/i.test(bodyText));

      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => /Switch to Drop 2/.test(b.textContent));
        if (btn) btn.click();
      });
      await page.waitForTimeout(200);
      const vType = await page.evaluate(() => localStorage.getItem('jg-vtype'));
      ok('tapping the nudge switches voicing to Drop 2', vType === 'drop2', `got ${vType}`);

      const realErrors = jsErrors.filter(e => !isNoise(e));
      ok('no JS errors during Play nudge flow', realErrors.length === 0, realErrors.join('; ').slice(0, 200));
      await ctx.close();
    });

    // ── 27: Text contrast — every visible label clears WCAG AA in both themes ──
    // Guards the accent-as-text palette (--tc-txt-*, --acc-*, --gold-txt). The
    // bright pastels used for dots and glows measure ~1.2:1 as type on the light
    // background; before this palette existed, 26 labels across the app were
    // unreadable in light mode. Any new label that hardcodes a bright hex for
    // `color:` instead of routing through the vars will fail here.
    await test('Test 27: text contrast meets WCAG AA in both themes', async () => {
      const measure = () => {
        const lum = (c) => {
          const [r, g, b] = c.map((v) => {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
          });
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        const parse = (s) => { const m = s && s.match(/[\d.]+/g); return m ? m.slice(0, 3).map(Number) : null; };
        // Only opaque backgrounds count — a translucent layer lets the one below show through.
        const opaque = (s) => {
          const m = s && s.match(/rgba?\(([^)]+)\)/);
          if (!m) return false;
          const p = m[1].split(',').map(Number);
          return p.length < 4 || p[3] > 0.5;
        };
        const bgOf = (el) => {
          let n = el;
          while (n && n !== document.documentElement) {
            const c = getComputedStyle(n).backgroundColor;
            if (opaque(c)) return parse(c);
            n = n.parentElement;
          }
          return parse(getComputedStyle(document.body).backgroundColor) || [255, 255, 255];
        };
        const bad = [];
        for (const el of document.querySelectorAll('*')) {
          if (el.children.length) continue;                       // leaf text nodes only
          const t = (el.textContent || '').trim();
          if (t.length < 2) continue;
          const r = el.getBoundingClientRect();
          if (r.width < 1 || r.height < 1) continue;              // skip hidden/collapsed
          const cs = getComputedStyle(el);
          const fg = parse(cs.color);
          if (!fg) continue;
          const L1 = lum(fg), L2 = lum(bgOf(el));
          const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
          const px = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight, 10) >= 700;
          const need = (px >= 24 || (px >= 18.66 && bold)) ? 3 : 4.5;  // WCAG "large text"
          if (ratio < need) bad.push(`"${t.slice(0, 22)}" ${ratio.toFixed(2)}:1 (need ${need})`);
        }
        return [...new Set(bad)];
      };

      for (const theme of ['dark', 'light']) {
        const { page, ctx } = await freshPage({ storage: { 'jg-level': 'pro', 'jg-theme': theme } });
        for (const [target, label] of [
          ['nav-guide', 'Guide'], ['nav-diatonic', 'Keys'], ['nav-custom', 'Chords'],
          ['nav-iivi', 'Play'], ['nav-quiz', 'Train'],
        ]) {
          const btn = await page.$(`[data-tour="${target}"]`);
          if (!btn) { ok(`${theme}/${label} nav found`, false); continue; }
          await btn.click();
          await page.waitForTimeout(350);
          const bad = await page.evaluate(measure);
          ok(`${theme} / ${label}: all text meets WCAG AA`, bad.length === 0, bad.slice(0, 3).join(' · '));
        }
        await ctx.close();
      }
    });

  } finally {
    await browser.close();
    server.close();
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n── Smoke test results ───────────────────────────────────');
  for (const r of results) console.log(r);
  console.log(`\n${passed + failed} checks: ${passed} passed, ${failed} failed`);
  console.log(`Screenshots written to ${SHOTS_DIR}`);
  if (failed > 0) process.exit(1);
})();
