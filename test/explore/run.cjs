// Jazz Guitar Lab — Exploratory Agent Test Harness
//
// Simulates real users with different musical backgrounds, learning styles,
// devices, and journey stages navigating the app — finding bugs and UX issues
// that scripted smoke tests miss.
//
// Usage:
//   node test/explore/run.cjs                     # 4 random personas
//   node test/explore/run.cjs --count 2           # 2 personas
//   node test/explore/run.cjs --seed 42           # reproducible run
//   node test/explore/run.cjs --day 30            # all personas at day 30
//   ANTHROPIC_API_KEY=sk-... node test/explore/run.cjs   # enables LLM synthesis
//
// Output: test/explore/reports/YYYYMMDD-HHMM/
//   report.md           structured findings (+ LLM synthesis if API key set)
//   session-NAME.json   step-by-step log per persona
//   screenshots/NAME/   one JPEG per step
//
// Each run is genuinely different: personas are seeded from --seed (or
// system time), so --seed 42 always produces the same 4 personas while
// omitting it gives fresh variation every time.

'use strict';
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const { URL: NodeURL } = require('url');

// ── Static file server ────────────────────────────────────────────────────────
const ROOT = path.join(__dirname, '..', '..');
const MIME = {
  '.html': 'text/html', '.js': 'application/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
};
const CDN_MAP = {
  'https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js':
    path.join(__dirname, '..', 'react.production.min.js'),
  'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js':
    path.join(__dirname, '..', 'react-dom.production.min.js'),
};
function startServer() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      const u  = new NodeURL(req.url, 'http://localhost');
      const fp = path.join(ROOT, u.pathname === '/' ? 'index.html' : u.pathname);
      if (!fp.startsWith(ROOT) || !fs.existsSync(fp)) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
      fs.createReadStream(fp).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

