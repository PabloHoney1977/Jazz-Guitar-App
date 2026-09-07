// Fretfire smoke suite. Drives a real browser through the whole app: boots it,
// walks every screen, plays a melody chart and a chord chart to completion with
// an autoplaying bot, and checks the results actually persist.
//
// The one thing it guards above all else: the app must make ZERO external
// requests. Everything is local, and it stays that way.

import { launch } from './browser.mjs';
import { serve } from './serve.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const SHOTS = fileURLToPath(new URL('screenshots/', import.meta.url));
let pass = 0, fail = 0;
const ok = (cond, label, detail = '') => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}${detail ? ' — ' + detail : ''}`); }
};
const section = (t) => console.log(`\n${t}`);

const { server, port } = await serve(0);
const base = `http://localhost:${port}/`;
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

const consoleErrors = [];
const external = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));
page.on('request', r => { if (!r.url().startsWith(base) && !r.url().startsWith('data:')) external.push(r.url()); });

await mkdir(SHOTS, { recursive: true });
// Screens fade in over 220ms; screenshotting through that produces washed-out
// images that look like CSS bugs and are not.
const shot = async (name) => {
  await page.waitForTimeout(320);
  await page.screenshot({ path: SHOTS + name + '.png' });
};

// Start from a clean profile every run.
// Clear the profile once per run, not on every navigation — otherwise the
// "does a returning player skip the intro" check can never be true.
await page.addInitScript(() => {
  try {
    if (!sessionStorage.getItem('__smoke')) { localStorage.clear(); sessionStorage.setItem('__smoke', '1'); }
  } catch (e) {}
});

section('Boot');
await page.goto(base, { waitUntil: 'networkidle' });
ok(await page.locator('#boot').count() === 0, 'boot placeholder is removed once the app mounts');
ok(await page.locator('#screen-intro.on').count() === 1, 'a first-time player lands on the intro');
ok(external.length === 0, 'zero external network requests', external.join(', '));
await shot('01-intro');

section('First run');
await page.getByText('Sounds good').click();
await page.getByText('Not right now').click();
ok((await page.textContent('#screen-intro')).includes('Hold it'), 'the holding-the-guitar card follows');
await page.getByText("Let's play").click();
ok(await page.locator('#screen-home.on').count() === 1, 'the intro hands off to home');
const homeText = await page.textContent('#screen-home');
ok(homeText.includes('Lv 1'), 'home shows the level');
ok(homeText.includes('0/50'), 'home shows total stars available');
ok(homeText.includes('First Sparks'), 'home offers the first song');
await shot('02-home');

section('Song list');
await page.locator('#screen-home').getByText('All songs').click();
const rows = page.locator('.songrow');
ok(await rows.count() === 10, 'all ten songs are listed');
ok(await page.locator('.songrow.locked').count() === 9, 'only the first song is unlocked');
await shot('03-songs');

section('Lesson');
await rows.first().click();
ok(await page.locator('#screen-lesson.on').count() === 1, 'a new song opens its lesson first');
ok((await page.textContent('#screen-lesson')).includes('thickest string'), 'the lesson teaches before it tests');
await page.locator('#screen-lesson').getByText('Hear it').click();       // must not throw
await shot('04-lesson');

// A bot that plays perfectly, using the engine's own clock.
await page.addInitScript(() => {
  window.__startBot = () => {
    const g = window.fretfire.game;
    const tick = () => {
      if (g.state === 'done' || g.state === 'idle') return;
      if (g.state === 'playing') {
        const t = g.songTime();
        for (const n of g.notes) {
          if (n.judged) continue;
          if (n.t - t > 0.02) break;
          if (n.type === 'chord') g.strum(); else g.pressLane(n.lanes[0]);
        }
      }
      requestAnimationFrame(tick);
    };
    tick();
  };
});
await page.reload({ waitUntil: 'networkidle' });

section('Playing a melody chart');
await page.evaluate(() => window.fretfire.startSong('first-sparks', { speed: 3 }));
await page.waitForTimeout(400);
ok(await page.locator('#screen-play.on').count() === 1, 'the play screen takes over');
ok(await page.locator('#lane-pads .lanebtn').count() === 6, 'six lane pads for six strings');
ok(await page.locator('#strum-bar').isHidden(), 'no strum bar on a single-note chart');
await page.evaluate(() => window.__startBot());
await page.waitForTimeout(900);
await shot('05-play');

// The canvas must actually be drawing something.
const painted = await page.evaluate(() => {
  const c = document.getElementById('stage');
  const ctx = c.getContext('2d');
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  let lit = 0;
  for (let i = 0; i < d.length; i += 4 * 97) if (d[i] + d[i + 1] + d[i + 2] > 120) lit++;
  return lit;
});
ok(painted > 200, 'the highway is rendering, not blank', 'lit samples: ' + painted);

await page.waitForSelector('#screen-results.on', { timeout: 30000 });
const res = await page.textContent('#screen-results');
ok(/★{4,}/.test(await page.textContent('.bigstars')) || res.includes('S'), 'a perfect run earns top marks');
ok(res.includes('FULL COMBO'), 'a perfect run is flagged as a full combo');
ok(res.includes('Unlocked'), 'finishing song 1 unlocks song 2');
ok(res.includes('XP'), 'XP is awarded');
await shot('06-results');

section('Progress persists');
const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('fretfire-v1')));
ok(saved.stars['first-sparks'] >= 4, 'stars are saved');
ok(saved.xp > 0, 'XP is saved');
ok(saved.streak === 1, 'the daily streak starts at one');
await page.goto(base, { waitUntil: 'networkidle' });
ok(await page.locator('#screen-home.on').count() === 1, 'a returning player skips the intro');
await page.locator('#screen-home').getByText('All songs').click();
ok(await page.locator('.songrow.locked').count() === 8, 'the next song is now unlocked');

