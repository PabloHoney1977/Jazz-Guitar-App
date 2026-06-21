// Unit tests for the pure music-theory layer of app.js.
// Run: node --test
// These are the regression net for the deterministic functions and data
// tables — every bug we hand-fixed in this area has a guard here so it can't
// silently come back.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./load-app.cjs');

const JG = loadApp();
const MAJOR = new Set([0, 2, 4, 5, 7, 9, 11]); // C major pitch classes

// Values returned from the VM sandbox carry that realm's Array/Object
// prototypes, so deepStrictEqual's constructor check fails on otherwise-equal
// data. Round-trip through JSON to compare by structure across realms.
const same = (actual, expected) =>
  assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected);

test('harness captured all symbols', () => {
  for (const k of ['getChordTones', 'calcVoicing', 'getScalePos', 'getArpPos', 'nn', 'DNAMES', 'INT_NAMES', 'EXT_TYPES', 'CHORD_SCALES']) {
    assert.notEqual(JG[k], undefined, `missing ${k}`);
  }
});

test('getChordTones — interval formulas per quality', () => {
  same(JG.getChordTones(0, 'maj7'), [0, 4, 7, 11]); // C E G B
  same(JG.getChordTones(0, 'm7'),   [0, 3, 7, 10]); // C Eb G Bb
  same(JG.getChordTones(0, 'dom7'), [0, 4, 7, 10]); // C E G Bb
  same(JG.getChordTones(0, 'm7b5'), [0, 3, 6, 10]); // C Eb Gb Bb
});

test('getChordTones — transposition wraps mod 12', () => {
  same(JG.getChordTones(2, 'm7'),  [2, 5, 9, 0]);  // Dm7 = D F A C
  same(JG.getChordTones(7, 'dom7'),[7, 11, 2, 5]); // G7 = G B D F
  same(JG.getChordTones(11, 'maj7'),[11, 3, 6, 10]); // Bmaj7
});

test('DNAMES — maj7 seventh is Δ7, never the old d7 bug', () => {
  same(JG.DNAMES.maj7, ['R', '3', '5', 'Δ7']);
  for (const [q, names] of Object.entries(JG.DNAMES)) {
    assert.ok(!names.includes('d7'), `${q} still has the diminished-7 typo`);
    assert.equal(names.length, 4, `${q} should name 4 tones`);
  }
});

test('INT_NAMES — jazz tension labels, index 11 is Δ7', () => {
  same(JG.INT_NAMES,
    ['R', 'b9', '2', 'b3', '3', '4', '#11', '5', 'b13', '6', 'b7', 'Δ7']);
  assert.equal(JG.INT_NAMES.length, 12);
});

test('EXT_TYPES — every type well-formed', () => {
  for (const ext of JG.EXT_TYPES) {
    assert.ok(ext.id && ext.sym && ext.label, `${ext.id} missing field`);
    assert.equal(ext.iv.length, ext.dn.length, `${ext.id} iv/dn length mismatch`);
    assert.ok(ext.iv.every((n) => n >= 0 && n < 12), `${ext.id} interval out of range`);
  }
  const maj7 = JG.EXT_TYPES.find((x) => x.id === 'maj7');
  assert.equal(maj7.sym, '△7');
});

test('getRootlessTones — root replaced by the 9th', () => {
  // Cmaj9 rootless: 9(D=2), 3(E=4), 5(G=7), 7(B=11)
  same(JG.getRootlessTones(0, 'maj7'), [2, 4, 7, 11]);
  // Dm9 rootless: 9(E=4), b3(F=5), 5(A=9), b7(C=0)
  same(JG.getRootlessTones(2, 'm7'), [4, 5, 9, 0]);
});

test('nn — sharp keys vs flat keys', () => {
  assert.equal(JG.nn(1, 0), 'C#');   // C major spells black keys sharp
  assert.equal(JG.nn(1, 5), 'Db');   // F major spells them flat
  assert.equal(JG.nn(6, 7), 'F#');   // G major
  assert.equal(JG.nn(10, 3), 'Bb');  // Eb major
  assert.equal(JG.nn(0, 0), 'C');
});

