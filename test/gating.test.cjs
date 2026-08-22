// Freemium gating regression guard.
//
// Almost all paywall logic lives in component render (lock badges + onUpgrade
// handlers), which the vm harness can't exercise. Instead this asserts the
// load-bearing gate expressions still exist in app.js source — so a refactor
// can't silently delete a gate (a paywall leak) or a free affordance.
//
// It doubles as the canonical FREEMIUM GATING MATRIX. Spec (from CLAUDE.md):
//
//   FREE (Essentials)              PRO ($14.99)
//   ─────────────────────────────  ─────────────────────────────────────────
//   Shell voicings only            Drop 2 / Drop 3 / Drop 2+4 / 2+3 / Rootless
//   Major ii–V–I only              minor ii–V–i, jazz/minor blues, tritone sub,
//                                    sec. dom., custom, all 5 standards
//   Interval tiers 1–3 (to 6ths)   Interval tiers 4–5 (2nds/7ths, tritone)
//   Melodic (ascending) intervals  Harmonic-interval mode
//   —                              Triads / 7th Chords / Cadences modes
//   —                              Auto ear-training
//   First 4 chord types (Any Chord) Extended types (9/11/13/alt)
//   1 chord-scale per degree        All chord-scale options
//   Build-a-Chord                   Find Chord (detect)
//   All 16 Guide stages open        Pro-preset buttons inside stages
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const has = (s) => SRC.includes(s);

test('voicings — Drop 2/3/2+4/2+3/Rootless gated in Keys tab', () => {
  assert.ok(has("const locked=isEss&&(id==='drop2'||id==='drop3'||id==='drop24'||id==='drop23'||id==='rootless')"),
    'Keys voicing-tab gate missing — shells-only free tier could leak');
});

test('voicings — Drop tabs gated in Chords (Any Chord) tab', () => {
  assert.ok(has("{id:'drop2',lbl:'Drop 2',locked:isEss}"), 'drop2 not locked in Chords');
  assert.ok(has("{id:'drop3',lbl:'Drop 3',locked:isEss}"), 'drop3 not locked in Chords');
  assert.ok(has("{id:'drop24',lbl:'Drop 2+4',locked:isEss}"), 'drop24 not locked in Chords');
  assert.ok(has("{id:'drop23',lbl:'Drop 2+3',locked:isEss}"), 'drop23 not locked in Chords');
});

test('voicings — runtime guards force shell when level is/with becomes essentials', () => {
  // Play tab (level effect) and Chords tab both downgrade non-shell to shell.
  assert.ok(has("if(vType!=='shell') setVType('shell')"), 'Play tab shell-downgrade guard missing');
  assert.ok(has("if(isEss&&(vType==='drop3'||vType==='drop24'||vType==='drop23'||vType==='drop2'))setVType('shell')"),
    'Chords tab shell-downgrade guard missing');
  // Persisted vType is sanitized on load.
  assert.ok(has("safeLS('jg-level')==='essentials'&&v!=='shell'?'shell':v"),
    'persisted vType not sanitized for essentials');
});

test('play forms — only major is free; all others route to upgrade', () => {
  // Essentials branch: major is the only active button; locked forms are
  // collapsed into a single upgrade-prompt button (not enumerated individually).
  assert.ok(has("e('button',{onClick:()=>setForm('major'),style:modeBtn(form==='major',FORM_DEFS.major.col,FORM_DEFS.major.bg)},FORM_DEFS.major.lbl),"),
    'essentials major-form button missing');
  // The upgrade prompt calls onUpgrade with the form label.
  assert.ok(has('onClick:()=>onUpgrade(FORM_DEFS[f].lbl)'),
    'essentials upgrade prompt should call onUpgrade');
  // Runtime guard forces major if the level flips while on a Pro form.
  assert.ok(has("if(form!=='major'){setForm('major');setIsPlaying(false);}"),
    'Play tab major-downgrade guard missing');
});