// ── Seeded PRNG (mulberry32 — deterministic, no crypto needed) ────────────────
function makePRNG(seed) {
  let s = seed >>> 0;
  return () => {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pick(arr, rng)    { return arr[Math.floor(rng() * arr.length)]; }
function rInt(lo, hi, rng) { return lo + Math.floor(rng() * (hi - lo + 1)); }
function pickWeighted(weights, rng) {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (const [k, w] of Object.entries(weights)) { r -= w; if (r <= 0) return k; }
  return Object.keys(weights).at(-1);
}

// ── Persona generation ────────────────────────────────────────────────────────
const NAMES   = ['Alex','Maria','James','Sofia','David','Priya','Marcus','Leila','Tom','Yuki','Sam','Nadia'];
const DEVICES = [
  { id:'iphoneSE',      label:'iPhone SE (375px)',  viewport:{width:375,height:667},  dpr:2, isMobile:true  },
  { id:'iphone14',      label:'iPhone 14 (390px)',  viewport:{width:390,height:844},  dpr:3, isMobile:true  },
  { id:'iphone14Plus',  label:'iPhone 14+ (430px)', viewport:{width:430,height:932},  dpr:3, isMobile:true  },
  { id:'ipad',          label:'iPad (768px)',        viewport:{width:768,height:1024}, dpr:2, isMobile:false },
];
const GOALS = [
  'Play along to something that sounds like jazz right now',
  'Understand what the Roman numerals (I, ii, V) actually mean',
  'Find a chord voicing I can play immediately',
  'Learn one new concept — just do one Guide stage',
  'Practice recognizing intervals by ear for a few minutes',
  'See what Pro unlocks and decide if $9.99 is worth it',
  'Change the key so it matches a song I am trying to play',
  'Just explore — not sure what this app does yet',
  'Keep my streak alive with a quick 5-minute practice',
  'Understand the difference between Shell and Drop 2 voicings',
];
// Guide stage IDs in order — used to seed realistic progress
const GUIDE_STAGES = [
  'qualities','intervals','shells','drop2','walking','iivi','minor','blues',
  'tritoneSub','secdom','tension','voice','rhythm','reharmonization','improv','standards',
];

function generatePersona(rng, forcedDay) {
  const name   = pick(NAMES, rng);
  const device = pick(DEVICES, rng);
  const day    = forcedDay ?? pick([1,3,7,14,30,60,90], rng);

  // Musical background 0–10; guitar and jazz knowledge correlate but vary
  const musical   = rInt(0, 9, rng);
  const guitar    = Math.max(0, Math.min(10, musical + rInt(-2, 3, rng)));
  const jazzKnow  = Math.max(0, Math.min(10, Math.floor(musical * 0.55 + rInt(-2, 3, rng))));
  const patience  = rInt(0, 9, rng);
  const explore   = rInt(0, 9, rng);
  const readHabit = Math.max(0, Math.min(10, Math.floor(patience * 0.55 + rInt(-1, 3, rng))));

  // Pro unlock probability rises with journey day
  const hasPro = day >= 14 && rng() < (day >= 30 ? 0.65 : 0.35);

  // Seed realistic Guide progress based on day
  const stagesDone = Math.min(GUIDE_STAGES.length, Math.floor(day / 2.5));
  const guidePath  = {};
  GUIDE_STAGES.slice(0, stagesDone).forEach(s => { guidePath[s] = true; });

  const streak     = day <= 1 ? 0 : Math.min(day, rInt(0, Math.floor(day * 0.85), rng));
  const etSessions = day >= 7 ? rInt(2, day, rng) : 0;
  const etScores   = etSessions > 0
    ? { intervals: { r: rInt(5, etSessions * 3, rng), w: rInt(0, etSessions, rng) } }
    : {};

  return {
    name, device, day, musical, guitar, jazzKnow,
    patience, explore, readHabit, hasPro,
    goal: pick(GOALS, rng),
    storedState: {
      'jg-toured':         '1',
      'jg-level':          hasPro ? 'pro' : 'essentials',
      'jg-streak':         String(streak),
      'jg-last-practice':  day > 0 ? String(Date.now() - 86_400_000) : '',
      'jg-path':           JSON.stringify(guidePath),
      'jg-ear-intro':      day >= 3 ? '1' : '',
      'jg-ear-scores':     JSON.stringify(etScores),
      'jg-play-sessions':  String(rInt(0, Math.floor(day * 0.4), rng)),
    },
    _rng: rng,
  };
}

function describePersona(p) {
  const jazzdesc = [
    'no jazz background','knows jazz sounds different from pop',
    'has heard of ii-V-I','can name a few standards',
    'understands basic jazz harmony','plays jazz casually',
    'advanced jazz player','semi-professional','professional','educator',
  ][Math.min(9, p.jazzKnow)];
  const style = p.readHabit > 6 ? 'methodical reader' : p.explore > 6 ? 'tap-first explorer' : 'balanced';
  return [
    `${p.name}  ·  Day ${p.day}  ·  ${p.device.label}  ·  ${p.hasPro ? 'Pro' : 'Essentials'}`,
    `  Guitar ${p.guitar}/10  ·  Jazz: ${jazzdesc}`,
    `  Style: ${style}  ·  Patience ${p.patience}/10  ·  Streak ${p.storedState['jg-streak']}d`,
    `  Goal: "${p.goal}"`,
  ].join('\n');
}

// ── DOM state extractor ───────────────────────────────────────────────────────
async function getDOMState(page) {
  return page.evaluate(() => {
    // Detect active tab by landmark elements — more reliable than nav button color checks.
    const has = sel => document.querySelector(sel) !== null;
    let activeTab = 'guide';
    if      (has('[data-tour="ear-mode-tabs"]') || has('[data-tour="ear-play-btn"]'))  activeTab = 'train';
    else if (has('[data-tour="play-transport"]') || has('[data-tour="bar-grid"]'))      activeTab = 'play';
    else if (has('[data-tour="chord-type-tabs"]'))                                      activeTab = 'chords';
    else if (has('[data-tour="voicing-tabs"]')   || has('[data-tour="chord-row"]'))     activeTab = 'keys';
    else if (has('[data-tour="guide-progress"]') || has('[id^="guide-stage-"]'))        activeTab = 'guide';

    const buttons = Array.from(document.querySelectorAll('button'))
      .map(b => b.textContent?.trim()).filter(t => t && t.length < 50 && t.length > 0).slice(0, 25);
    const lockCount    = buttons.filter(b => b.includes('\u{1F512}')).length;
    const upgradeOpen  = document.body.innerText.includes('9.99') && document.body.innerText.includes('Pro');
    const earRevealed  = !!document.querySelector('[data-tour="ear-choices"] button[disabled]');
    const earChoices   = document.querySelectorAll('[data-tour="ear-choices"] button:not([disabled])').length;
    const svgPresent   = document.querySelectorAll('svg').length > 0;
    const scrollY      = Math.round(window.scrollY);
    const pageText     = document.body.innerText.slice(0, 400);
    return { activeTab, buttons, lockCount, upgradeOpen, earRevealed, earChoices, svgPresent, scrollY, pageText };
  });
}

// ── Action executor ───────────────────────────────────────────────────────────
async function execute(page, action, rng) {
  const KEYS_LIST = ['G','D','A','E','F','Bb','Eb','Ab','B','Db'];
  switch (action) {
    case 'nav_guide':   await page.$eval('[data-tour="nav-guide"]',    b => b.click()).catch(()=>{}); await page.waitForTimeout(400); break;
    case 'nav_keys':    await page.$eval('[data-tour="nav-diatonic"]', b => b.click()).catch(()=>{}); await page.waitForTimeout(400); break;
    case 'nav_chords':  await page.$eval('[data-tour="nav-custom"]',   b => b.click()).catch(()=>{}); await page.waitForTimeout(400); break;
    case 'nav_play':    await page.$eval('[data-tour="nav-iivi"]',     b => b.click()).catch(()=>{}); await page.waitForTimeout(400); break;
    case 'nav_train':   await page.$eval('[data-tour="nav-quiz"]',     b => b.click()).catch(()=>{}); await page.waitForTimeout(400); break;

    case 'click_chord':
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button'))
          .find(b => /^(vii|iii|ii|vi|IV|V|I)[A-G♭#]/.test(b.textContent?.trim() || ''));
        btn?.click();
      });
      break;
    case 'click_random_chord':
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'))
          .filter(b => /^(vii|iii|ii|vi|IV|V|I)[A-G♭#]/.test(b.textContent?.trim() || ''));
        if (btns.length) btns[Math.floor(Math.random() * btns.length)].click();
      });
      break;

    case 'change_key': {
      await page.evaluate(() => document.querySelector('[data-tour="key-chip"] button')?.click());
      await page.waitForTimeout(200);
      const key = pick(KEYS_LIST, rng);
      await page.evaluate(k => {
        Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === k)?.click();
      }, key);
      break;
    }

    case 'click_voicing':
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'))
          .filter(b => /\b(shell|drop 2|drop 3|drop 2\+4|drop 2\+3|rootless|arpeggio)\b/i.test(b.textContent || ''));
        if (btns.length) btns[Math.floor(Math.random() * btns.length)].click();
      });
      break;

    case 'scroll_down':
      await page.evaluate(() => window.scrollBy(0, 250 + Math.floor(Math.random() * 200)));
      break;
    case 'scroll_up':
      await page.evaluate(() => window.scrollBy(0, -300));
      break;

    case 'expand_guide_stage': {
      const n = await page.evaluate(() => document.querySelectorAll('[id^="guide-stage-"]').length);
      if (n > 0) {
        const i = Math.floor(rng() * n);
        await page.evaluate(i => {
          const s = document.querySelectorAll('[id^="guide-stage-"]')[i];
          s?.querySelector('button')?.click();
        }, i);
      }
      break;
    }

    case 'answer_ear':
      await page.evaluate(() => {
        const grid = document.querySelector('[data-tour="ear-choices"]');
        if (grid) {
          const btns = Array.from(grid.querySelectorAll('button:not([disabled])'));
          if (btns.length) btns[Math.floor(Math.random() * btns.length)].click();
        }
      });
      break;

    case 'next_ear':
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button'))
          .find(b => b.getAttribute('aria-label') === 'Next' && !b.disabled);
        btn?.click();
      });
      break;

    case 'replay_ear':
      await page.$eval('[data-tour="ear-play-btn"]', b => b.click()).catch(() => {});
      break;

    case 'tap_locked': {
      const tapped = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'))
          .filter(b => b.textContent?.includes('🔒'));
        if (!btns.length) return false;
        btns[Math.floor(Math.random() * btns.length)].click();
        return true;
      });
      if (!tapped) {
        // also try clicking a tab button that shows a lock sub-element
        await page.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button'))
            .find(b => b.querySelector('span')?.textContent?.includes('🔒'));
          btn?.click();
        });
      }
      break;
    }

    case 'dismiss_upgrade':
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button'))
          .find(b => /maybe later|not now|close|✕|×/i.test(b.textContent || ''));
        btn?.click();
      });
      break;

    case 'bpm_up': {
      const knob = await page.$('[aria-label^="BPM "]');
      if (knob) { await knob.focus(); await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowUp'); }
      break;
    }
    case 'bpm_down': {
      const knob = await page.$('[aria-label^="BPM "]');
      if (knob) { await knob.focus(); await page.keyboard.press('ArrowDown'); }
      break;
    }

    case 'try_play_start':
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button'))
          .find(b => /^(start|▶|play)\b/i.test((b.textContent || b.getAttribute('aria-label') || '').trim()));
        btn?.click();
      });
      await page.waitForTimeout(600); // let it play one beat
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button'))
          .find(b => /^(stop|■|pause)\b/i.test((b.textContent || b.getAttribute('aria-label') || '').trim()));
        btn?.click();
      });
      break;

    case 'try_chord_type':
      await page.evaluate(() => {
        const area = document.querySelector('[data-tour="chord-type-tabs"]');
        const btns = Array.from((area ?? document).querySelectorAll('button')).slice(0, 10);
        if (btns.length) btns[Math.floor(Math.random() * btns.length)].click();
      });
      break;

    case 'click_mode_tab':  // ear training mode tabs
      await page.evaluate(() => {
        const area = document.querySelector('[data-tour="ear-mode-tabs"]');
        const btns = Array.from((area ?? document).querySelectorAll('button')).slice(0, 6);
        if (btns.length) btns[Math.floor(Math.random() * btns.length)].click();
      });
      break;

    case 'wait':
      break; // just screenshot + record, no interaction
  }
  await page.waitForTimeout(350);
}

