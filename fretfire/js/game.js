// The note highway. Everything here hangs off ONE clock: the AudioContext's.
// requestAnimationFrame stutters, setTimeout drifts, Date.now lies on throttled
// tabs — none of them can be trusted to say when a beat happened. The audio
// clock is sample-accurate, so it is the only source of time in this file.

import { LANE_COLORS, CHORDS, midiOf, chordMidis, chordLanes, chordPitchClasses } from './theory.js';
import { beatSecs, chartBeats } from './songs.js';
import { chromaMatch } from './pitch.js';
import { Fx } from './fx.js';

// Timing windows, in seconds either side of the note. These are wide by the
// standards of the genre. That is deliberate: this is somebody's first week on
// a guitar, and a window tuned for experts would read as "the game is broken".
export const JUDGE = [
  { name: 'PERFECT', win: 0.058, quality: 1.00, color: '#FFD93D' },
  { name: 'GREAT',   win: 0.115, quality: 0.75, color: '#6BCB77' },
  { name: 'GOOD',    win: 0.190, quality: 0.50, color: '#4D96FF' },
];
export const MISS_WINDOW = JUDGE[JUDGE.length - 1].win;

// Combo thresholds for the score multiplier.
export const MULT_STEPS = [0, 8, 20, 36];
export function multiplierFor(combo) {
  let m = 1;
  for (let i = 0; i < MULT_STEPS.length; i++) if (combo >= MULT_STEPS[i]) m = i + 1;
  return m;
}

export function judgeFor(delta, extraTolerance = 0) {
  const d = Math.abs(delta);
  for (let i = 0; i < JUDGE.length; i++) if (d <= JUDGE[i].win + extraTolerance) return i;
  return -1;
}

// Accuracy -> stars. 1 star is genuinely easy to get; 5 is not.
export const STAR_THRESHOLDS = [0.35, 0.55, 0.70, 0.86, 0.95];
export function starsFor(accuracy) {
  let s = 0;
  for (const t of STAR_THRESHOLDS) if (accuracy >= t) s++;
  return s;
}

// A chart in beats becomes a chart in seconds. Practice speed is applied here
// and nowhere else, so the rest of the engine never has to think about it.
export function compileChart(song, rate = 1) {
  const bs = beatSecs(song.bpm, rate);
  return song.notes.map((ev, i) => {
    if (ev.type === 'chord') {
      const shape = CHORDS[ev.name];
      return {
        id: i, type: 'chord', name: ev.name, shape,
        t: ev.b * bs, hold: (ev.hold || 1) * bs,
        lanes: chordLanes(shape), frets: shape.frets,
        midis: chordMidis(shape), pcs: chordPitchClasses(shape),
        judged: false, result: -1,
      };
    }
    return {
      id: i, type: 'note',
      t: ev.b * bs, hold: (ev.hold || 1) * bs,
      lanes: [ev.s], frets: [ev.f], midis: [midiOf(ev.s, ev.f)],
      judged: false, result: -1,
    };
  });
}

const LOOKAHEAD_SEC = 1.75;   // how far ahead the highway shows, in real time
const LEAD_IN_BEATS = 4;      // count-in

