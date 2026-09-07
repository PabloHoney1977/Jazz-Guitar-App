import { test } from 'node:test';
import assert from 'node:assert/strict';
import { judgeFor, multiplierFor, starsFor, compileChart, JUDGE, MISS_WINDOW, STAR_THRESHOLDS } from '../js/game.js';
import { SONGS, songById } from '../js/songs.js';

test('timing windows nest and are beginner-generous', () => {
  assert.ok(JUDGE[0].win < JUDGE[1].win && JUDGE[1].win < JUDGE[2].win);
  assert.ok(MISS_WINDOW >= 0.15, 'a sub-150ms miss window is brutal for week one');
  assert.equal(judgeFor(0), 0);
  assert.equal(judgeFor(0.05), 0);
  assert.equal(judgeFor(-0.09), 1);
  assert.equal(judgeFor(0.17), 2);
  assert.equal(judgeFor(0.25), -1);
  // Guitar Mode's extra tolerance widens every window, never narrows one.
  assert.equal(judgeFor(0.2, 0.05), 2);
});

test('the multiplier climbs with the streak', () => {
  assert.equal(multiplierFor(0), 1);
  assert.equal(multiplierFor(7), 1);
  assert.equal(multiplierFor(8), 2);
  assert.equal(multiplierFor(20), 3);
  assert.equal(multiplierFor(36), 4);
  assert.equal(multiplierFor(500), 4);
});

test('stars track accuracy', () => {
  assert.equal(starsFor(0), 0);
  assert.equal(starsFor(0.34), 0);
  assert.equal(starsFor(0.35), 1);
  assert.equal(starsFor(0.71), 3);
  assert.equal(starsFor(1), 5);
  for (let i = 1; i < STAR_THRESHOLDS.length; i++) {
    assert.ok(STAR_THRESHOLDS[i] > STAR_THRESHOLDS[i - 1]);
  }
});

test('compiling a chart converts beats to seconds', () => {
  const song = songById('hot-cross-buns');   // 84 bpm
  const notes = compileChart(song, 1);
  assert.equal(notes.length, song.notes.length);
  assert.ok(Math.abs(notes[1].t - 60 / 84) < 1e-9, 'beat 1 lands one beat in');
  // Practice speed stretches time and nothing else.
  const half = compileChart(song, 0.5);
  assert.ok(Math.abs(half[1].t - notes[1].t * 2) < 1e-9);
  assert.deepEqual(half.map(n => n.midis), notes.map(n => n.midis));
});

test('compiled chords carry everything the engine and the mic need', () => {
  const notes = compileChart(songById('ember'), 1);
  const c = notes[0];
  assert.equal(c.type, 'chord');
  assert.equal(c.name, 'Em');
  assert.deepEqual(c.lanes, [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(c.midis, [40, 47, 52, 55, 59, 64]);
  assert.deepEqual([...c.pcs].sort((a, b) => a - b), [4, 7, 11]);
});

test('compiled charts stay sorted in time', () => {
  for (const s of SONGS) {
    const notes = compileChart(s, 1);
    for (let i = 1; i < notes.length; i++) {
      assert.ok(notes[i].t >= notes[i - 1].t, `${s.id} is out of order — _findHittable breaks early on sorted charts`);
    }
  }
});