// ── Persona-driven action picker ──────────────────────────────────────────────
// Returns an action ID weighted by persona traits and current session state.
function pickAction(persona, dom, ss) {
  // Hard contextual overrides
  if (dom.upgradeOpen)  return 'dismiss_upgrade';
  if (ss.tab === 'train' && dom.earRevealed) return rng_p() < 0.75 ? 'next_ear' : 'replay_ear';
  if (ss.tab === 'train' && !dom.earRevealed && dom.earChoices > 0) {
    return rng_p() < 0.6 ? 'answer_ear' : 'replay_ear';
  }

  function rng_p() { return persona._rng(); }

  // Base action pools per tab, with weights
  const pools = {
    guide:  { expand_guide_stage:0.35, scroll_down:0.25, nav_keys:0.12, nav_play:0.12, nav_train:0.08, scroll_up:0.08 },
    keys:   { click_random_chord:0.28, change_key:0.18, click_voicing:0.18, scroll_down:0.12, nav_play:0.12, tap_locked:0.12 },
    chords: { try_chord_type:0.30, click_chord:0.20, scroll_down:0.18, tap_locked:0.18, nav_keys:0.14 },
    play:   { try_play_start:0.28, bpm_up:0.15, bpm_down:0.08, tap_locked:0.20, scroll_down:0.14, nav_train:0.15 },
    train:  { answer_ear:0.40, replay_ear:0.25, click_mode_tab:0.15, tap_locked:0.12, scroll_down:0.08 },
    unknown:{ nav_guide:0.22, nav_keys:0.22, nav_play:0.22, nav_train:0.22, wait:0.12 },
  };

  const w = { ...(pools[ss.tab] ?? pools.unknown) };

  // Persona adjustments
  if (persona.explore > 7)   { w.tap_locked   = (w.tap_locked   ?? 0) * 2.8; }
  if (persona.jazzKnow < 3)  { w.nav_play     = (w.nav_play     ?? 0) * 1.8; } // beginners want to play
  if (persona.readHabit > 6) { w.expand_guide_stage = (w.expand_guide_stage ?? 0) * 1.8; }
  if (persona.patience < 3 && ss.stepsHere > 3) {
    // impatient: leave current tab
    w.nav_guide = 0.25; w.nav_keys = 0.25; w.nav_play = 0.25; w.nav_train = 0.25;
  }

  // Goal-driven boosts
  if (/play along/i.test(persona.goal))       { w.nav_play     = (w.nav_play     ?? 0) * 2.0; w.try_play_start = (w.try_play_start ?? 0) * 1.8; }
  if (/roman numeral|what.*mean/i.test(persona.goal)) { w.nav_guide = (w.nav_guide ?? 0) * 1.8; w.expand_guide_stage = (w.expand_guide_stage ?? 0) * 1.8; }
  if (/interval|ear/i.test(persona.goal))     { w.nav_train    = (w.nav_train    ?? 0) * 2.0; }
  if (/pro|unlock|\$9/i.test(persona.goal))   { w.tap_locked   = (w.tap_locked   ?? 0) * 3.0; }
  if (/change.*key|key/i.test(persona.goal))  { w.nav_keys     = (w.nav_keys     ?? 0) * 1.5; w.change_key = (w.change_key ?? 0) * 2.0; }

  // Day-1 users explore all tabs first
  if (persona.day <= 2) {
    const navBonus = 0.18;
    ['nav_guide','nav_keys','nav_play','nav_train'].forEach(a => { w[a] = (w[a] ?? 0) + navBonus; });
  }

  return pickWeighted(w, persona._rng);
}

