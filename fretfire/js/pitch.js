// Guitar Mode — listen to a real guitar through the microphone.
//
// Two separate jobs, deliberately kept apart:
//   1. WHAT note was played  -> autocorrelation pitch detection (single notes)
//   2. WHEN a string was hit -> RMS onset detection (strums, where pitch is a mess)
//
// A strummed chord has six overlapping pitches and no single fundamental, so we
// never try to name it. We check the strum LANDED in time, and that the notes
// present were roughly the right ones (chroma match). Beginners already fight
// the instrument; the game must not also accuse them of being wrong.

import { midiOfFreq } from './theory.js';

const MIN_HZ = 70;      // below the low E (82 Hz), with room for flat tuning
const MAX_HZ = 720;     // above the 1st string at fret 12

export class Listener {
  constructor(audioEngine) {
    this.eng = audioEngine;
    this.stream = null;
    this.analyser = null;
    this.running = false;
    this.buf = null;
    this.freqBuf = null;
    this.down = null;         // decimated working buffer
    this.noiseFloor = 0.004;
    this.lastPoll = 0;
    this.prevRms = 0;
    this.lastOnset = -1;
    this.lastNote = null;
    this.lastNoteAt = -1;
    this.inputOffset = 0.055; // seconds; mic + detection latency, user-tunable
    this.error = null;
  }

  async start() {
    if (this.running) return true;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.error = 'This browser has no microphone access.';
      return false;
    }
    try {
      // Every one of these processors is designed to destroy a musical signal:
      // AGC pumps the volume, noise suppression eats sustained notes, echo
      // cancellation removes anything also coming out of the speakers.
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        video: false,
      });
    } catch (e) {
      this.error = e && e.name === 'NotAllowedError'
        ? 'Microphone permission was denied.'
        : 'Could not open the microphone.';
      return false;
    }
    const ctx = this.eng.ctx;
    const src = ctx.createMediaStreamSource(this.stream);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 60;   // room rumble, handling noise
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.1;
    src.connect(hp); hp.connect(this.analyser);
    this.buf = new Float32Array(this.analyser.fftSize);
    this.freqBuf = new Float32Array(this.analyser.frequencyBinCount);
    this.down = new Float32Array(this.analyser.fftSize / 2);
    this.running = true;
    this.error = null;
    return true;
  }

  stop() {
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    this.stream = null; this.analyser = null; this.running = false;
  }

  // Sample the room for a moment so a noisy kitchen doesn't read as playing.
  async calibrateNoise(ms = 900) {
    if (!this.running) return this.noiseFloor;
    const end = performance.now() + ms;
    let peak = 0;
    while (performance.now() < end) {
      this.analyser.getFloatTimeDomainData(this.buf);
      peak = Math.max(peak, rmsOf(this.buf));
      await new Promise(r => setTimeout(r, 30));
    }
    this.noiseFloor = Math.max(0.003, peak * 1.6);
    return this.noiseFloor;
  }

  // Called every animation frame; internally rate-limited. Returns null, or
  // { time, rms, midi, confidence, onset, chroma }.
  poll(nowSec) {
    if (!this.running) return null;
    if (nowSec - this.lastPoll < 0.022) return null;
    this.lastPoll = nowSec;

    this.analyser.getFloatTimeDomainData(this.buf);
    const rms = rmsOf(this.buf);
    const gate = Math.max(this.noiseFloor, 0.006);

    const rising = rms > gate * 1.9 && rms > this.prevRms * 1.55;
    const onset = rising && (nowSec - this.lastOnset) > 0.09;
    if (onset) this.lastOnset = nowSec;
    this.prevRms = rms * 0.6 + this.prevRms * 0.4;

    let midi = null, confidence = 0;
    if (rms > gate) {
      const sr2 = this.eng.ctx.sampleRate / 2;
      decimate(this.buf, this.down);
      const res = detectPitch(this.down, sr2);
      if (res) { midi = midiOfFreq(res.hz); confidence = res.clarity; }
    }

    return {
      time: nowSec - this.inputOffset,
      rms, midi, confidence, onset,
      chroma: onset ? this.chroma() : null,
    };
  }

  // Energy folded into 12 pitch classes — enough to ask "was that roughly an
  // E minor?" without pretending to be a chord recogniser.
  chroma() {
    if (!this.running) return null;
    this.analyser.getFloatFrequencyData(this.freqBuf);
    const sr = this.eng.ctx.sampleRate;
    const out = new Float32Array(12);
    for (let i = 2; i < this.freqBuf.length; i++) {
      const hz = (i * sr) / (this.analyser.fftSize);
      if (hz < 70 || hz > 2000) continue;
      const mag = Math.pow(10, this.freqBuf[i] / 20);
      const pc = ((Math.round(midiOfFreq(hz)) % 12) + 12) % 12;
      out[pc] += mag;
    }
    let max = 0; for (let i = 0; i < 12; i++) max = Math.max(max, out[i]);
    if (max > 0) for (let i = 0; i < 12; i++) out[i] /= max;
    return out;
  }
}