test('ear training — interval tier 3, triads, 7ths, cadences, auto, harmonic all gated', () => {
  assert.ok(has('const maxTier=isEss?3:5'), 'advanced interval tiers (4-5) not gated');
  assert.ok(has("{id:'triads',lbl:'Triads',locked:isEss}"), 'Triads not gated');
  assert.ok(has("{id:'chords',lbl:'7th Chords',locked:isEss}"), '7th Chords not gated');
  assert.ok(has("{id:'cadences',lbl:'Cadences',locked:isEss}"), 'Cadences not gated');
  assert.ok(has("if(!autoMode&&isEss){onUpgrade('Auto ear training');return;}"), 'Auto ear not gated');
  assert.ok(has("mode==='intervals'&&!isEss?e('div'"), 'Harmonic-mode toggle not gated to Pro');
});

test('any chord — only the first 4 chord types are free', () => {
  assert.ok(has('const locked=isEss&&i>=4'), 'extended chord types not gated (i>=4)');
});

test('chord-scale options — essentials sees a single default scale', () => {
  assert.ok(has('isEss?CHORD_SCALES[deg].slice(0,1):CHORD_SCALES[deg]') ||
            has("level==='essentials'?CHORD_SCALES[degree].slice(0,1):CHORD_SCALES[degree]"),
    'scale-options gate missing — Pro modes could leak free');
});

test('find chord (detect) — gated to Pro', () => {
  assert.ok(has("if(isEss){onUpgrade('Find Chord');return;}"), 'Find Chord not gated');
});

test('FREE affordances are NOT over-gated (anti-crippling guards)', () => {
  // Shell must always be a selectable voicing (never locked).
  assert.ok(!has("{id:'shell',lbl:'Shell',locked:isEss}"), 'Shell must never be locked');
  // Arpeggio is a free learning aid used by free-accessible Guide stages.
  assert.ok(has("{id:'arpeggio',lbl:'Arpeggio',locked:false}"), 'Arpeggio should stay free');
  // The major ii–V–I must remain directly playable (setForm, not onUpgrade).
  assert.ok(has("onClick:()=>setForm('major')"), 'major form must stay free/playable');
});

test('web/PWA build cannot hand out Pro (public GitHub Pages copy)', () => {
  // The repo is public and served on Pages, so anyone can load the web build.
  // Every free-Pro path there must be armed by ?dev=1 first, or the browser
  // copy becomes a free edition of the $14.99 product.
  assert.ok(has("localStorage.setItem('jg-dev','1')") && has("const DEV_UNLOCK="),
    'DEV_UNLOCK opt-in flag missing');
  assert.ok(has('if(!DEV_UNLOCK){') && has("track('upgrade.web'"),
    'doUpgrade web branch must fail closed unless the dev unlock is armed');
  assert.ok(has('if(!DEV_UNLOCK) return false;'),
    'doRestore web branch must fail closed unless the dev unlock is armed');
  assert.ok(has('(IAP.isNative()||DEV_UNLOCK)?startTrial:null'),
    'the 7-day trial must not be offered where no purchase can follow');
  assert.ok(has('IAP.isNative()||!DEV_UNLOCK'),
    'the header Pro chip revert must be a dev-only affordance');
});

test('no code path grants a tier from a Guide preset', () => {
  // openPreset applies key/degree/voicing/form only. A stage carrying
  // `level:'pro'` would permanently unlock Pro with one tap.
  assert.ok(!/if\(p\.level\)/.test(SRC), 'openPreset must not set the tier');
  assert.ok(!/preset:\{[^}]*level:/.test(SRC), 'no Guide preset may carry a level');
});

test('purchase paths fail closed on device', () => {
  // A native build with a missing/misconfigured Purchases bridge must never
  // fall through to the dev unlock — that ships the product for free.
  assert.ok(has('if(IAP.isNative()){') && has("track('upgrade.unavailable'"),
    'doUpgrade must fail closed on native when the IAP bridge is unavailable');
  assert.ok(has('if(IAP.isNative()) return false;'), 'doRestore must fail closed on native');
});