// ── Static code analysis ──────────────────────────────────────────────────────
function analyzeCode(src) {
  const findings = [];
  const check = (condition, severity, category, finding, location) => {
    if (condition) findings.push({ severity, category, finding, location });
  };

  // Audio path
  const hasKsPatch = src.includes('if(!_guitarBufs&&_guitarRaw)');
  check(!hasKsPatch, 'high', 'audio',
    'First chord tap falls through to Karplus-Strong synthesis (harsh) — _guitarBufs is null until decodeAudioData completes after first user gesture',
    'playChordPreview');
  check(hasKsPatch, 'info', 'audio',
    'First-tap KS fallback patched: defers 300ms when _guitarRaw loaded but buffers not yet decoded',
    'playChordPreview');

  const hasVisibilityClose = src.includes("visibilityState==='hidden'");
  check(!hasVisibilityClose, 'medium', 'audio',
    'AudioContext not closed on page hide — iOS suspends audio silently when app backgrounds',
    'audio lifecycle');
  check(hasVisibilityClose, 'info', 'audio',
    'AudioContext closed on page hide — prevents suspended-context errors on iOS resume',
    'audio lifecycle');

  // Gating consistency
  check(!src.includes("if(vType!=='shell') setVType('shell')"), 'high', 'gating',
    'Missing vType→shell downgrade guard when level changes to Essentials',
    'level useEffect');
  check(!src.includes("if(form!=='major'){setForm('major')"), 'high', 'gating',
    'Missing form→major downgrade guard when level changes to Essentials',
    'level useEffect');

  // UX: loading indicator for samples
  const hasLoadingHint = src.includes('loading') && (src.includes('guitar') || src.includes('sample'));
  check(!hasLoadingHint, 'low', 'ux',
    'No visual indicator that guitar samples are loading — first-tap audio delay is invisible to user',
    'audio load UX');

  // Content: intro gate
  check(src.includes("!seenIntro"), 'info', 'content',
    'Ear Training has an intro gate (jg-ear-intro localStorage key) — new users see onboarding screen before questions start',
    'EarTrainingView');

  // Engagement: streak
  check(src.includes('jg-streak'), 'info', 'engagement',
    'Streak system: fires on Play session start or first ET answer, resets if day skipped, milestone cards at 3/7/14/30 days',
    'streak logic');

  // Play: tick lookahead
  if (src.includes('lookahead') || src.includes('LOOKAHEAD')) {
    const m = src.match(/lookahead[^=]*=\s*([\d.]+)/i);
    if (m && parseFloat(m[1]) < 0.2) {
      check(true, 'medium', 'audio',
        `Tick lookahead ${m[1]}s may be too tight on low-end devices — can cause scheduling gaps under CPU load`,
        'tick scheduler');
    }
  }

  // Accessibility: keyboard nav
  const hasBpmKeyboard = src.includes("'ArrowUp'") && src.includes('setBpm');
  check(hasBpmKeyboard, 'info', 'accessibility',
    'BPM knob supports keyboard navigation (ArrowUp/Down)',
    'BpmKnob');

  // Missing: no loading skeleton
  check(!src.includes('skeleton') && !src.includes('Skeleton'), 'low', 'ux',
    'No loading skeleton / shimmer — app renders React root synchronously but CDN React load creates a blank flash',
    'initial render');

  return findings;
}

