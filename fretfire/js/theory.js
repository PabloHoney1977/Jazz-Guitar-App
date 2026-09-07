// Fretfire — guitar facts. Deliberately tiny: this app teaches playing, not theory.
// String index 0 = LOW E (thickest, leftmost lane) ... 5 = HIGH E (thinnest).

export const OPEN_MIDI = [40, 45, 50, 55, 59, 64];        // E2 A2 D3 G3 B3 E4
export const STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'e'];
export const STRING_LABELS = ['6th (low E)', '5th (A)', '4th (D)', '3rd (G)', '2nd (B)', '1st (high E)'];
export const LANE_COLORS = ['#FF4D6D', '#FF9F45', '#FFD93D', '#6BCB77', '#4D96FF', '#C77DFF'];

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const midiOf = (str, fret) => OPEN_MIDI[str] + fret;
export const freqOf = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
export const midiOfFreq = (hz) => 69 + 12 * Math.log2(hz / 440);
export const nameOf = (midi) => NAMES[((Math.round(midi) % 12) + 12) % 12];
export const fullNameOf = (midi) => nameOf(midi) + (Math.floor(Math.round(midi) / 12) - 1);
export const pcOf = (midi) => ((Math.round(midi) % 12) + 12) % 12;

// How far (in semitones) `midi` sits from the nearest note of pitch class `pc`.
export function centsOffNearest(midi) {
  const r = Math.round(midi);
  return (midi - r) * 100;
}

// Beginner-first chord library. `frets[i]` is the fret on string i; null = don't
// play that string. `fingers[i]` is the fretting-hand finger (1 index .. 4 pinky,
// 0 = open) purely for the diagram. Every shape here is open-position and
// barre-free on purpose — a barre chord in week one is how beginners quit.
export const CHORDS = {
  Em:     { name: 'Em',     frets: [0, 2, 2, 0, 0, 0],           fingers: [0, 2, 3, 0, 0, 0], tip: 'Two fingers, all six strings. The friendliest chord on the guitar.' },
  Em7:    { name: 'Em7',    frets: [0, 2, 0, 0, 0, 0],           fingers: [0, 2, 0, 0, 0, 0], tip: 'Em with one finger lifted — a great warm-up shape.' },
  E:      { name: 'E',      frets: [0, 2, 2, 1, 0, 0],           fingers: [0, 2, 3, 1, 0, 0], tip: 'Em plus one finger. Big, bright, and it rings out.' },
  Am:     { name: 'Am',     frets: [null, 0, 2, 2, 1, 0],        fingers: [0, 0, 2, 3, 1, 0], tip: 'Same shape as E, moved down one string.' },
  Asus2:  { name: 'Asus2',  frets: [null, 0, 2, 2, 0, 0],        fingers: [0, 0, 1, 2, 0, 0], tip: 'The easy A. Two fingers, side by side.' },
  A:      { name: 'A',      frets: [null, 0, 2, 2, 2, 0],        fingers: [0, 0, 1, 2, 3, 0], tip: 'Three fingers crowded into one fret — go slow.' },
  Dsus2:  { name: 'Dsus2',  frets: [null, null, 0, 2, 3, 0],     fingers: [0, 0, 0, 1, 3, 0], tip: 'The easy D. Only the thin four strings.' },
  D:      { name: 'D',      frets: [null, null, 0, 2, 3, 2],     fingers: [0, 0, 0, 1, 3, 2], tip: 'A little triangle. Strum only the thin four strings.' },
  Dm:     { name: 'Dm',     frets: [null, null, 0, 2, 3, 1],     fingers: [0, 0, 0, 2, 3, 1], tip: 'D with a sadder top note.' },
  G:      { name: 'G',      frets: [3, 2, 0, 0, 0, 3],           fingers: [3, 2, 0, 0, 0, 4], tip: 'Your hand has to stretch. It gets easy fast — promise.' },
  C:      { name: 'C',      frets: [null, 3, 2, 0, 1, 0],        fingers: [0, 3, 2, 0, 1, 0], tip: 'A staircase going down. Keep the thumb behind the neck.' },
  Fmaj7:  { name: 'Fmaj7',  frets: [null, null, 3, 2, 1, 0],     fingers: [0, 0, 3, 2, 1, 0], tip: 'The no-barre F. Sounds lovely and nothing hurts.' },
  E7:     { name: 'E7',     frets: [0, 2, 0, 1, 0, 0],           fingers: [0, 2, 0, 1, 0, 0], tip: 'The bluesy one. Wants to fall back to A minor.' },
  G7:     { name: 'G7',     frets: [3, 2, 0, 0, 0, 1],           fingers: [3, 2, 0, 0, 0, 1], tip: 'G with a twist — it pulls hard toward C.' },
  A7:     { name: 'A7',     frets: [null, 0, 2, 0, 2, 0],        fingers: [0, 0, 2, 0, 3, 0], tip: 'Two fingers. Pure blues fuel.' },
};

// The MIDI notes a chord shape actually sounds, low to high.
export function chordMidis(shape) {
  const out = [];
  shape.frets.forEach((f, s) => { if (f !== null) out.push(midiOf(s, f)); });
  return out;
}

// Pitch classes in a chord — used by Guitar Mode to check "close enough" when
// someone strums. Chord detection from a mic is genuinely hard; we only ask that
// the strum contained the right *notes*, not that it was clean.
export function chordPitchClasses(shape) {
  return [...new Set(chordMidis(shape).map(pcOf))];
}

// The strings a shape is strummed across (skipping muted ones).
export function chordLanes(shape) {
  const out = [];
  shape.frets.forEach((f, s) => { if (f !== null) out.push(s); });
  return out;
}