export class Game {
  constructor(canvas, audio, listener) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.audio = audio;
    this.listener = listener;
    this.fx = new Fx();
    this.onEnd = null;
    this.onUpdate = null;      // fired each frame so the DOM HUD can follow
    this.state = 'idle';       // idle | countdown | playing | paused | done
    this.laneGlow = new Array(6).fill(0);
    this.laneHeld = new Array(6).fill(false);
    this.strumGlow = 0;
    this.w = 0; this.h = 0; this.dpr = 1;
    this._raf = null;
    this._boundLoop = this._loop.bind(this);
  }

  load(song, opts = {}) {
    this.song = song;
    this.rate = opts.speed || 1;
    this.inputMode = opts.inputMode || 'tap';
    this.noFail = opts.noFail !== false;
    this.leftHanded = !!opts.leftHanded;
    this.metronome = !!opts.metronome;

    this.notes = compileChart(song, this.rate);
    this.beatSec = beatSecs(song.bpm, this.rate);
    this.totalBeats = chartBeats(song);
    this.endTime = this.notes.reduce((m, n) => Math.max(m, n.t + n.hold), 0) + 1.6;

    this.score = 0; this.combo = 0; this.maxCombo = 0;
    this.hits = 0; this.misses = 0; this.qualitySum = 0;
    this.counts = [0, 0, 0, 0];   // perfect, great, good, miss
    this.health = 65; this.fire = 0; this.fireActive = 0;
    this.failed = false;
    this.lastJudge = null;
    this.nextBeat = 0;
    this.troubleSpots = [];
    this.fx.clear();

    this.audio.prewarm(this.notes.flatMap(n => n.midis));
    return this;
  }

  start() {
    this.resize();
    this.t0 = this.audio.now() + LEAD_IN_BEATS * this.beatSec + 0.35;
    this.state = 'countdown';
    this.lastFrame = this.audio.now();
    this.nextBeat = -LEAD_IN_BEATS;
    if (!this._raf) this._raf = requestAnimationFrame(this._boundLoop);
  }

  pause() {
    if (this.state !== 'playing' && this.state !== 'countdown') return;
    this.pausedAt = this.audio.now();
    this.state = 'paused';
  }

  resume() {
    if (this.state !== 'paused') return;
    // Shift the whole timeline by however long we sat in the menu, and rewind a
    // beat so the player gets a moment to re-orient instead of being ambushed.
    this.t0 += this.audio.now() - this.pausedAt + this.beatSec;
    this.state = this.songTime() < 0 ? 'countdown' : 'playing';
  }

  stop() {
    this.state = 'idle';
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
  }

  songTime() { return this.audio.now() - this.t0; }

  // ── input ─────────────────────────────────────────────────────
  // A lane press in tap mode. Melody notes live in exactly one lane, so the
  // lane IS the answer — this is how the game teaches which string is which.
  pressLane(lane) {
    if (this.state !== 'playing') return;
    this.laneHeld[lane] = true;
    this.laneGlow[lane] = 1;
    const now = this.songTime();
    const note = this._findHittable(now, n => n.lanes.includes(lane));
    if (note) this._resolve(note, now, lane);
    else this._stray(now, lane);
  }

  releaseLane(lane) { this.laneHeld[lane] = false; }

  // A strum: one motion across several strings. Used for chord charts, and by
  // Guitar Mode when the mic hears an attack it cannot pitch.
  strum() {
    if (this.state !== 'playing') return;
    this.strumGlow = 1;
    const now = this.songTime();
    const note = this._findHittable(now, n => n.type === 'chord');
    if (note) this._resolve(note, now, note.lanes[Math.floor(note.lanes.length / 2)]);
    else this._stray(now, null);
  }

  // Guitar Mode. `reading` is one poll from the Listener.
  feedMic(reading) {
    if (this.state !== 'playing' || !reading) return;
    const now = this.songTime();

    // A confident pitch that matches a note that is due: that is a hit, and we
    // know exactly which one, so this is stricter AND fairer than a strum.
    if (reading.midi != null && reading.confidence > 0.72) {
      const note = this._findHittable(now, n =>
        n.type === 'note' && Math.abs(n.midis[0] - reading.midi) < 0.62, 0.045);
      if (note && !note.judged) {
        this._resolve(note, reading.time, note.lanes[0]);
        return;
      }
    }
    if (reading.onset) {
      const chord = this._findHittable(now, n => n.type === 'chord', 0.045);
      if (chord) {
        const match = reading.chroma ? chromaMatch(reading.chroma, chord.pcs) : 1;
        this._resolve(chord, reading.time, chord.lanes[Math.floor(chord.lanes.length / 2)], match);
      }
    }
  }

  _findHittable(now, pred, extra = 0) {
    let best = null, bestD = Infinity;
    for (const n of this.notes) {
      if (n.judged) continue;
      if (n.t - now > MISS_WINDOW + extra) break;   // chart is time-sorted
      const d = Math.abs(n.t - now);
      if (d > MISS_WINDOW + extra) continue;
      if (!pred(n)) continue;
      if (d < bestD) { best = n; bestD = d; }
    }
    return best;
  }

  // Hitting nothing. We only punish it when the player is clearly flailing at a
  // note they can see — otherwise a nervous extra strum costs them nothing.
  _stray(now, lane) {
    this.audio.thunk();
    const nearby = this.notes.some(n => !n.judged && Math.abs(n.t - now) < 0.34);
    if (nearby && this.combo > 0) {
      this.combo = 0;
      this.fx.text(this.w / 2, this.hitY - 96, 'oops', '#ff8fa3', 20);
    }
  }

  _resolve(note, atTime, lane, chordMatch = 1) {
    const delta = atTime - note.t;
    const extra = this.inputMode === 'guitar' ? 0.03 : 0;
    let j = judgeFor(delta, extra);
    if (j < 0) return;
    // Right time, wrong notes: still a hit, downgraded, with a nudge. Never a
    // miss — a muted string is a technique problem, not a rhythm problem.
    let mutedHint = false;
    if (note.type === 'chord' && chordMatch < 0.34 && this.inputMode === 'guitar') {
      j = Math.min(JUDGE.length - 1, j + 1);
      mutedHint = true;
    }

    note.judged = true; note.result = j;
    const spec = JUDGE[j];
    this.counts[j]++;
    this.hits++;
    this.qualitySum += spec.quality;
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.health = Math.min(100, this.health + (j === 0 ? 4 : 2.5));

    const mult = multiplierFor(this.combo) * (this.fireActive > 0 ? 2 : 1);
    this.score += Math.round(100 * spec.quality * mult);
    if (j === 0) this.fire = Math.min(1, this.fire + 0.055);

    // Play what the player just played. This is the whole illusion: in tap mode
    // they hear a guitar because of this line.
    if (note.type === 'chord') this.audio.strum(note.midis, 0, 0.8 + 0.2 * spec.quality);
    else this.audio.pluck(note.midis[0], 0, 0.85);

    this.lastJudge = { name: spec.name, color: spec.color, at: this.audio.now(), mutedHint };
    const [x, y] = [this.laneX(lane, 1), this.hitY];
    this.fx.hit(x, y, spec.color, j === 0 ? 1.25 : j === 1 ? 0.9 : 0.6);
    this.fx.text(x, y - 54, spec.name, spec.color, j === 0 ? 27 : 22);
    if (mutedHint) this.fx.text(this.w / 2, this.hitY - 128, 'check your fingers', '#ffd9a0', 17);
    if (this.combo > 0 && this.combo % 10 === 0) {
      this.fx.text(this.w / 2, this.hitY - 168, `${this.combo} STREAK!`, '#FFD93D', 30);
      this.fx.screenFlash('#FFD93D', 0.13);
      this.audio.blip(1320, 0, 0.1, 'triangle', 0.07);
    }
  }

  _miss(note) {
    note.judged = true; note.result = -1;
    this.counts[3]++;
    this.misses++;
    this.combo = 0;
    this.health -= 9;
    this.troubleSpots.push(note.t);
    this.audio.thunk();
    const x = this.laneX(note.lanes[Math.floor(note.lanes.length / 2)], 1);
    this.fx.text(x, this.hitY - 46, 'MISS', '#ff5c7a', 20);
    this.fx.addShake(3);
    if (this.health <= 0 && !this.noFail) { this.failed = true; this._finish(); }
  }

  activateFire() {
    if (this.fire < 1 || this.fireActive > 0) return;
    this.fire = 0;
    this.fireActive = 8;
    this.fx.screenFlash('#ff8a3d', 0.45);
    this.audio.drum('crash', 0, 0.7);
  }

  // ── loop ──────────────────────────────────────────────────────
  _loop() {
    this._raf = requestAnimationFrame(this._boundLoop);
    const now = this.audio.now();
    const dt = Math.min(0.05, now - this.lastFrame);
    this.lastFrame = now;
    if (this.state === 'paused' || this.state === 'idle') { this.draw(); return; }
    this.update(dt);
    this.draw();
  }

  update(dt) {
    const now = this.songTime();

    if (this.state === 'countdown' && now >= -0.02) this.state = 'playing';

    // Backing band, scheduled a little ahead of the audio clock so the browser
    // has slack. Never scheduled from the render loop's own timing.
    while (this.nextBeat * this.beatSec < now + 0.3) {
      this._scheduleBeat(this.nextBeat, this.t0 + this.nextBeat * this.beatSec);
      this.nextBeat++;
    }

    if (this.state === 'playing') {
      for (const n of this.notes) {
        if (!n.judged && now - n.t > MISS_WINDOW) this._miss(n);
      }
      if (this.inputMode === 'guitar' && this.listener && this.listener.running) {
        const r = this.listener.poll(this.audio.now());
        if (r) this.feedMic({ ...r, time: r.time - this.t0 });
      }
      if (this.fireActive > 0) this.fireActive = Math.max(0, this.fireActive - dt);
      if (now > this.endTime) this._finish();
    }

    for (let i = 0; i < 6; i++) this.laneGlow[i] *= Math.pow(0.002, dt);
    this.strumGlow *= Math.pow(0.002, dt);
    this.fx.update(dt);
    if (this.onUpdate) this.onUpdate(this.hud());
  }

  _scheduleBeat(beat, when) {
    if (when < this.audio.now() - 0.05) return;
    const b = this.song.beatsPerBar || 4;
    const inBar = ((beat % b) + b) % b;

    if (beat < 0) {            // count-in clicks
      this.audio.click(when, inBar === 0);
      return;
    }
    if (this.metronome) this.audio.click(when, inBar === 0);

    const style = (this.song.band && this.song.band.drums) || 'none';
    if (style === 'none') return;
    const loud = this.fireActive > 0 ? 1.15 : 1;
    if (style === 'soft') {
      if (inBar === 0 || inBar === 2) this.audio.drum('kick', when, 0.6 * loud);
      this.audio.drum('hat', when, 0.5 * loud);
    } else if (style === 'folk') {
      if (inBar === 0 || inBar === 2) this.audio.drum('kick', when, 0.75 * loud);
      if (inBar === 1 || inBar === 3) this.audio.drum('snare', when, 0.6 * loud);
      this.audio.drum('hat', when, 0.55 * loud);
      this.audio.drum('hat', when + this.beatSec / 2, 0.32 * loud);
    } else if (style === 'rock') {
      if (inBar === 0 || inBar === 2) this.audio.drum('kick', when, 0.95 * loud);
      if (inBar === 1 || inBar === 3) this.audio.drum('snare', when, 0.8 * loud);
      this.audio.drum('hat', when, 0.6 * loud);
      this.audio.drum('hat', when + this.beatSec / 2, 0.4 * loud);
    }

    // Bass follows the chart's own chords, so it can never disagree with what
    // the player is being asked to play.
    if (this.song.band && this.song.band.bass && (inBar === 0 || inBar === 2)) {
      const t = beat * this.beatSec;
      let cur = null;
      for (const n of this.notes) { if (n.type === 'chord' && n.t <= t + 0.001) cur = n; else if (n.t > t) break; }
      if (cur) {
        const root = Math.min(...cur.midis);
        this.audio.bass(root - 12 < 28 ? root : root - 12, when, this.beatSec * 1.6, 0.85);
      }
    }
  }

  _finish() {
    if (this.state === 'done') return;
    this.state = 'done';
    const total = this.notes.length;
    const accuracy = total ? this.qualitySum / total : 0;
    const fullCombo = this.misses === 0 && this.hits === total;
    const results = {
      song: this.song, score: this.score, accuracy,
      maxCombo: this.maxCombo, notesHit: this.hits, total,
      counts: this.counts.slice(), fullCombo, failed: this.failed,
      stars: this.failed ? 0 : starsFor(accuracy),
      speed: this.rate, inputMode: this.inputMode,
      trouble: this._troubleBar(),
    };
    setTimeout(() => { if (this.onEnd) this.onEnd(results); }, this.failed ? 300 : 700);
  }

  // Which bar of the song hurt most? The results screen offers to drill it.
  _troubleBar() {
    if (this.troubleSpots.length < 3) return null;
    const barSec = this.beatSec * (this.song.beatsPerBar || 4);
    const tally = new Map();
    this.troubleSpots.forEach(t => {
      const bar = Math.floor(t / barSec);
      tally.set(bar, (tally.get(bar) || 0) + 1);
    });
    let bar = null, n = 0;
    tally.forEach((v, k) => { if (v > n) { n = v; bar = k; } });
    return n >= 2 ? { bar, misses: n } : null;
  }

  hud() {
    return {
      score: this.score, combo: this.combo, mult: multiplierFor(this.combo) * (this.fireActive > 0 ? 2 : 1),
      health: this.health, fire: this.fire, fireActive: this.fireActive,
      accuracy: this.hits + this.misses ? this.qualitySum / (this.hits + this.misses) : 1,
      progress: Math.max(0, Math.min(1, this.songTime() / Math.max(0.001, this.endTime))),
      state: this.state,
      countIn: this.songTime() < 0 ? Math.ceil(-this.songTime() / this.beatSec) : 0,
    };
  }

  // ── layout ────────────────────────────────────────────────────
  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2.5, window.devicePixelRatio || 1);
    this.w = Math.max(320, r.width);
    this.h = Math.max(360, r.height);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.topY = this.h * 0.06;
    this.hitY = this.h * 0.80;
    this.pxPerSec = (this.hitY - this.topY) / LOOKAHEAD_SEC;
  }

  // Depth 0 = far away at the top, 1 = at the hit line. Lanes converge toward
  // the horizon, which is the entire reason the highway reads as 3D.
  laneW(p) { return (this.w * 0.145) * (0.34 + 0.66 * p); }
  laneX(lane, p) {
    const l = this.leftHanded ? 5 - lane : lane;
    return this.w / 2 + (l - 2.5) * this.laneW(p);
  }
  depthAt(y) { return Math.max(0, Math.min(1.12, (y - this.topY) / (this.hitY - this.topY))); }

  // ── drawing ───────────────────────────────────────────────────
  draw() {
    const c = this.ctx;
    const [sx, sy] = this.fx.shakeOffset();
    c.save();
    c.clearRect(0, 0, this.w, this.h);
    c.translate(sx, sy);

    this._drawBackdrop(c);
    this._drawBeatLines(c);
    this._drawLanes(c);
    this._drawNotes(c);
    this._drawHitLine(c);
    this.fx.draw(c);
    c.restore();
    this.fx.drawFlash(c, this.w, this.h);
    if (this.state === 'countdown') this._drawCountdown(c);
    if (this.state === 'paused') this._drawPaused(c);
  }

  _drawBackdrop(c) {
    const g = c.createLinearGradient(0, 0, 0, this.h);
    g.addColorStop(0, '#0a0618');
    g.addColorStop(0.55, '#140a2b');
    g.addColorStop(1, this.fireActive > 0 ? '#3a1408' : '#1b0e33');
    c.fillStyle = g;
    c.fillRect(0, 0, this.w, this.h);

    // Neck edges
    c.beginPath();
    c.moveTo(this.laneX(0, 0) - this.laneW(0) / 2, this.topY);
    c.lineTo(this.laneX(5, 0) + this.laneW(0) / 2, this.topY);
    c.lineTo(this.laneX(5, 1) + this.laneW(1) / 2, this.h);
    c.lineTo(this.laneX(0, 1) - this.laneW(1) / 2, this.h);
    c.closePath();
    const ng = c.createLinearGradient(0, this.topY, 0, this.h);
    ng.addColorStop(0, 'rgba(30,18,58,0.55)');
    ng.addColorStop(1, 'rgba(12,7,26,0.92)');
    c.fillStyle = ng; c.fill();
  }

  _drawBeatLines(c) {
    const now = this.songTime();
    const bpb = this.song.beatsPerBar || 4;
    const first = Math.floor(now / this.beatSec) - 1;
    for (let b = first; b < first + 14; b++) {
      const t = b * this.beatSec;
      const y = this.hitY - (t - now) * this.pxPerSec;
      if (y < this.topY - 20 || y > this.h) continue;
      const p = this.depthAt(y);
      const bar = ((b % bpb) + bpb) % bpb === 0;
      c.strokeStyle = bar ? `rgba(180,150,255,${0.30 * p + 0.05})` : `rgba(140,120,200,${0.13 * p + 0.02})`;
      c.lineWidth = bar ? 2.5 : 1;
      c.beginPath();
      c.moveTo(this.laneX(0, p) - this.laneW(p) / 2, y);
      c.lineTo(this.laneX(5, p) + this.laneW(p) / 2, y);
      c.stroke();
    }
  }

  _drawLanes(c) {
    for (let i = 0; i < 6; i++) {
      const col = LANE_COLORS[this.leftHanded ? 5 - i : i];
      // The string itself, running to the horizon.
      c.beginPath();
      c.moveTo(this.laneX(i, 0), this.topY);
      c.lineTo(this.laneX(i, 1), this.hitY);
      c.strokeStyle = `rgba(255,255,255,${0.05 + i * 0.012})`;
      c.lineWidth = (6 - i) * 0.42 + 0.6;
      c.stroke();

      const glow = this.laneGlow[i];
      if (glow > 0.02) {
        c.save();
        c.globalAlpha = glow * 0.5;
        const gr = c.createLinearGradient(0, this.topY, 0, this.hitY);
        gr.addColorStop(0, 'transparent');
        gr.addColorStop(1, col);
        c.fillStyle = gr;
        c.beginPath();
        c.moveTo(this.laneX(i, 0) - this.laneW(0) / 2, this.topY);
        c.lineTo(this.laneX(i, 0) + this.laneW(0) / 2, this.topY);
        c.lineTo(this.laneX(i, 1) + this.laneW(1) / 2, this.hitY);
        c.lineTo(this.laneX(i, 1) - this.laneW(1) / 2, this.hitY);
        c.closePath(); c.fill();
        c.restore();
      }
    }
  }

  _drawNotes(c) {
    const now = this.songTime();
    for (const n of this.notes) {
      if (n.judged && n.result >= 0) continue;
      const y = this.hitY - (n.t - now) * this.pxPerSec;
      if (y < this.topY - 60) continue;
      if (y > this.h + 40) continue;
      const p = this.depthAt(y);
      const faded = n.judged ? 0.25 : 1;
      if (n.type === 'chord') this._drawChord(c, n, y, p, faded);
      else this._drawNote(c, n, y, p, faded);
    }
  }

  _drawNote(c, n, y, p, alpha) {
    const lane = n.lanes[0];
    const col = LANE_COLORS[lane];
    const x = this.laneX(lane, p);
    const w = this.laneW(p) * 0.78;
    const h = Math.max(11, w * 0.46);

    // Sustain tail first, so the gem sits on top of it.
    if (n.hold > this.beatSec * 1.2) {
      const ty = this.hitY - (n.t + n.hold - now(this)) * this.pxPerSec;
      c.save(); c.globalAlpha = 0.22 * alpha; c.fillStyle = col;
      c.beginPath();
      c.moveTo(x - w * 0.16, y);
      c.lineTo(x + w * 0.16, y);
      c.lineTo(this.laneX(lane, this.depthAt(ty)) + w * 0.13, ty);
      c.lineTo(this.laneX(lane, this.depthAt(ty)) - w * 0.13, ty);
      c.closePath(); c.fill(); c.restore();
    }

    c.save();
    c.globalAlpha = alpha;
    c.shadowColor = col; c.shadowBlur = 16 * p + 4;
    roundRect(c, x - w / 2, y - h / 2, w, h, h * 0.42);
    const g = c.createLinearGradient(0, y - h / 2, 0, y + h / 2);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.42, col);
    g.addColorStop(1, shade(col, -0.4));
    c.fillStyle = g; c.fill();
    c.shadowBlur = 0;
    c.lineWidth = 1.6; c.strokeStyle = 'rgba(255,255,255,0.75)'; c.stroke();

    // The fret number is the instruction. Open strings say "O" — beginners read
    // a zero as "nothing to do" and freeze.
    const label = n.frets[0] === 0 ? 'O' : String(n.frets[0]);
    c.fillStyle = '#160b25';
    c.font = `900 ${Math.max(9, h * 0.68)}px system-ui, -apple-system, sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(label, x, y + h * 0.03);
    c.restore();
  }

  _drawChord(c, n, y, p, alpha) {
    const lanes = n.lanes;
    const x1 = this.laneX(lanes[0], p), x2 = this.laneX(lanes[lanes.length - 1], p);
    const w = this.laneW(p);
    const left = x1 - w * 0.42, right = x2 + w * 0.42;
    const h = Math.max(15, w * 0.56);

    c.save();
    c.globalAlpha = alpha;
    c.shadowColor = '#ff9f45'; c.shadowBlur = 18 * p + 5;
    roundRect(c, left, y - h / 2, right - left, h, h * 0.44);
    const g = c.createLinearGradient(left, 0, right, 0);
    g.addColorStop(0, '#ffd66b');
    g.addColorStop(0.5, '#ff9f45');
    g.addColorStop(1, '#ff6b8a');
    c.fillStyle = g; c.fill();
    c.shadowBlur = 0;
    c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,0.85)'; c.stroke();

    c.fillStyle = '#2a0f1a';
    c.font = `900 ${Math.max(11, h * 0.62)}px system-ui, -apple-system, sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(n.name, (left + right) / 2, y + h * 0.04);
    c.restore();
  }

  _drawHitLine(c) {
    const c0 = this.laneX(0, 1) - this.laneW(1) / 2;
    const c1 = this.laneX(5, 1) + this.laneW(1) / 2;
    c.save();
    c.strokeStyle = 'rgba(255,255,255,0.9)';
    c.lineWidth = 3;
    c.shadowColor = '#fff'; c.shadowBlur = 14;
    c.beginPath(); c.moveTo(c0, this.hitY); c.lineTo(c1, this.hitY); c.stroke();
    c.shadowBlur = 0;

    for (let i = 0; i < 6; i++) {
      const x = this.laneX(i, 1);
      const col = LANE_COLORS[this.leftHanded ? 5 - i : i];
      const glow = this.laneGlow[i];
      const r = this.laneW(1) * 0.31 * (1 + glow * 0.22);
      c.beginPath(); c.arc(x, this.hitY, r, 0, Math.PI * 2);
      c.fillStyle = `rgba(0,0,0,0.55)`; c.fill();
      c.lineWidth = 3 + glow * 3;
      c.strokeStyle = glow > 0.05 ? '#ffffff' : col;
      c.shadowColor = col; c.shadowBlur = 10 + glow * 26;
      c.stroke();
      c.shadowBlur = 0;
    }
    c.restore();
  }

  _drawCountdown(c) {
    const beatsLeft = Math.ceil(-this.songTime() / this.beatSec);
    const label = beatsLeft > 0 ? String(Math.min(4, beatsLeft)) : 'GO';
    c.save();
    c.globalAlpha = 0.92;
    c.fillStyle = '#fff';
    c.font = '900 84px system-ui, -apple-system, sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.shadowColor = '#a06bff'; c.shadowBlur = 30;
    c.fillText(label, this.w / 2, this.h * 0.42);
    c.font = '700 17px system-ui, -apple-system, sans-serif';
    c.shadowBlur = 0; c.fillStyle = 'rgba(255,255,255,0.75)';
    c.fillText(this.song.title, this.w / 2, this.h * 0.42 + 66);
    c.restore();
  }

  _drawPaused(c) {
    c.save();
    c.fillStyle = 'rgba(8,4,20,0.72)';
    c.fillRect(0, 0, this.w, this.h);
    c.fillStyle = '#fff';
    c.font = '900 40px system-ui, -apple-system, sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('PAUSED', this.w / 2, this.h / 2);
    c.restore();
  }
}

// `now(this)` inside _drawNote — kept as a helper so the sustain tail reads
// clearly rather than threading the time through three more arguments.
function now(game) { return game.songTime(); }

function roundRect(c, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + rr, y);
  c.arcTo(x + w, y, x + w, y + h, rr);
  c.arcTo(x + w, y + h, x, y + h, rr);
  c.arcTo(x, y + h, x, y, rr);
  c.arcTo(x, y, x + w, y, rr);
  c.closePath();
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + 255 * amt)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}