// ── Session runner ────────────────────────────────────────────────────────────
const NOISE = e =>
  e.includes('AudioContext') || e.includes('serviceWorker') ||
  e.includes('speechSynthesis') || e.includes('NotAllowedError') ||
  e.includes('AbortError') || e.includes('Failed to fetch') || e.includes('cancel');

async function runSession(persona, port, reportDir, browser) {
  const name   = persona.name.toLowerCase();
  const shotDir = path.join(reportDir, 'screenshots', name);
  fs.mkdirSync(shotDir, { recursive: true });

  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    viewport:        persona.device.viewport,
    deviceScaleFactor: persona.device.dpr,
    isMobile:        persona.device.isMobile,
    hasTouch:        persona.device.isMobile,
    serviceWorkers:  'block',
  });
  const page = await ctx.newPage();
  await page.route('https://cdnjs.cloudflare.com/**', route => {
    const local = CDN_MAP[route.request().url()];
    if (local && fs.existsSync(local)) return route.fulfill({ path: local, contentType: 'application/javascript' });
    return route.abort();
  });

  const jsErrors = [];
  const audioRequests = [];
  page.on('pageerror', e => jsErrors.push(e.message));
  page.on('request',   r => { if (/nbrosowsky|\.mp3|\.wav/i.test(r.url())) audioRequests.push(r.url()); });

  await page.goto(`http://127.0.0.1:${port}`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(state => {
    localStorage.clear();
    for (const [k, v] of Object.entries(state)) if (v) localStorage.setItem(k, v);
  }, persona.storedState);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#root button') !== null, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(400);

  const ss = { tab: 'guide', stepsHere: 0, totalSteps: 0 };
  const steps = [];
  const TOTAL_STEPS = 20;

  for (let i = 0; i < TOTAL_STEPS; i++) {
    const dom    = await getDOMState(page);
    const prevTab = ss.tab;
    ss.tab       = dom.activeTab !== 'unknown' ? dom.activeTab : ss.tab;
    ss.stepsHere = ss.tab === prevTab ? ss.stepsHere + 1 : 0;
    ss.totalSteps++;

    const action = pickAction(persona, dom, ss);

    // Screenshot before action
    const shotFile = path.join(shotDir, `step-${String(i+1).padStart(2,'0')}.jpg`);
    await page.screenshot({ path: shotFile, type: 'jpeg', quality: 60, fullPage: false });

    steps.push({
      step:           i + 1,
      action,
      tab:            ss.tab,
      scrollY:        dom.scrollY,
      buttons:        dom.buttons.slice(0, 12),
      lockCount:      dom.lockCount,
      upgradeOpen:    dom.upgradeOpen,
      earRevealed:    dom.earRevealed,
      hasSVG:         dom.svgPresent,
      jsErrors:       jsErrors.filter(e => !NOISE(e)),
      screenshotFile: path.relative(path.join(reportDir, '..'), shotFile),
    });

    await execute(page, action, persona._rng);
  }

  // Final screenshot
  await page.screenshot({ path: path.join(shotDir, 'final.jpg'), type: 'jpeg', quality: 65, fullPage: false });
  await ctx.close();

  const realErrors = jsErrors.filter(e => !NOISE(e));
  const tabVisits  = steps.reduce((m, s) => { m[s.tab] = (m[s.tab]||0)+1; return m; }, {});

  return {
    persona: {
      name: persona.name, device: persona.device.label, day: persona.day,
      hasPro: persona.hasPro, goal: persona.goal,
      jazzKnow: persona.jazzKnow, patience: persona.patience, explore: persona.explore,
    },
    steps,
    summary: {
      tabVisits,
      tabsVisited:           Object.keys(tabVisits),
      upgradeTriggered:      steps.some(s => s.upgradeOpen),
      lockedFeaturesClicked: steps.filter(s => s.action === 'tap_locked').length,
      maxLockBadgesSeen:     Math.max(0, ...steps.map(s => s.lockCount)),
      jsErrors:              realErrors,
      audioRequests:         audioRequests.length,
      uniqueActions:         [...new Set(steps.map(s => s.action))],
    },
  };
}

