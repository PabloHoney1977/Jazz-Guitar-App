import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectPitch, chromaMatch, rmsOf, decimate } from '../js/pitch.js';
import { freqOf, midiOfFreq, OPEN_MIDI, chordPitchClasses, CHORDS } from '../js/theory.js';

// A plucked string is a fundamental plus decaying harmonics, so test with that
// rather than a pure sine — a detector that only handles sines is useless here.
function pluckish(hz, sr, n, noise = 0) {
  const b = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    b[i] = Math.sin(2 * Math.PI * hz * t)
      + 0.55 * Math.sin(2 * Math.PI * hz * 2 * t)
      + 0.30 * Math.sin(2 * Math.PI * hz * 3 * t)
      + 0.16 * Math.sin(2 * Math.PI * hz * 4 * t)
      + (noise ? (Math.random() * 2 - 1) * noise : 0);
  }
  return b;
}

test('finds every open string within a few cents', () => {
  const sr = 22050;
  for (const midi of OPEN_MIDI) {
    const hz = freqOf(midi);
    const res = detectPitch(pluckish(hz, sr, 1024), sr);
    assert.ok(res, `no pitch found for midi ${midi}`);
    const cents = Math.abs(midiOfFreq(res.hz) - midi) * 100;
    assert.ok(cents < 12, `midi ${midi}: off by ${cents.toFixed(1)} cents`);
  }
});

test('no octave errors across the playable range', () => {
  const sr = 22050;
  for (let midi = 40; midi <= 76; midi++) {
    const res = detectPitch(pluckish(freqOf(midi), sr, 1024), sr);
    assert.ok(res, `nothing detected at midi ${midi}`);
    const found = midiOfFreq(res.hz);
    assert.ok(Math.abs(found - midi) < 0.5,
      `midi ${midi} detected as ${found.toFixed(2)} — likely an octave error`);
  }
});

test('survives a noisy room', () => {
  const sr = 22050;
  const res = detectPitch(pluckish(freqOf(55), sr, 1024, 0.35), sr);
  assert.ok(res && Math.abs(midiOfFreq(res.hz) - 55) < 0.5);
});

test('silence and hiss report nothing rather than guessing', () => {
  const sr = 22050;
  assert.equal(detectPitch(new Float32Array(1024), sr), null);
  const hiss = new Float32Array(1024).map(() => (Math.random() * 2 - 1) * 0.5);
  const r = detectPitch(hiss, sr);
  assert.ok(r === null || r.clarity < 0.95, 'white noise should not read as a confident pitch');
});

test('chroma matching separates one chord from another', () => {
  const chroma = new Float32Array(12);
  chordPitchClasses(CHORDS.Em).forEach(pc => { chroma[pc] = 1; });
  assert.equal(chromaMatch(chroma, chordPitchClasses(CHORDS.Em)), 1);
  assert.ok(chromaMatch(chroma, chordPitchClasses(CHORDS.D)) < 0.7);
  assert.equal(chromaMatch(null, [1, 2]), 0);
});

test('helpers behave', () => {
  assert.ok(Math.abs(rmsOf(new Float32Array([1, -1, 1, -1])) - 1) < 1e-9);
  const out = new Float32Array(2);
  decimate(new Float32Array([1, 3, 5, 7]), out);
  assert.deepEqual([...out], [2, 6]);
});