test('nn — octave wrap and negatives', () => {
  assert.equal(JG.nn(12, 0), 'C');
  assert.equal(JG.nn(13, 0), 'C#');
  assert.equal(JG.nn(-1, 0), 'B');
  assert.equal(JG.nn(-12, 0), 'C');
});

test('getParentRoot — modes resolve to their parent major root', () => {
  // D Dorian (mPos 1) belongs to C major
  assert.equal(JG.getParentRoot(2, 'major', 1), 0);
  // G Mixolydian (mPos 4) belongs to C major
  assert.equal(JG.getParentRoot(7, 'major', 4), 0);
  // C Ionian (mPos 0) is its own parent
  assert.equal(JG.getParentRoot(0, 'major', 0), 0);
});

test('DIATONIC INVARIANT — every diatonic 7th chord stays inside the key', () => {
  // For all 12 keys, each of the 7 diatonic chords must use only key tones.
  for (let key = 0; key < 12; key++) {
    for (let deg = 0; deg < 7; deg++) {
      const root = (key + JG.MAJOR_SCALE[deg]) % 12;
      const q = JG.QTYPES[deg];
      const tones = JG.getChordTones(root, q);
      for (const t of tones) {
        const rel = ((t - key) % 12 + 12) % 12;
        assert.ok(MAJOR.has(rel),
          `key ${key} deg ${deg} (${q}) tone ${t} (rel ${rel}) is outside the key`);
      }
    }
  }
});

