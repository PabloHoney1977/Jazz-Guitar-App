import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OPEN_MIDI, CHORDS, STRING_NAMES, midiOf, freqOf, nameOf, fullNameOf, chordMidis, chordLanes, chordPitchClasses } from '../js/theory.js';

test('standard tuning is standard', () => {
  assert.deepEqual(OPEN_MIDI, [40, 45, 50, 55, 59, 64]);
  assert.equal(fullNameOf(OPEN_MIDI[0]), 'E2');
  assert.equal(fullNameOf(OPEN_MIDI[5]), 'E4');
  assert.equal(STRING_NAMES.length, 6);
  // The two E strings are exactly two octaves apart.
  assert.equal(OPEN_MIDI[5] - OPEN_MIDI[0], 24);
});

test('A4 is 440 Hz and the octave doubles', () => {
  assert.ok(Math.abs(freqOf(69) - 440) < 1e-9);
  assert.ok(Math.abs(freqOf(81) - 880) < 1e-9);
  assert.equal(nameOf(60), 'C');
});

test('fret maths', () => {
  assert.equal(midiOf(5, 0), 64);
  assert.equal(midiOf(4, 1), 60);   // C4, the first note beginners fret
  assert.equal(midiOf(4, 3), 62);
  assert.equal(midiOf(5, 5), 69);   // A4
});

test('every chord shape is playable by a beginner', () => {
  for (const [name, sh] of Object.entries(CHORDS)) {
    assert.equal(sh.frets.length, 6, name + ' needs 6 string entries');
    assert.equal(sh.fingers.length, 6, name + ' needs 6 finger entries');
    const played = sh.frets.filter(f => f !== null);
    assert.ok(played.length >= 3, name + ' must sound at least 3 strings');
    const fretted = played.filter(f => f > 0);
    // Open position only: nothing past fret 4, and no barre (a barre would need
    // the same fret on 5+ strings, which is not a week-one shape).
    assert.ok(Math.max(0, ...fretted) <= 4, name + ' reaches past fret 4');
    const byFret = {};
    fretted.forEach(f => { byFret[f] = (byFret[f] || 0) + 1; });
    assert.ok(Object.values(byFret).every(c => c <= 3), name + ' looks like a barre chord');
    assert.ok(fretted.length <= 4, name + ' needs more than four fingers');
    assert.ok(sh.tip && sh.tip.length > 10, name + ' has no coaching tip');
  }
});

test('chord notes, lanes and pitch classes agree', () => {
  const em = CHORDS.Em;
  assert.deepEqual(chordMidis(em), [40, 47, 52, 55, 59, 64]);
  assert.deepEqual(chordLanes(em), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(chordPitchClasses(em).sort((a, b) => a - b), [4, 7, 11]); // E G B
  // A muted string is genuinely skipped, not silently played open.
  assert.deepEqual(chordLanes(CHORDS.D), [2, 3, 4, 5]);
  assert.deepEqual(chordPitchClasses(CHORDS.C).sort((a, b) => a - b), [0, 4, 7]); // C E G
});