// ── Text report (no API key) ──────────────────────────────────────────────────
function buildTextReport(sessions, codeFindings, reportDir, runAt, seed) {
  const L = [];
  L.push(`# Jazz Guitar Lab — Exploratory Test Report`);
  L.push(`**Run:** ${runAt}  |  **Seed:** ${seed}  |  **Personas:** ${sessions.length}`);
  L.push(`**Screenshots:** \`${path.relative(ROOT, reportDir)}/screenshots/\`\n`);

  L.push(`---\n## Personas\n`);
  sessions.forEach((s, i) => {
    const p = s.persona;
    L.push(`### ${i+1}. ${p.name} — Day ${p.day} · ${p.device} · ${p.hasPro ? 'Pro' : 'Essentials'}`);
    L.push(`- Jazz knowledge: ${p.jazzKnow}/10  |  Patience: ${p.patience}/10  |  Exploration: ${p.explore}/10`);
    L.push(`- Session goal: *"${p.goal}"*\n`);
    L.push(`**Session result:**`);
    L.push(`- Tabs visited: ${s.summary.tabsVisited.join(', ')} (steps: ${Object.entries(s.summary.tabVisits).map(([t,n]) => `${t}×${n}`).join(', ')})`);
    L.push(`- Upgrade sheet triggered: ${s.summary.upgradeTriggered ? '**yes**' : 'no'}`);
    L.push(`- Locked features tapped: ${s.summary.lockedFeaturesClicked}`);
    L.push(`- Max lock badges visible at once: ${s.summary.maxLockBadgesSeen}`);
    L.push(`- Audio requests: ${s.summary.audioRequests}`);
    L.push(`- JS errors: ${s.summary.jsErrors.length === 0 ? '✓ none' : s.summary.jsErrors.map(e => `\`${e.slice(0,80)}\``).join(', ')}`);
    L.push(`- Actions taken: ${s.summary.uniqueActions.join(', ')}\n`);
    L.push(`<details><summary>Full step log</summary>\n`);
    s.steps.forEach(st => {
      const flags = [];
      if (st.lockCount > 0)     flags.push(`🔒×${st.lockCount}`);
      if (st.upgradeOpen)       flags.push('💳 upgrade');
      if (st.jsErrors.length)   flags.push('⚠️');
      if (!st.hasSVG && ['keys','chords'].includes(st.tab)) flags.push('⚠️ no SVG');
      L.push(`  ${String(st.step).padStart(2)} [${st.tab.padEnd(6)}] \`${st.action}\` ${flags.join(' ')}`);
    });
    L.push(`</details>\n`);
  });

  L.push(`---\n## Static Code Analysis\n`);
  const byS = { high:[], medium:[], low:[], info:[] };
  codeFindings.forEach(f => (byS[f.severity] || byS.info).push(f));
  for (const [sev, items] of Object.entries(byS)) {
    if (!items.length) continue;
    const emoji = { high:'🔴', medium:'🟡', low:'🔵', info:'⚪' }[sev] ?? '⚪';
    L.push(`### ${emoji} ${sev.toUpperCase()}`);
    items.forEach(f => {
      L.push(`- **[${f.category}]** ${f.finding}`);
      if (f.location) L.push(`  *${f.location}*`);
    });
    L.push('');
  }

  L.push(`---\n## Cross-Session Patterns\n`);

  // Tab coverage
  const allTabs = sessions.flatMap(s => s.summary.tabsVisited);
  const tabHits = allTabs.reduce((m, t) => { m[t] = (m[t]||0)+1; return m; }, {});
  L.push(`**Tab coverage** (sessions that visited each tab):`);
  Object.entries(tabHits).sort((a,b) => b[1]-a[1]).forEach(([t,n]) => {
    const bar = '█'.repeat(n) + '░'.repeat(sessions.length - n);
    L.push(`  - \`${t.padEnd(7)}\` ${bar} ${n}/${sessions.length}`);
  });
  L.push('');

  const upgraders = sessions.filter(s => s.summary.upgradeTriggered).map(s => s.persona.name);
  if (upgraders.length) L.push(`**Upgrade sheet triggered by:** ${upgraders.join(', ')}\n`);

  const errorers = sessions.filter(s => s.summary.jsErrors.length > 0);
  if (errorers.length) {
    L.push(`**JS errors:**`);
    errorers.forEach(s => L.push(`  - ${s.persona.name}: ${s.summary.jsErrors.join('; ')}`));
  } else {
    L.push(`**JS errors:** None detected across all sessions ✓`);
  }
  L.push('');

  // Action diversity
  const allActions = [...new Set(sessions.flatMap(s => s.summary.uniqueActions))];
  L.push(`**Actions exercised across all sessions:** ${allActions.join(', ')}\n`);

  L.push(`---`);
  if (!process.env.ANTHROPIC_API_KEY) {
    L.push(`> **LLM synthesis not available** — set \`ANTHROPIC_API_KEY\` to have Claude analyse`);
    L.push(`> these session logs and screenshots for UX insights, pacing issues, and engagement gaps.`);
  }

  return L.join('\n');
}