export function rmsOf(buf) {
  let s = 0;
  for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
  return Math.sqrt(s / buf.length);
}

// Halve the sample rate. Guitar fundamentals top out near 700 Hz, so this
// throws away nothing we need and makes the autocorrelation four times cheaper.
export function decimate(src, dst) {
  for (let i = 0; i < dst.length; i++) dst[i] = (src[i * 2] + src[i * 2 + 1]) * 0.5;
  return dst;
}

// Normalised autocorrelation. The classic failure of naive autocorrelation is
// the octave error: the peak at 2x the true period is often the tallest one. The
// fix is to take the FIRST peak that clears a fraction of the global maximum,
// not the maximum itself.
export function detectPitch(buf, sampleRate) {
  const n = buf.length;
  let mean = 0;
  for (let i = 0; i < n; i++) mean += buf[i];
  mean /= n;

  const minLag = Math.max(2, Math.floor(sampleRate / MAX_HZ));
  const maxLag = Math.min(n - 2, Math.floor(sampleRate / MIN_HZ));
  if (maxLag <= minLag) return null;

  const corr = new Float32Array(maxLag + 1);
  let best = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let num = 0, e1 = 0, e2 = 0;
    const lim = n - lag;
    for (let i = 0; i < lim; i++) {
      const a = buf[i] - mean, b = buf[i + lag] - mean;
      num += a * b; e1 += a * a; e2 += b * b;
    }
    const den = Math.sqrt(e1 * e2);
    corr[lag] = den > 0 ? num / den : 0;
    if (corr[lag] > best) best = corr[lag];
  }
  if (best < 0.5) return null;

  const thresh = best * 0.86;
  let peak = -1;
  for (let lag = minLag + 1; lag < maxLag; lag++) {
    if (corr[lag] > thresh && corr[lag] >= corr[lag - 1] && corr[lag] >= corr[lag + 1]) { peak = lag; break; }
  }
  if (peak < 0) return null;

  // Parabolic interpolation around the peak — turns a whole-sample lag into a
  // fractional one, which is the difference between "in tune" and "9 cents off".
  const y0 = corr[peak - 1], y1 = corr[peak], y2 = corr[peak + 1];
  const denom = (2 * (2 * y1 - y0 - y2));
  const shift = denom !== 0 ? (y2 - y0) / denom : 0;
  const period = peak + shift;
  const hz = sampleRate / period;
  if (hz < MIN_HZ || hz > MAX_HZ) return null;
  return { hz, clarity: y1 };
}

// How well a strum's chroma matches the notes a chord should contain.
// Returns 0..1. Lenient by design.
export function chromaMatch(chroma, pitchClasses) {
  if (!chroma || !pitchClasses.length) return 0;
  let hit = 0;
  for (const pc of pitchClasses) {
    // Accept energy in the neighbouring bins — cheap tolerance for a guitar
    // that is slightly out of tune, which describes most beginner guitars.
    const v = Math.max(chroma[pc], chroma[(pc + 11) % 12] * 0.6, chroma[(pc + 1) % 12] * 0.6);
    if (v > 0.35) hit++;
  }
  return hit / pitchClasses.length;
}
