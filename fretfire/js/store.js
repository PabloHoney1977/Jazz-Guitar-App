// Everything the player earns, kept in localStorage. No account, no server,
// no network. If storage is unavailable (private windows, locked-down browsers)
// the game still runs — it just forgets, which is better than refusing to start.

import { SONGS } from './songs.js';

const KEY = 'fretfire-v1';

const DEFAULTS = {
  xp: 0,
  stars: {},          // songId -> 0..5
  best: {},           // songId -> { score, accuracy, combo, stars }
  streak: 0,
  lastPlayed: null,   // 'YYYY-MM-DD'
  totalNotes: 0,
  seenIntro: false,
  settings: {
    volume: 0.85,
    inputMode: 'tap',   // 'tap' | 'guitar'
    speed: 1,           // 1 | 0.75 | 0.5
    noFail: true,       // beginners do not need to be thrown out of a song
    metronome: false,
    inputOffset: 55,    // ms — mic + audio latency compensation
    leftHanded: false,
  },
};

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysBetween(a, b) {
  const pa = a.split('-').map(Number), pb = b.split('-').map(Number);
  const da = Date.UTC(pa[0], pa[1] - 1, pa[2]), db = Date.UTC(pb[0], pb[1] - 1, pb[2]);
  return Math.round((db - da) / 86400000);
}

class Store {
  constructor() { this.data = this._load(); }

  _load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return structuredClone(DEFAULTS);
      const parsed = JSON.parse(raw);
      return {
        ...structuredClone(DEFAULTS), ...parsed,
        settings: { ...DEFAULTS.settings, ...(parsed.settings || {}) },
      };
    } catch (e) { return structuredClone(DEFAULTS); }
  }

  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* private mode */ }
  }

  get settings() { return this.data.settings; }
  set(key, value) { this.data.settings[key] = value; this.save(); }

  // ── progression ───────────────────────────────────────────────
  starsFor(id) { return this.data.stars[id] || 0; }
  bestFor(id) { return this.data.best[id] || null; }

  // A song opens up as soon as the one before it has been passed at all. One
  // star is a low bar on purpose: the ladder should pull you forward, not
  // trap you on a song you have stopped enjoying.
  isUnlocked(id) {
    const i = SONGS.findIndex(s => s.id === id);
    if (i <= 0) return true;
    return this.starsFor(SONGS[i - 1].id) >= 1;
  }

  nextSong() {
    return SONGS.find(s => this.isUnlocked(s.id) && this.starsFor(s.id) < 5) ||
           SONGS.find(s => this.isUnlocked(s.id)) || SONGS[0];
  }

  totalStars() { return SONGS.reduce((t, s) => t + this.starsFor(s.id), 0); }

  // ── level ─────────────────────────────────────────────────────
  get level() { return levelForXp(this.data.xp); }
  get xp() { return this.data.xp; }

  // ── recording a run ───────────────────────────────────────────
  // Returns what changed, so the results screen can celebrate the right things.
  recordRun(songId, { score, accuracy, maxCombo, stars, notesHit, fullCombo }) {
    const prevStars = this.starsFor(songId);
    const prevBest = this.bestFor(songId);
    const improved = !prevBest || score > prevBest.score;

    if (stars > prevStars) this.data.stars[songId] = stars;
    if (improved) this.data.best[songId] = { score, accuracy, combo: maxCombo, stars, fullCombo };

    const xpGain = Math.round(score / 40) + stars * 25 + (fullCombo ? 60 : 0) + (stars > prevStars ? 40 : 0);
    const prevLevel = this.level;
    this.data.xp += xpGain;
    this.data.totalNotes += notesHit;

    const streakInfo = this.touchStreak();
    const unlockedNext = this._unlockedByThis(songId, prevStars, stars);

    this.save();
    return {
      xpGain, newBest: improved, prevStars, starsGained: Math.max(0, stars - prevStars),
      leveledUp: this.level > prevLevel, level: this.level,
      unlockedNext, ...streakInfo,
    };
  }

  _unlockedByThis(songId, prevStars, stars) {
    if (prevStars >= 1 || stars < 1) return null;
    const i = SONGS.findIndex(s => s.id === songId);
    return (i >= 0 && SONGS[i + 1]) ? SONGS[i + 1] : null;
  }

  // Daily streak. A missed day resets it — but playing twice in one day never
  // inflates it, and the clock is local, so travelling does not punish you.
  touchStreak() {
    const t = today();
    const last = this.data.lastPlayed;
    let streakUp = false;
    if (!last) { this.data.streak = 1; streakUp = true; }
    else {
      const gap = daysBetween(last, t);
      if (gap === 0) { /* already counted today */ }
      else if (gap === 1) { this.data.streak += 1; streakUp = true; }
      else if (gap > 1) { this.data.streak = 1; streakUp = true; }
    }
    this.data.lastPlayed = t;
    this.save();
    return { streak: this.data.streak, streakUp };
  }

  // Is the run-of-days still alive right now (as opposed to a stale number
  // saved weeks ago)? The header must never claim a streak that has lapsed.
  liveStreak() {
    if (!this.data.lastPlayed || !this.data.streak) return 0;
    const gap = daysBetween(this.data.lastPlayed, today());
    return gap <= 1 ? this.data.streak : 0;
  }

  reset() { this.data = structuredClone(DEFAULTS); this.save(); }
}

// Levels get further apart as you climb, but never brutally so — the curve is
// there to mark progress, not to gate anything.
export function xpForLevel(level) { return Math.round(180 * Math.pow(level - 1, 1.45)); }
export function levelForXp(xp) {
  let l = 1;
  while (xp >= xpForLevel(l + 1) && l < 99) l++;
  return l;
}
export function levelProgress(xp) {
  const l = levelForXp(xp);
  const cur = xpForLevel(l), next = xpForLevel(l + 1);
  return { level: l, into: xp - cur, need: next - cur, pct: (xp - cur) / Math.max(1, next - cur) };
}

export const store = new Store();
export const _internals = { today, daysBetween, DEFAULTS };
