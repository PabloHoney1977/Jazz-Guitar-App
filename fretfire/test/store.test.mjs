import { test } from 'node:test';
import assert from 'node:assert/strict';
import { xpForLevel, levelForXp, levelProgress, _internals } from '../js/store.js';

test('levels are ordered and reachable', () => {
  assert.equal(levelForXp(0), 1);
  for (let l = 2; l < 30; l++) {
    assert.ok(xpForLevel(l) > xpForLevel(l - 1), `level ${l} is not above ${l - 1}`);
    assert.equal(levelForXp(xpForLevel(l)), l);
    assert.equal(levelForXp(xpForLevel(l) - 1), l - 1);
  }
});

test('level 2 arrives fast enough to feel like a reward', () => {
  // One decent first run is worth roughly 100-200 XP.
  assert.ok(xpForLevel(2) <= 200, 'the first level-up must not take three sessions');
});

test('progress within a level stays inside 0..1', () => {
  for (const xp of [0, 50, 179, 180, 900, 5000]) {
    const p = levelProgress(xp);
    assert.ok(p.pct >= 0 && p.pct <= 1, `pct ${p.pct} at ${xp} xp`);
    assert.ok(p.into >= 0 && p.into <= p.need);
  }
});

test('day arithmetic survives month and year boundaries', () => {
  const { daysBetween } = _internals;
  assert.equal(daysBetween('2026-01-01', '2026-01-02'), 1);
  assert.equal(daysBetween('2026-01-31', '2026-02-01'), 1);
  assert.equal(daysBetween('2025-12-31', '2026-01-01'), 1);
  assert.equal(daysBetween('2026-02-28', '2026-03-01'), 1); // 2026 is not a leap year
  assert.equal(daysBetween('2026-03-05', '2026-03-05'), 0);
  assert.equal(daysBetween('2026-03-05', '2026-03-12'), 7);
});