test('QTYPES / QSYMS / ROMAN — diatonic sequence of major', () => {
  same(JG.QTYPES, ['maj7', 'm7', 'm7', 'maj7', 'dom7', 'm7', 'm7b5']);
  // Roman numerals are cased by quality: upper for major/dominant, lower for
  // minor/diminished — the casing convention used throughout the app.
  same(JG.ROMAN, ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii']);
  assert.equal(JG.QSYMS.length, 7);
});

test('CHORD_SCALES — default mode per degree matches what the Guide teaches', () => {
  // Essentials sees only the first option; the modes stage names these.
  assert.equal(JG.CHORD_SCALES[0][0].name, 'Ionian');     // I
  assert.equal(JG.CHORD_SCALES[1][0].name, 'Dorian');     // ii
  assert.equal(JG.CHORD_SCALES[4][0].name, 'Mixolydian'); // V
  assert.equal(JG.CHORD_SCALES.length, 7);
});

test('CHORD_SCALES — every scale option is structurally valid', () => {
  for (let deg = 0; deg < JG.CHORD_SCALES.length; deg++) {
    for (const sc of JG.CHORD_SCALES[deg]) {
      assert.ok(sc.name && sc.abbr, `deg ${deg} scale missing name/abbr`);
      assert.ok(sc.iv.length >= 5 && sc.iv.length <= 8, `${sc.name} odd length`);
      assert.equal(sc.iv[0], 0, `${sc.name} must start on root`);
      // major/melmin derive a parent root; dim and wt are symmetric scales
      // with no single parent (getParentRoot falls back to the chord root).
      assert.ok(['major', 'melmin', 'dim', 'wt'].includes(sc.pType),
        `${sc.name} unknown parent type ${sc.pType}`);
      if (JG.PARENT_SC[sc.pType]) {
        assert.ok(sc.mPos >= 0 && sc.mPos < JG.PARENT_SC[sc.pType].length,
          `${sc.name} mPos ${sc.mPos} out of range for ${sc.pType}`);
      }
      // No duplicate scale degrees within a scale
      assert.equal(new Set(sc.iv).size, sc.iv.length, `${sc.name} has duplicate intervals`);
    }
  }
});

test('calcVoicing — shell voicings are reachable and pitch-correct', () => {
  const tones = JG.getChordTones(0, 'maj7'); // C E G B
  const toneSet = new Set(tones);
  let built = 0;
  for (const sh of JG.SHELLS) {
    const v = JG.calcVoicing(sh.s, sh.a, tones, 1);
    if (!v) continue;
    built++;
    assert.equal(v.frets.length, sh.s.length, `${sh.lbl} fret count`);
    assert.ok(v.mx - v.mn <= 5, `${sh.lbl} span ${v.mx - v.mn} exceeds a hand`);
    for (const f of v.frets) assert.ok(f >= 0 && f <= 20, `${sh.lbl} fret ${f} off-neck`);
    for (const m of v.midis) assert.ok(toneSet.has(((m % 12) + 12) % 12),
      `${sh.lbl} midi ${m} (pc ${m % 12}) not a chord tone`);
  }
  assert.ok(built >= 4, 'expected several shell shapes to build for Cmaj7');
});

test('getArpPos — all chord-tone positions, on-neck, valid tone indices', () => {
  const tones = JG.getChordTones(0, 'dom7'); // C E G Bb
  const pos = JG.getArpPos(tones);
  assert.ok(pos.length > 0);
  let sawOpen = false;
  for (const p of pos) {
    assert.ok(p.s >= 0 && p.s < 6, `string ${p.s} out of range`);
    assert.ok(p.f >= 0 && p.f <= 15, `fret ${p.f} out of range`);
    assert.ok(p.ti >= 0 && p.ti < tones.length, `tone index ${p.ti} out of range`);
    if (p.f === 0) sawOpen = true;
  }
  assert.ok(sawOpen, 'open-string chord tones should be included (the f=0 fix)');
});

test('getScalePos — returns only in-scale, non-chord, on-neck positions', () => {
  const root = 0;
  const sc = JG.CHORD_SCALES[0][0]; // C Ionian
  const tones = JG.getChordTones(0, 'maj7');
  const toneSet = new Set(tones);
  const scaleSet = new Set(sc.iv);
  const pos = JG.getScalePos(root, sc.iv, tones);
  assert.ok(pos.length > 0);
  for (const p of pos) {
    assert.ok(p.f >= 0 && p.f <= 15, `fret ${p.f} off range`);
    assert.ok(scaleSet.has(p.interval), `interval ${p.interval} not in scale`);
    const pc = (root + p.interval) % 12;
    assert.ok(!toneSet.has(pc), `pc ${pc} is a chord tone, should be drawn separately`);
  }
});

test('getScalePos — open strings appear for non-chord scale tones', () => {
  // C Ionian, Cmaj7 tones {0,4,7,11}. Open strings: E(4,chord) A(9) D(2) G(7,chord) B(11,chord) E(4,chord)
  // A (pc 9) and D (pc 2) are non-chord scale tones on open strings 1 and 2.
  const pos = JG.getScalePos(0, JG.CHORD_SCALES[0][0].iv, JG.getChordTones(0, 'maj7'));
  const opens = pos.filter((p) => p.f === 0);
  assert.ok(opens.length > 0, 'expected at least one open-string scale tone (the f=0 fix)');
});

test('calcFingering — assigns fingers 1..4, ascending by fret, capped at 4', () => {
  // calcFingering takes allF (per-string array, null = unplayed) and returns
  // a { stringIndex: finger } map. Lowest fret gets finger 1, each higher
  // fret group the next finger, capped at 4 (the pinky covers 4+).
  const allF = [3, null, 2, null, 1, null]; // three fretted strings, frets 3/2/1
  const map = JG.calcFingering(allF);
  assert.equal(map[4], 1, 'fret 1 -> finger 1');
  assert.equal(map[2], 2, 'fret 2 -> finger 2');
  assert.equal(map[0], 3, 'fret 3 -> finger 3');
  for (const f of Object.values(map)) assert.ok(f >= 1 && f <= 4, `finger ${f} out of range`);

  // More than four distinct fret groups must still cap at 4.
  const wide = JG.calcFingering([1, 2, 3, 4, 5, 6]);
  for (const f of Object.values(wide)) assert.ok(f >= 1 && f <= 4, `capped finger ${f}`);
  assert.equal(Math.max(...Object.values(wide)), 4, 'fingers cap at 4 (the pinky-group fix)');

  // Open (0) and muted (null) strings get no finger assignment.
  const withOpen = JG.calcFingering([0, null, 5, null, null, null]);
  assert.equal(withOpen[0], undefined, 'open string gets no finger');
  assert.equal(withOpen[2], 1, 'the only fretted string is finger 1');
});
