// Content-correctness tests for the musical *data* in app.js (as opposed to
// the functions). These verify the chord changes of the built-in progressions
// and standards are harmonically correct and internally consistent, so a typo
// in a "standard" can't ship. Chords are stored as key-relative scale degrees
// [interval, quality, symbol, label], so the checks are transposition-invariant.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./load-app.cjs');

const JG = loadApp();
const QUALITIES = new Set(['maj7', 'm7', 'dom7', 'm7b5']);
const SYM_FOR = { maj7: 'maj7', m7: 'm7', dom7: '7', m7b5: 'ø7' };

// Values from the VM sandbox carry that realm's prototypes; compare by structure.
const same = (actual, expected) =>
  assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected);

// Reduce a form to a compact [degree, quality] sequence for comparison.
const seq = (form) => form.chords.map((c) => [c[0], c[1]]);

test('FORM_DEFS — every chord tuple is structurally valid', () => {
  for (const [name, form] of Object.entries(JG.FORM_DEFS)) {
    if (!form.chords || !form.chords.length) continue; // custom has none
    for (const c of form.chords) {
      assert.ok(Array.isArray(c) && c.length === 4, `${name}: chord not a 4-tuple`);
      const [interval, quality, sym, label] = c;
      assert.ok(Number.isInteger(interval) && interval >= 0 && interval < 12,
        `${name}: interval ${interval} out of range`);
      assert.ok(QUALITIES.has(quality), `${name}: unknown quality ${quality}`);
      assert.equal(typeof sym, 'string');
      assert.equal(typeof label, 'string');
      assert.ok(label.length > 0, `${name}: empty label`);
    }
  }
});

test('FORM_DEFS — display symbol matches the chord quality', () => {
  for (const [name, form] of Object.entries(JG.FORM_DEFS)) {
    if (!form.chords) continue;
    for (const c of form.chords) {
      assert.equal(c[2], SYM_FOR[c[1]], `${name}: ${c[1]} should display as ${SYM_FOR[c[1]]}, got ${c[2]}`);
    }
  }
});

test('FORM_DEFS — every bar points at a real chord', () => {
  for (const [name, form] of Object.entries(JG.FORM_DEFS)) {
    if (!form.bars || !form.bars.length) continue;
    // A bar entry is a chord index, or [idxA,idxB] for a split (two chords to a bar).
    for (const entry of form.bars) {
      const idxs = Array.isArray(entry) ? entry : [entry];
      assert.ok(!Array.isArray(entry) || entry.length === 2,
        `${name}: split bar must have exactly two chords`);
      for (const b of idxs) {
        assert.ok(Number.isInteger(b) && b >= 0 && b < form.chords.length,
          `${name}: bar index ${b} has no chord (chords: ${form.chords.length})`);
      }
    }
    // 12-bar forms must actually be 12 (or a multiple), 32-bar likewise.
    if (name === 'blues' || name === 'minblues' || name === 'twnbay') {
      assert.equal(form.bars.length, 12, `${name}: expected a 12-bar form`);
    }
  }
});

// ── Hand-verified harmonic content ────────────────────────────────────
// Each expected sequence is [scaleDegree, quality] against the tune's home key.

test('major ii–V–I', () => {
  same(seq(JG.FORM_DEFS.major), [[2, 'm7'], [7, 'dom7'], [0, 'maj7']]);
});

test('minor ii–V–i — half-diminished ii, dominant V, minor i', () => {
  same(seq(JG.FORM_DEFS.minor), [[2, 'm7b5'], [7, 'dom7'], [0, 'm7']]);
});

test('turnaround I–VI7–ii–V (VI played dominant)', () => {
  same(seq(JG.FORM_DEFS.turn),
    [[0, 'maj7'], [9, 'dom7'], [2, 'm7'], [7, 'dom7']]);
});

test('jazz blues — I7 IV7, VI7 in bar 8, ii–V in 9–10, V7 turnaround', () => {
  // chords: I7, IV7, VI7(=V7/ii), iim7, V7
  same(seq(JG.FORM_DEFS.blues),
    [[0, 'dom7'], [5, 'dom7'], [9, 'dom7'], [2, 'm7'], [7, 'dom7']]);
  // Bar layout (in F): F7 Bb7 F7 F7 | Bb7 Bb7 F7 D7 | Gm7 C7 F7 C7
  same([...JG.FORM_DEFS.blues.bars],
    [0, 1, 0, 0, 1, 1, 0, 2, 3, 4, 0, 4]);
});

test('minor blues — im7 throughout, iiø–V7 in 9–10', () => {
  same(seq(JG.FORM_DEFS.minblues),
    [[0, 'm7'], [5, 'm7'], [2, 'm7b5'], [7, 'dom7']]);
});

test('Autumn Leaves — A-section chords + last-A turnaround chords (in G)', () => {
  // A: Am7 D7 Gmaj7 Cmaj7 F#m7b5 B7 Em7, then turnaround chords A7 Dm7 G7
  same(seq(JG.FORM_DEFS.autumn),
    [[2, 'm7'], [7, 'dom7'], [0, 'maj7'], [5, 'maj7'], [11, 'm7b5'], [4, 'dom7'], [9, 'm7'],
     [2, 'dom7'], [7, 'm7'], [0, 'dom7']]);
});

test('Autumn Leaves — 32 bars with the last-A turnaround split into half bars', () => {
  const bars = JG.FORM_DEFS.autumn.bars;
  assert.equal(bars.length, 32, 'expected a 32-bar form');
  // Bars 27–28 (Em7|A7, Dm7|G7) and bar 30 (F#m7b5|B7) hold two chords each
  same(bars[26], [6, 7]);
  same(bars[27], [8, 9]);
  same(bars[29], [4, 5]);
});

test('All The Things You Are A section — descending-4ths cycle (in Ab)', () => {
  // Fm7 Bbm7 Eb7 Abmaj7 Dbmaj7 G7 Cmaj7
  same(seq(JG.FORM_DEFS.attya),
    [[9, 'm7'], [2, 'm7'], [7, 'dom7'], [0, 'maj7'], [5, 'maj7'], [11, 'dom7'], [4, 'maj7']]);
});

test('tritone sub — V7 replaced by bII7 (a tritone away)', () => {
  // ii V I ; then the bII7 (degree 1) substituting for V7 (degree 7)
  same(seq(JG.FORM_DEFS.tritone),
    [[2, 'm7'], [7, 'dom7'], [0, 'maj7'], [1, 'dom7']]);
  // bII7 root is a tritone (6 semitones) from V7 root: |7 - 1| = 6
  assert.equal(((7 - 1) % 12 + 12) % 12, 6);
});

test('secondary dominants — V7/vi (E7→Am7) and V7/ii (A7→Dm7) before ii–V–I', () => {
  same(seq(JG.FORM_DEFS.secdom),
    [[0, 'maj7'], [4, 'dom7'], [9, 'm7'], [9, 'dom7'], [2, 'm7'], [7, 'dom7']]);
  // Each secondary dominant sits a perfect 5th above its target.
  const cs = JG.FORM_DEFS.secdom.chords;
  assert.equal(((cs[1][0] - cs[2][0]) % 12 + 12) % 12, 7, 'V7/vi a 5th above vi');
  assert.equal(((cs[3][0] - cs[4][0]) % 12 + 12) % 12, 7, 'V7/ii a 5th above ii');
});