section('Playing a chord chart');
await page.evaluate(() => window.fretfire.startSong('ember', { speed: 3 }));
await page.waitForTimeout(400);
ok(await page.locator('#strum-bar').isVisible(), 'chord charts show one strum bar, not six lanes');
ok(await page.locator('#lane-pads').isHidden(), 'lane pads are hidden for chord charts');
ok((await page.textContent('#hud-chord')).includes('Em'), 'the HUD names the chord that is coming');
await page.evaluate(() => window.__startBot());
await page.waitForSelector('#screen-results.on', { timeout: 30000 });
ok((await page.textContent('#screen-results')).includes('Ember'), 'the chord chart completes');
await shot('07-chords');

section('Guitar Mode judging');
// There is no guitar in CI, so drive the mic path directly with fabricated
// readings. This is the half of the product a tap-only test never touches.
await page.evaluate(() => window.fretfire.store.set('inputMode', 'guitar'));
await page.evaluate(() => window.fretfire.startSong('hot-cross-buns', { speed: 1 }));
await page.waitForFunction(() => window.fretfire.game.state === 'playing', null, { timeout: 15000 });
ok(await page.locator('#mic-live').isVisible(), 'Guitar Mode shows the listening indicator');
ok(await page.locator('#lane-pads').isHidden(), 'Guitar Mode hides the tap pads');

const mic = await page.evaluate(() => new Promise(resolve => {
  const g = window.fretfire.game;
  let hit = null, wrongIgnored = null, phase = 0;
  const tick = () => {
    const t = g.songTime();
    const n = g.notes.find(x => !x.judged);
    if (!n) return resolve({ hit, wrongIgnored });
    if (Math.abs(n.t - t) < 0.03) {
      const base = { time: t, confidence: 0.9, onset: true, chroma: null, rms: 0.2 };
      if (phase === 0) {
        g.feedMic({ ...base, midi: n.midis[0] });
        hit = n.judged; phase = 1;
      } else {
        g.feedMic({ ...base, midi: n.midis[0] + 5 });   // a wrong note, in time
        wrongIgnored = !n.judged;
        return resolve({ hit, wrongIgnored });
      }
    }
    requestAnimationFrame(tick);
  };
  tick();
}));
ok(mic.hit === true, 'the right note played at the right time registers a hit');
ok(mic.wrongIgnored === true, 'the wrong note does not count, however good the timing');

await page.evaluate(() => { window.fretfire.game.stop(); });
await page.evaluate(() => window.fretfire.startSong('ember', { speed: 1 }));
await page.waitForFunction(() => window.fretfire.game.state === 'playing', null, { timeout: 15000 });
const chord = await page.evaluate(() => new Promise(resolve => {
  const g = window.fretfire.game;
  const tick = () => {
    const t = g.songTime();
    const n = g.notes.find(x => !x.judged);
    if (!n) return resolve(null);
    if (Math.abs(n.t - t) < 0.02) {
      // Perfect timing, but the chord came out muted: graded down, never missed.
      g.feedMic({ time: t, midi: null, confidence: 0, onset: true, rms: 0.3, chroma: new Float32Array(12) });
      return resolve({ judged: n.judged, result: n.result, counts: g.counts.slice() });
    }
    requestAnimationFrame(tick);
  };
  tick();
}));
ok(chord && chord.judged, 'a strum on the beat always counts as a hit');
ok(chord && chord.result === 1, 'a muted-sounding chord is graded down, not missed', 'result ' + (chord && chord.result));
ok(chord && chord.counts[3] === 0, 'a muted chord never becomes a miss');
await page.evaluate(() => { window.fretfire.game.stop(); window.fretfire.store.set('inputMode', 'tap'); });

section('Pause');
await page.evaluate(() => window.fretfire.startSong('ember', { speed: 1 }));
await page.waitForTimeout(500);
await page.click('#btn-pause');
ok((await page.textContent('#screen-play')).includes('Paused'), 'the pause menu opens');
ok(await page.evaluate(() => window.fretfire.game.state) === 'paused', 'the clock actually stops');
await page.locator('#screen-play').getByText('Keep playing').click();
ok(await page.evaluate(() => window.fretfire.game.state) !== 'paused', 'resuming works');
await page.evaluate(() => { window.fretfire.game.stop(); window.fretfire.goto('home'); });

section('Tuner and settings');
await page.locator('#screen-home').getByText('Tuner').click();
await page.waitForTimeout(600);
ok((await page.textContent('#screen-tuner')).includes('Thick to thin'), 'the tuner explains string order');
ok(await page.locator('.stringpick button').count() === 6, 'the tuner offers all six reference pitches');
await shot('08-tuner');
await page.locator('#screen-tuner .topbar .back').click();

await page.locator('#screen-home button[aria-label="Settings"]').click();
ok((await page.textContent('#screen-settings')).includes('Real guitar'), 'Guitar Mode is offered in settings');
await page.locator('#screen-settings').getByText('50%', { exact: true }).click();
ok(await page.evaluate(() => JSON.parse(localStorage.getItem('fretfire-v1')).settings.speed) === 0.5, 'practice speed persists');
await shot('09-settings');

section('Health');
ok(consoleErrors.length === 0, 'no console errors anywhere', consoleErrors.slice(0, 3).join(' | '));
ok(external.length === 0, 'still zero external requests', external.slice(0, 3).join(', '));

await browser.close();
server.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
