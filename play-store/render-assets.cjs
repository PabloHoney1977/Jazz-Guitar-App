// Render the Google Play listing assets from the live app.
//
// Play's rules differ from Apple's in two ways that matter here:
//   - phone screenshots must be at most 2× as tall as they are wide (Apple has
//     no such rule), so a 390×844 phone viewport is ILLEGAL at 9:19.5 — we
//     render 432×864 at dsf 2.5 → 1080×2160, exactly 1:2;
//   - a 1024×500 feature graphic is required and has no Apple equivalent.
//
// Run:  node play-store/render-assets.cjs
// Chromium comes from the same pinned path the smoke suite uses.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const ROOT = path.join(__dirname, '..');
const OUT = __dirname;
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json',
               '.svg': 'image/svg+xml', '.png': 'image/png', '.mp3': 'audio/mpeg' };

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const u = new URL(req.url, 'http://localhost');
      const fp = path.join(ROOT, u.pathname === '/' ? 'index.html' : u.pathname);
      if (!fp.startsWith(ROOT) || !fs.existsSync(fp)) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
      fs.createReadStream(fp).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

// Pro tier on purpose: the listing should show the app at full strength.
const SHOTS = [
  ['01-play',     'nav-iivi',     'Play — backing track, walking bass, comping'],
  ['02-keys',     'nav-diatonic', 'Keys — the seven diatonic chords, any key'],
  ['03-chords',   'nav-custom',   'Chords — any chord, any voicing, on the neck'],
  ['04-train',    'nav-quiz',     'Ear Training — intervals, triads, cadences'],
  ['05-guide',    'nav-guide',    'Guide — 16 ordered stages'],
];

(async () => {
  const server = await serve();
  const BASE = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

  // ── Phone screenshots ──────────────────────────────────────────────────────
  const ctx = await browser.newContext({
    viewport: { width: 432, height: 864 }, deviceScaleFactor: 2.5,
    isMobile: true, hasTouch: true, serviceWorkers: 'block',
  });
  const page = await ctx.newPage();
  await page.route('https://cdnjs.cloudflare.com/**', (r) => r.abort());
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('jg-level', 'pro');
    localStorage.setItem('jg-toured', '1');
    localStorage.setItem('jg-onboard-seen', '1');
    localStorage.setItem('jg-ear-intro', '1');
    localStorage.setItem('jg-chord-picker', '1');   // show the picker open on the Chords shot
    localStorage.setItem('jg-streak', '12');
    localStorage.setItem('jg-last-practice', new Date().toISOString().slice(0, 10));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#root button') !== null, { timeout: 15000 });

  for (const [name, tourId, caption] of SHOTS) {
    const btn = await page.$(`[data-tour="${tourId}"]`);
    if (!btn) { console.error('MISSING NAV', tourId); continue; }
    await btn.click();
    await page.waitForTimeout(900);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(250);
    const file = path.join(OUT, 'screenshots', name + '.png');
    await page.screenshot({ path: file });
    console.log(name.padEnd(10), '→', caption);
  }
  await ctx.close();

  // ── Feature graphic (1024×500, no transparency) ────────────────────────────
  const svg = fs.readFileSync(path.join(ROOT, 'icons', 'icon.svg'), 'utf8')
    .replace(/\s*<!-- "JGL" label -->[\s\S]*?<\/text>/, '')
    .replace('<svg ', '<svg width="300" height="300" ');
  const fg = await browser.newPage({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
  await fg.setContent(`<html><body style="margin:0">
    <div style="width:1024px;height:500px;display:flex;align-items:center;gap:56px;
                padding:0 72px;box-sizing:border-box;
                background:linear-gradient(160deg,#141430 0%,#07070f 70%)">
      <div style="flex:0 0 auto;filter:drop-shadow(0 8px 30px rgba(0,0,0,.6))">${svg}</div>
      <div style="font-family:Georgia,'Times New Roman',serif;color:#f0f0f8">
        <div style="font-size:66px;font-weight:700;letter-spacing:-.5px;line-height:1.05">Jazz Guitar Lab</div>
        <div style="font-size:31px;color:#d4a855;margin-top:18px;line-height:1.3">Learn jazz harmony on guitar</div>
        <div style="font-family:-apple-system,'Segoe UI',Roboto,sans-serif;font-size:21px;
                    color:#9a9ab4;margin-top:22px;line-height:1.5">
          Voicings · backing tracks · ear training
        </div>
      </div>
    </div></body></html>`, { waitUntil: 'load' });
  await fg.waitForTimeout(400);
  await fg.screenshot({ path: path.join(OUT, 'feature-graphic-1024x500.png'), clip: { x: 0, y: 0, width: 1024, height: 500 } });
  console.log('feature graphic → 1024×500');

  await browser.close();
  server.close();
})();