// ── Optional: LLM synthesis via Anthropic API ─────────────────────────────────
async function llmSynthesize(sessions, codeFindings, reportDir) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  // Build a concise prompt — don't send raw screenshots (too large), send descriptions
  const sessionSummaries = sessions.map(s => {
    const p = s.persona;
    const stepNarrative = s.steps.map(st =>
      `  Step ${st.step}: [${st.tab}] ${st.action}${st.upgradeOpen?' (upgrade sheet appeared)':''}${st.lockCount>0?` (${st.lockCount} locks visible)`:''}${st.jsErrors.length?` ERROR: ${st.jsErrors[0]?.slice(0,60)}`:''}`
    ).join('\n');
    return [
      `## ${p.name} (Day ${p.day}, ${p.device}, ${p.hasPro?'Pro':'Essentials'})`,
      `Jazz knowledge: ${p.jazzKnow}/10 | Patience: ${p.patience}/10 | Goal: "${p.goal}"`,
      `Tabs visited: ${s.summary.tabsVisited.join(', ')} | Upgrade triggered: ${s.summary.upgradeTriggered}`,
      `JS errors: ${s.summary.jsErrors.length ? s.summary.jsErrors.join('; ') : 'none'}`,
      `Step log:\n${stepNarrative}`,
    ].join('\n');
  }).join('\n\n');

  const codeFindsText = codeFindings
    .filter(f => f.severity !== 'info')
    .map(f => `[${f.severity.toUpperCase()}/${f.category}] ${f.finding}`)
    .join('\n');

  const prompt = `You are a UX researcher and mobile app QA analyst reviewing simulated user sessions for "Jazz Guitar Lab" — a freemium iOS app that teaches jazz guitar harmony to adult guitarists. The app has 5 tabs: Guide (learning path), Keys (diatonic chords), Chords (any chord), Play (backing track), and Ear Training.

Freemium model: Essentials (free) gets shell voicings + major ii-V-I + basic ear training. Pro ($9.99 one-time) unlocks everything.

Here are ${sessions.length} simulated user sessions at different experience levels and journey stages:

${sessionSummaries}

Static code analysis found:
${codeFindsText}

Please analyse these sessions and provide:

1. **Critical bugs** — anything that would cause a user to think the app is broken
2. **UX friction points** — moments where users got confused, gave up, or took unexpected paths
3. **Freemium conversion insights** — which personas hit the paywall, what feature triggered it, did it feel natural or frustrating?
4. **Learning pacing issues** — is the Guide content paced well? Do users find the right content at the right journey stage?
5. **Engagement gaps** — where did users disengage? What features were never explored?
6. **Feature recommendations** — 2–3 specific improvements that would have the biggest impact on the personas in these sessions

Be specific and cite which persona/step you're drawing from. Prioritise findings by user impact.`;

  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });
    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.content?.[0]?.text ?? null);
        } catch { resolve(null); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  const args     = process.argv.slice(2);
  const getArg   = (flag, def) => { const i = args.indexOf(flag); return i >= 0 && args[i+1] ? args[i+1] : def; };
  const count    = parseInt(getArg('--count', '4'), 10);
  const seed     = parseInt(getArg('--seed', String(Date.now() & 0xFFFFFF)), 10);
  const forcedDay = getArg('--day', null) ? parseInt(getArg('--day',''), 10) : null;

  console.log(`\n╔══ Jazz Guitar Lab — Exploratory Agent Test ══╗`);
  console.log(`  Seed: ${seed}  |  Personas: ${count}${forcedDay ? `  |  Day: ${forcedDay}` : ''}`);
  console.log(`  LLM synthesis: ${process.env.ANTHROPIC_API_KEY ? '✓ enabled' : '✗ set ANTHROPIC_API_KEY to enable'}\n`);

  const masterRng = makePRNG(seed);
  const personas = Array.from({ length: count }, () =>
    generatePersona(makePRNG(Math.floor(masterRng() * 0xFFFFFF)), forcedDay)
  );

  console.log('Personas for this run:');
  personas.forEach((p, i) => console.log(`\n${i+1}. ${describePersona(p)}`));
  console.log('');

  // Report directory
  const now     = new Date();
  const runAt   = now.toISOString().replace(/[:.]/g,'‑').slice(0,16);
  const safeAt  = runAt.replace(/[‑]/g, '-');
  const reportDir = path.join(__dirname, 'reports', safeAt);
  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(
    path.join(reportDir, 'personas.json'),
    JSON.stringify(personas.map(p => ({ ...p, _rng: undefined })), null, 2)
  );

  // Code analysis
  process.stdout.write('Analysing app.js source...');
  const appSrc = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  const codeFindings = analyzeCode(appSrc);
  console.log(` ${codeFindings.length} findings\n`);

  // Browser + server
  const server = await startServer();
  const port   = server.address().port;
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  });

  console.log(`Running ${count} sessions in parallel (${20} steps each)...\n`);
  let sessions;
  try {
    sessions = await Promise.all(personas.map(p => {
      process.stdout.write(`  ▶ ${p.name}  (Day ${p.day}, ${p.device.label})\n`);
      return runSession(p, port, reportDir, browser).then(log => {
        process.stdout.write(`  ✓ ${p.name}  tabs: ${log.summary.tabsVisited.join('→')}  errors: ${log.summary.jsErrors.length}\n`);
        return log;
      });
    }));
  } finally {
    await browser.close();
    server.close();
  }

  // Save session logs
  sessions.forEach(s =>
    fs.writeFileSync(path.join(reportDir, `session-${s.persona.name.toLowerCase()}.json`), JSON.stringify(s, null, 2))
  );

  // LLM synthesis (if API key set)
  let llmSection = '';
  if (process.env.ANTHROPIC_API_KEY) {
    process.stdout.write('\nCalling Claude for synthesis...');
    const synthesis = await llmSynthesize(sessions, codeFindings, reportDir).catch(() => null);
    if (synthesis) {
      llmSection = `\n---\n## LLM Analysis (Claude)\n\n${synthesis}\n`;
      console.log(' done');
    } else {
      console.log(' failed (check API key)');
    }
  }

  // Write report
  const report = buildTextReport(sessions, codeFindings, reportDir, safeAt, seed) + llmSection;
  const reportFile = path.join(reportDir, 'report.md');
  fs.writeFileSync(reportFile, report);

  console.log(`\n${'─'.repeat(55)}`);
  console.log(`Report:      ${path.relative(ROOT, reportFile)}`);
  console.log(`Screenshots: ${path.relative(ROOT, reportDir)}/screenshots/`);
  console.log(`Re-run same personas: node test/explore/run.cjs --seed ${seed}`);
  console.log(`${'─'.repeat(55)}\n`);

  // Print the top of the report
  console.log(report.split('\n').slice(0, 45).join('\n'));
  console.log('\n[… full report in report.md …]');
})();
