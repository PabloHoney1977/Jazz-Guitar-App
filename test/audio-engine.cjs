// Audio-engine verification. The smoke suite proves the UI renders; this proves
// the Play tab's *audio graph* actually does what the engine claims — which
// sample buffers get played, how far they're pitch-shifted, whether the bass
// leaves its octave, and whether the room/stereo bus exists.
//
// It works by tagging every decoded AudioBuffer with the sample file it came
// from (fetch byteLength -> decodeAudioData -> AudioBuffer), then recording
// every AudioBufferSourceNode the engine starts during a real playback run.
//
// Run: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node test/audio-engine.cjs
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PORT = 8899;
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml' };

function serve() {
  return http.createServer((req, res) => {
    const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]) === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
    fs.readFile(p, (err, data) => {
      if (err) { res.writeHead(404); res.end('nope'); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
      res.end(data);
    });
  }).listen(PORT);
}

let pass = 0, fail = 0;
const check = (ok, label, detail) => {
  if (ok) { pass++; console.log(`  ✓ ${label}${detail ? ` (${detail})` : ''}`); }
  else { fail++; console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`); }
};

(async () => {
  const server = serve();
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  // React is vendored and served locally, so nothing should reach a CDN.
  // Abort rather than stub: a cdnjs hit means a CDN <script> crept back in.
  await page.route('**/cdnjs.cloudflare.com/**', (route) => route.abort());

  // Instrument BEFORE any app code runs.
  await page.addInitScript(() => {
    window.__AUDIO = { byLen: {}, plays: [], convolvers: 0, panners: [], decoded: [] };
    const A = window.__AUDIO;

    // Content fingerprint, not byteLength: every guitar-electric mp3 is exactly
    // 102696 bytes, so keying on length alone collapses all ten into one name.
    // FNV-1a over bytes sampled across the whole buffer.
    A.fp = (buf) => {
      const d = new Uint8Array(buf);
      const step = Math.max(1, Math.floor(d.length / 4096));
      let h = 0x811c9dc5;
      for (let i = 0; i < d.length; i += step) {
        h ^= d[i];
        h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
      }
      return d.length + ':' + h.toString(16);
    };

    // 1. fetch: remember which sample URL produced which fingerprint.
    const of = window.fetch;
    window.fetch = async function (...args) {
      const r = await of.apply(this, args);
      const url = String((args[0] && args[0].url) || args[0] || '');
      if (/\.mp3$/.test(url)) {
        const clone = r.clone();
        clone.arrayBuffer().then((b) => { A.byLen[A.fp(b)] = url.split('/').slice(-2).join('/'); }).catch(() => {});
      }
      return r;
    };

    const tag = new WeakMap();
    const patch = (Ctor) => {
      if (!Ctor) return;
      // 2. decodeAudioData: tag the resulting AudioBuffer with its source file.
      const od = Ctor.prototype.decodeAudioData;
      Ctor.prototype.decodeAudioData = function (buf, ...rest) {
        // Fingerprint before decode — decodeAudioData detaches the buffer.
        const len = buf ? A.fp(buf) : null;
        const p = od.call(this, buf, ...rest);
        if (p && p.then) p.then((ab) => { const n = A.byLen[len]; if (n) { tag.set(ab, n); A.decoded.push(n); } }).catch(() => {});
        return p;
      };
      // 3. every source node the engine starts.
      const os = Ctor.prototype.createBufferSource;
      Ctor.prototype.createBufferSource = function () {
        const node = os.call(this);
        const ostart = node.start.bind(node);
        node.start = function (when, ...r) {
          try {
            A.plays.push({
              file: (node.buffer && tag.get(node.buffer)) || null,
              dur: node.buffer ? +node.buffer.duration.toFixed(3) : null,
              detune: node.detune ? +node.detune.value.toFixed(1) : 0,
              when: +(when || 0).toFixed(4),
            });
          } catch (e) {}
          return ostart(when, ...r);
        };
        return node;
      };
      const oc = Ctor.prototype.createConvolver;
      if (oc) Ctor.prototype.createConvolver = function () { A.convolvers++; return oc.call(this); };
      const op = Ctor.prototype.createStereoPanner;
      if (op) Ctor.prototype.createStereoPanner = function () { const n = op.call(this); const d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(n), 'pan'); A.panners.push(n); return n; };
    };
    patch(window.AudioContext); patch(window.webkitAudioContext);

    localStorage.setItem('jg-onboard-seen', '1');
    localStorage.setItem('jg-toured', '1');
    localStorage.setItem('jg-level', 'pro');
  });

  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForTimeout(1500);

  // Into the Play tab (same selector the smoke suite uses).
  const navPlay = await page.$('[data-tour="nav-iivi"]');
  if (!navPlay) { console.log('FATAL: Play nav not found'); process.exit(1); }
  await navPlay.click({ timeout: 5000 });
  await page.waitForTimeout(900);

  // Start the transport. The play button is icon-only (an SVG polygon), so it
  // has no accessible text — it's the first button in the transport group.
  const started = await page.evaluate(() => {
    const grp = document.querySelector('[data-tour="play-transport"]');
    if (!grp) return null;
    const b = grp.querySelector('button');
    if (!b) return null;
    b.click();
    return true;
  });
  if (!started) { console.log('FATAL: transport button not found'); process.exit(1); }
  console.log('Transport started.');
  console.log('\nPlaying for 18s (count-in + several bars)...\n');
  await page.waitForTimeout(18000);

  const A = await page.evaluate(() => window.__AUDIO);
  await browser.close();
  server.close();

  const plays = A.plays.filter((p) => p.file);
  const of = (re) => plays.filter((p) => re.test(p.file));
  const uniq = (arr) => [...new Set(arr)];

  console.log('Decoded samples: ' + uniq(A.decoded).length + ' distinct');
  console.log('Total tagged source starts: ' + plays.length + '\n');

  console.log('DRUMS');
  const drums = of(/^drums\//);
  const rideHits = of(/drums\/ride(1|2)\.mp3/);
  const ridesUsed = uniq(rideHits.map((p) => p.file));
  check(drums.length > 0, 'real drum samples are playing', `${drums.length} hits`);
  check(ridesUsed.length >= 2, 'ride alternates between distinct cymbals', ridesUsed.map((r) => r.split('/')[1]).join(' + '));
  check(uniq(rideHits.map((p) => p.detune)).length > 5, 'ride hits are pitch-jittered (no two identical)', `${uniq(rideHits.map((p) => p.detune)).length} distinct detunes`);
  check(of(/hihat-pedal/).length > 0, 'hi-hat chick is firing', `${of(/hihat-pedal/).length} hits`);
  check(of(/kick/).length > 0, 'kick is feathered in', `${of(/kick/).length} hits`);

  console.log('\nGUITAR');
  const GA = { 'E2.mp3': 40, 'Fs2.mp3': 42, 'A2.mp3': 45, 'C3.mp3': 48, 'Fs3.mp3': 54,
               'A3.mp3': 57, 'C4.mp3': 60, 'Fs4.mp3': 66, 'A4.mp3': 69, 'C5.mp3': 72 };
  const gtr = of(/guitar-electric/);
  const gtrAnchors = uniq(gtr.map((p) => p.file));
  const maxDet = gtr.length ? Math.max(...gtr.map((p) => Math.abs(p.detune))) : 0;
  // Reconstruct the sounding pitches, then ask what the OLD three-anchor map
  // (F#2/F#3/F#4) would have had to stretch to reach those same notes. This is
  // the regression that matters, measured against real playback rather than a
  // guessed threshold.
  const sounding = gtr.map((p) => GA[p.file.split('/')[1]] + p.detune / 100).filter((n) => !isNaN(n));
  const nearest = (m, set) => set.reduce((a, b) => (Math.abs(b - m) < Math.abs(a - m) ? b : a));
  const oldMax = sounding.length ? Math.max(...sounding.map((m) => Math.abs(m - nearest(m, [42, 54, 66])) * 100)) : 0;
  check(gtr.length > 0, 'guitar comping is playing', `${gtr.length} notes, ${gtrAnchors.length} anchors`);
  check(maxDet <= 300, 'max pitch-shift within +/-3 semitones', `${maxDet} cents`);
  check(maxDet < oldMax, 'new sample map stretches less than the old 3-anchor map',
    `${maxDet}c now vs ${oldMax.toFixed(0)}c before, on the same notes`);

  console.log('\nBASS');
  const bass = of(/bass-electric/);
  const bassAnchors = uniq(bass.map((p) => p.file));
  // Reconstruct sounding pitch: anchor midi + detune semitones.
  const ANCHOR = { 'G1.mp3': 31, 'As1.mp3': 34, 'Cs2.mp3': 37, 'E2.mp3': 40, 'G2.mp3': 43, 'As2.mp3': 46 };
  const midis = bass.map((p) => ANCHOR[p.file.split('/')[1]] + p.detune / 100).filter((n) => !isNaN(n));
  const span = midis.length ? Math.max(...midis) - Math.min(...midis) : 0;
  check(bass.length > 0, 'bass samples are playing', `${bass.length} notes`);
  // The old engine did `36 + pitchClass`, so every note landed inside C2-B2
  // (midi 36-47) and the span could never exceed 11. Escaping that window is
  // the crisp invariant; raw span varies with which walking pattern is picked.
  const outside = midis.filter((m) => m < 36 || m > 47).length;
  check(outside > 0, 'bass escapes the old single-octave C2-B2 window',
    `${outside}/${midis.length} notes outside, span ${span.toFixed(1)} semitones`);
  check(bassAnchors.length >= 3, 'bass uses multiple register anchors', bassAnchors.map((b) => b.split('/')[1]).join(' '));

  console.log('\nMIX BUS');
  check(A.convolvers > 0, 'room reverb convolver created', `${A.convolvers}`);
  check(A.panners.length >= 3, 'per-instrument stereo panners created', `${A.panners.length}`);

  console.log('\nHUMANIZATION');
  const times = plays.map((p) => p.when).filter((n) => n > 0).sort((a, b) => a - b);
  const frac = times.map((t) => Math.abs((t * 1000) % 5)).filter((v) => v > 0.4 && v < 4.6).length;
  check(frac > times.length * 0.3, 'note onsets are off-grid (micro-timing jitter present)', `${frac}/${times.length} off-grid`);

  console.log(`\n${pass + fail} checks: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
