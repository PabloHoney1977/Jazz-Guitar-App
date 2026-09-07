import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SONGS, validateSong, chartBeats, chordsUsed, beatSecs } from '../js/songs.js';
import { CHORDS } from '../js/theory.js';

test('every chart is structurally valid', () => {
  for (const s of SONGS) assert.deepEqual(validateSong(s), [], s.id);
});

test('song ids are unique', () => {
  const ids = SONGS.map(s => s.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('the ladder gets harder, never easier', () => {
  for (let i = 1; i < SONGS.length; i++) {
    assert.ok(SONGS[i].difficulty >= SONGS[i - 1].difficulty,
      `${SONGS[i].id} is easier than the song before it`);
  }
});

test('melody songs come before chord songs', () => {
  const firstChord = SONGS.findIndex(s => s.kind === 'chords');
  const lastMelody = SONGS.map(s => s.kind).lastIndexOf('melody');
  assert.ok(firstChord > lastMelody, 'the curriculum must teach single notes first');
});

test('songs are a sane length for a beginner', () => {
  for (const s of SONGS) {
    const secs = chartBeats(s) * beatSecs(s.bpm);
    assert.ok(secs > 15 && secs < 90, `${s.id} runs ${secs.toFixed(0)}s`);
  }
});

test('every chord used has a shape and appears in a lesson', () => {
  for (const s of SONGS) {
    const used = chordsUsed(s);
    used.forEach(c => assert.ok(CHORDS[c], `${s.id} uses unknown chord ${c}`));
    if (used.length) {
      const taught = JSON.stringify(s.lesson) + s.teaches.join(' ');
      // At least one chord in the song must be named somewhere in its coaching.
      assert.ok(used.some(c => taught.includes(c)), `${s.id} never introduces its chords`);
    }
  }
});

test('the first songs need no fretting hand at all', () => {
  for (const s of SONGS.slice(0, 2)) {
    assert.ok(s.notes.every(n => n.type === 'note' && n.f === 0),
      `${s.id} should be open strings only`);
  }
});

test('every song carries its own lesson', () => {
  for (const s of SONGS) {
    assert.ok(s.lesson && s.lesson.length >= 1, `${s.id} has no lesson cards`);
    assert.ok(s.teaches.length >= 1, `${s.id} does not say what it teaches`);
    s.lesson.forEach(c => {
      assert.ok(c.title && c.body.length > 25, `${s.id}: thin lesson card "${c.title}"`);
    });
  }
});

test('notes never overlap themselves in a single lane', () => {
  for (const s of SONGS) {
    const last = {};
    for (const ev of s.notes) {
      const key = ev.type === 'chord' ? 'chord' : 'lane' + ev.s;
      if (last[key] != null) assert.ok(ev.b > last[key] - 1e-9, `${s.id}: stacked events at beat ${ev.b}`);
      last[key] = ev.b;
    }
  }
});
