// Fretfire audio — 100% synthesized, zero asset files, zero network requests.
// A plucked string is a Karplus-Strong delay line: fill a short buffer with
// noise, then repeatedly average it with its own delayed copy. The averaging is
// a lowpass, so the high harmonics die first — which is exactly what a real
// string does. It costs nothing to ship and sounds like a guitar, not a beep.

import { freqOf } from './theory.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.plucks = new Map();   // midi -> AudioBuffer
    this.noise = null;
    this.ready = false;
    this.volume = 0.85;
    this.muted = false;
  }

  // Must be called from a user gesture (every browser requires it).
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return this.ready; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { return false; }

    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 22; comp.ratio.value = 4;
    comp.attack.value = 0.004; comp.release.value = 0.18;

    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(comp);
    comp.connect(this.ctx.destination);

    // Shared reverb-ish room. A short procedural impulse costs one buffer and
    // stops every note sounding like it was recorded inside a shoebox.
    this.room = this.ctx.createConvolver();
    this.room.buffer = this._makeRoomIR(1.1);
    this.roomSend = this.ctx.createGain();
    this.roomSend.gain.value = 0.16;
    this.roomSend.connect(this.room);
    this.room.connect(this.master);

    this.noise = this._makeNoise(2);
    this.ready = true;
    return true;
  }

  now() { return this.ctx ? this.ctx.currentTime : 0; }
  setVolume(v) { this.volume = clamp(v, 0, 1); if (this.master) this.master.gain.value = this.muted ? 0 : this.volume; }
  setMuted(m) { this.muted = !!m; if (this.master) this.master.gain.value = m ? 0 : this.volume; }

  _makeNoise(secs) {
    const n = Math.floor(this.ctx.sampleRate * secs);
    const b = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  _makeRoomIR(secs) {
    const sr = this.ctx.sampleRate, n = Math.floor(sr * secs);
    const b = this.ctx.createBuffer(2, n, sr);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < n; i++) {
        const t = i / n;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.6) * 0.6;
      }
    }
    return b;
  }

  // Karplus-Strong string, rendered once per pitch and cached.
  _pluckBuffer(midi) {
    const key = Math.round(midi);
    if (this.plucks.has(key)) return this.plucks.get(key);
    const sr = this.ctx.sampleRate;
    const freq = freqOf(key);
    const N = Math.max(2, Math.round(sr / freq));
    const len = Math.floor(sr * 3.0);
    const buf = this.ctx.createBuffer(1, len, sr);
    const y = buf.getChannelData(0);

    // Excitation: filtered noise burst. Low strings get a duller pick.
    const bright = clamp((key - 38) / 30, 0.15, 0.9);
    let last = 0;
    for (let i = 0; i < N; i++) {
      const white = Math.random() * 2 - 1;
      last = last + bright * (white - last);       // one-pole lowpass
      y[i] = last;
    }
    // Pick-position comb — kills the fundamental-only "rubber band" sound.
    const pick = Math.floor(N * 0.13);
    for (let i = N - 1; i >= pick; i--) y[i] -= y[i - pick] * 0.55;

    // The string itself. Longer strings ring longer.
    const decay = clamp(0.9985 - (key - 40) * 0.00035, 0.993, 0.9992);
    for (let i = N; i < len; i++) {
      y[i] = decay * 0.5 * (y[i - N] + y[i - N - 1]);
    }
    // Trim the tail so buffers don't end with a click.
    const fade = Math.floor(sr * 0.25);
    for (let i = 0; i < fade; i++) y[len - 1 - i] *= i / fade;

    this.plucks.set(key, buf);
    return buf;
  }

  // Warm the cache for a chart's notes so the first hit isn't a hiccup.
  prewarm(midis) {
    if (!this.ready) return;
    [...new Set(midis.map(Math.round))].slice(0, 40).forEach(m => this._pluckBuffer(m));
  }

  pluck(midi, when = 0, vel = 1, sustain = 2.2) {
    if (!this.ready) return;
    const t = when || this.now();
    const src = this.ctx.createBufferSource();
    src.buffer = this._pluckBuffer(midi);

    // Guitar body: a bump around 200Hz, a gentle cut where things get shrill.
    const body = this.ctx.createBiquadFilter();
    body.type = 'peaking'; body.frequency.value = 210; body.Q.value = 0.9; body.gain.value = 4;
    const air = this.ctx.createBiquadFilter();
    air.type = 'highshelf'; air.frequency.value = 3600; air.gain.value = -3 + vel * 4;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(clamp(0.34 * vel, 0.02, 0.8), t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0008, t + sustain);

    src.connect(body); body.connect(air); air.connect(g);
    g.connect(this.master); g.connect(this.roomSend);
    src.start(t); src.stop(t + sustain + 0.1);
  }

  // A strum is the same notes, a few milliseconds apart. That stagger is the
  // entire difference between "a guitar" and "a synth pad".
  strum(midis, when = 0, vel = 1, up = false) {
    if (!this.ready || !midis.length) return;
    const t = when || this.now();
    const order = up ? [...midis].reverse() : midis;
    const gap = up ? 0.016 : 0.022;
    order.forEach((m, i) => this.pluck(m, t + i * gap, vel * (1 - i * 0.03), 2.4));
  }

  // The sound of getting it wrong: a dead, muted string. Discouraging on
  // purpose, but short — it should sting for 200ms, not scold.
  thunk(when = 0) {
    if (!this.ready) return;
    const t = when || this.now();
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 180; f.Q.value = 1.4;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + 0.2);
  }

  drum(kind, when = 0, vel = 1) {
    if (!this.ready) return;
    const t = when || this.now();
    const g = this.ctx.createGain();
    g.connect(this.master);
    if (kind === 'kick') {
      const o = this.ctx.createOscillator();
      o.frequency.setValueAtTime(130, t);
      o.frequency.exponentialRampToValueAtTime(44, t + 0.09);
      g.gain.setValueAtTime(0.9 * vel, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
      o.connect(g); o.start(t); o.stop(t + 0.3);
    } else if (kind === 'snare') {
      const src = this.ctx.createBufferSource(); src.buffer = this.noise;
      const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 0.7;
      g.gain.setValueAtTime(0.42 * vel, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.17);
      src.connect(f); f.connect(g);
      g.connect(this.roomSend);
      src.start(t); src.stop(t + 0.2);
    } else if (kind === 'hat') {
      const src = this.ctx.createBufferSource(); src.buffer = this.noise;
      const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7500;
      g.gain.setValueAtTime(0.14 * vel, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.055);
      src.connect(f); f.connect(g);
      src.start(t); src.stop(t + 0.08);
    } else if (kind === 'crash') {
      const src = this.ctx.createBufferSource(); src.buffer = this.noise;
      const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 4200;
      g.gain.setValueAtTime(0.3 * vel, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
      src.connect(f); f.connect(g); g.connect(this.roomSend);
      src.start(t); src.stop(t + 1.5);
    }
  }

  bass(midi, when = 0, dur = 0.4, vel = 1) {
    if (!this.ready) return;
    const t = when || this.now();
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = freqOf(midi);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.setValueAtTime(1400, t);
    f.frequency.exponentialRampToValueAtTime(320, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3 * vel, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(f); f.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  click(when = 0, accent = false) {
    if (!this.ready) return;
    const t = when || this.now();
    const o = this.ctx.createOscillator();
    o.frequency.value = accent ? 1600 : 1050;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(accent ? 0.24 : 0.14, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.06);
  }

  // Small interface sounds. Cheap, and a menu without them feels broken.
  blip(freq = 880, when = 0, dur = 0.08, type = 'square', vol = 0.09) {
    if (!this.ready) return;
    const t = when || this.now();
    const o = this.ctx.createOscillator();
    o.type = type; o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  fanfare() {
    if (!this.ready) return;
    const t = this.now();
    [0, 4, 7, 12].forEach((s, i) => this.blip(freqOf(72 + s), t + i * 0.09, 0.3, 'triangle', 0.13));
  }
}

export const audio = new AudioEngine();
