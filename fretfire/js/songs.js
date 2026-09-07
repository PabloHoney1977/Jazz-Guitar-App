// The Fretfire ladder.
//
// Every chart is either a MELODY (one note at a time, one lane) or CHORDS (a
// strum across several strings). The order is the curriculum: rhythm before
// pitch, one string before six, single notes before chords, two chords before
// three. Nothing is unlocked until the thing before it works.
//
// LICENSING: every tune here is either public domain (pre-1900 traditional or
// Beethoven) or written for this app. No copyrighted melodies, ever — a melody
// is the one part of a song that is unambiguously protected.

import { CHORDS } from './theory.js';

// beat, string, fret, hold(beats)
const n = (b, s, f, hold = 1) => ({ type: 'note', b, s, f, hold });
// beat, chord name, hold(beats)
const ch = (b, name, hold = 2) => ({ type: 'chord', b, name, hold });

// Notes on the two thinnest strings — where every beginner melody lives.
const C4 = (b, h) => n(b, 4, 1, h);
const D4 = (b, h) => n(b, 4, 3, h);
const E4 = (b, h) => n(b, 5, 0, h);
const F4 = (b, h) => n(b, 5, 1, h);
const G4 = (b, h) => n(b, 5, 3, h);
const A4 = (b, h) => n(b, 5, 5, h);

export const SONGS = [
  {
    id: 'first-sparks',
    title: 'First Sparks',
    subtitle: 'Original · one string, all rhythm',
    bpm: 74, beatsPerBar: 4, difficulty: 1,
    kind: 'melody',
    teaches: ['Strumming in time', 'The 6th string'],
    band: { drums: 'soft', bass: false },
    lesson: [
      { title: 'Just one string', body: 'Rest your pick on the thickest string — the one closest to the ceiling when you hold the guitar. That is the 6th string, low E.', demo: { type: 'string', s: 0 } },
      { title: 'Do not press anything', body: 'Your left hand gets the night off. Let the string ring open and hit it in time with the beat.', demo: { type: 'string', s: 0 } },
      { title: 'Watch the line', body: 'Notes fall toward the glowing bar at the bottom. Hit exactly when the note touches it — not when you see it coming.', demo: null },
    ],
    notes: [
      n(0, 0, 0), n(1, 0, 0), n(2, 0, 0), n(3, 0, 0),
      n(4, 0, 0), n(5, 0, 0), n(6, 0, 0, 2),
      n(8, 0, 0, 2), n(10, 0, 0, 2), n(12, 0, 0, 2), n(14, 0, 0, 2),
      n(16, 0, 0), n(17, 0, 0), n(18, 0, 0), n(19, 0, 0),
      n(20, 0, 0), n(21, 0, 0), n(22, 0, 0, 2),
      n(24, 0, 0, 2), n(26, 0, 0), n(27, 0, 0),
      n(28, 0, 0), n(29, 0, 0), n(30, 0, 0, 2),
    ],
  },
  {
    id: 'string-safari',
    title: 'String Safari',
    subtitle: 'Original · meet all six strings',
    bpm: 80, beatsPerBar: 4, difficulty: 1,
    kind: 'melody',
    teaches: ['All six string names', 'Moving between strings'],
    band: { drums: 'soft', bass: false },
    lesson: [
      { title: 'Six strings, six lanes', body: 'The lane on the far left is your thickest string. The far right lane is the thinnest. They are in the same order as the strings on your guitar when you look down at it.', demo: { type: 'string', s: 0 } },
      { title: 'Their names', body: 'From thick to thin: E, A, D, G, B, E. Everyone learns them with a silly sentence — "Eddie Ate Dynamite, Good Bye Eddie".', demo: { type: 'string', s: 5 } },
      { title: 'Still no fretting', body: 'Every note here is an open string. Aim, hit, move on.', demo: null },
    ],
    notes: [
      n(0, 0, 0), n(1, 1, 0), n(2, 2, 0), n(3, 3, 0),
      n(4, 4, 0), n(5, 5, 0), n(6, 5, 0, 2),
      n(8, 5, 0), n(9, 4, 0), n(10, 3, 0), n(11, 2, 0),
      n(12, 1, 0), n(13, 0, 0), n(14, 0, 0, 2),
      n(16, 0, 0), n(17, 2, 0), n(18, 4, 0), n(19, 2, 0),
      n(20, 0, 0), n(21, 2, 0), n(22, 4, 0, 2),
      n(24, 5, 0), n(25, 3, 0), n(26, 1, 0), n(27, 3, 0),
      n(28, 5, 0), n(29, 3, 0), n(30, 0, 0, 2),
    ],
  },
  {
    id: 'hot-cross-buns',
    title: 'Hot Cross Buns',
    subtitle: 'Traditional · your first melody',
    bpm: 84, beatsPerBar: 4, difficulty: 1,
    kind: 'melody',
    teaches: ['Pressing your first fret', 'Three-note melody'],
    band: { drums: 'soft', bass: false },
    lesson: [
      { title: 'Press behind the fret', body: 'Put your finger just BEHIND the metal fret wire, not on top of it. Press with the tip of your finger, and press harder than feels polite.', demo: { type: 'note', s: 4, f: 1 } },
      { title: 'Three notes only', body: 'Open 1st string, and two notes on the 2nd string: fret 3 and fret 1. That is the whole song.', demo: { type: 'note', s: 4, f: 3 } },
      { title: 'It will buzz at first', body: 'A buzzing note means your finger is too far from the fret, or not pressing hard enough. Everyone buzzes for the first week.', demo: null },
    ],
    notes: [
      E4(0), D4(1), C4(2, 2),
      E4(4), D4(5), C4(6, 2),
      C4(8), C4(9), D4(10), D4(11),
      E4(12), D4(13), C4(14, 2),
      E4(16), D4(17), C4(18, 2),
      E4(20), D4(21), C4(22, 2),
      C4(24), C4(25), D4(26), D4(27),
      E4(28), D4(29), C4(30, 2),
    ],
  },
  {
    id: 'ode-to-joy',
    title: 'Ode to Joy',
    subtitle: 'Beethoven · public domain',
    bpm: 92, beatsPerBar: 4, difficulty: 2,
    kind: 'melody',
    teaches: ['Five-note melody', 'Changing fingers smoothly'],
    band: { drums: 'folk', bass: false },
    lesson: [
      { title: 'Five notes now', body: 'Two on the 2nd string (frets 1 and 3), three on the 1st string (open, fret 1, fret 3). Use one finger per fret and they stop fighting each other.', demo: { type: 'note', s: 5, f: 3 } },
      { title: 'Leave fingers down', body: 'When you move from fret 1 to fret 3, do not lift the first finger unless you have to. Lazy hands are fast hands.', demo: null },
    ],
    notes: [
      E4(0), E4(1), F4(2), G4(3),
      G4(4), F4(5), E4(6), D4(7),
      C4(8), C4(9), D4(10), E4(11),
      E4(12, 1.5), D4(13.5, 0.5), D4(14, 2),
      E4(16), E4(17), F4(18), G4(19),
      G4(20), F4(21), E4(22), D4(23),
      C4(24), C4(25), D4(26), E4(27),
      D4(28), C4(29), C4(30, 2),
    ],
  },
  {
    id: 'twinkle',
    title: 'Twinkle, Twinkle',
    subtitle: 'Traditional · public domain',
    bpm: 100, beatsPerBar: 4, difficulty: 2,
    kind: 'melody',
    teaches: ['Reaching fret 5', 'Longer form'],
    band: { drums: 'folk', bass: false },
    lesson: [
      { title: 'A new note up high', body: 'Fret 5 on the 1st string. Reach with your pinky if you can — it is weak now and strong later, and only practice fixes that.', demo: { type: 'note', s: 5, f: 5 } },
      { title: 'Longer than anything so far', body: 'Three full phrases. Pace yourself and let the beat carry you.', demo: null },
    ],
    notes: [
      C4(0), C4(1), G4(2), G4(3), A4(4), A4(5), G4(6, 2),
      F4(8), F4(9), E4(10), E4(11), D4(12), D4(13), C4(14, 2),
      G4(16), G4(17), F4(18), F4(19), E4(20), E4(21), D4(22, 2),
      G4(24), G4(25), F4(26), F4(27), E4(28), E4(29), D4(30, 2),
      C4(32), C4(33), G4(34), G4(35), A4(36), A4(37), G4(38, 2),
      F4(40), F4(41), E4(42), E4(43), D4(44), D4(45), C4(46, 2),
    ],
  },
  {
    id: 'saints',
    title: 'When the Saints',
    subtitle: 'Traditional · public domain',
    bpm: 112, beatsPerBar: 4, difficulty: 2,
    kind: 'melody',
    teaches: ['Faster tempo', 'Notes that start off the beat'],
    band: { drums: 'rock', bass: false },
    lesson: [
      { title: 'Faster, and it starts early', body: 'The first three notes are a run-up into the big note. Count "1, 2, 3" and land on the 4th.', demo: null },
      { title: 'Small movements', body: 'At this speed, big picking motions cost you. Move the pick barely more than the thickness of the string.', demo: null },
    ],
    notes: [
      C4(0), E4(1), F4(2), G4(3, 3),
      C4(6), E4(7), F4(8), G4(9, 3),
      C4(12), E4(13), F4(14), G4(15), E4(16), C4(17), E4(18), D4(19, 3),
      E4(22), E4(23), D4(24), C4(25), C4(26), E4(27), G4(28), G4(29), F4(30, 2),
      E4(32), F4(33), G4(34), E4(35), C4(36), D4(37), C4(38, 4),
    ],
  },
  {
    id: 'ember',
    title: 'Ember',
    subtitle: 'Original · your first chord',
    bpm: 80, beatsPerBar: 4, difficulty: 2,
    kind: 'chords',
    teaches: ['E minor', 'Strumming all six strings'],
    band: { drums: 'rock', bass: true },
    lesson: [
      { title: 'Meet E minor', body: 'Two fingers, one shape, and every string rings. It is the first chord almost every guitarist ever plays.', demo: { type: 'chord', name: 'Em' } },
      { title: 'Arch your fingers', body: 'Come down onto the strings from above, on your fingertips. If a string sounds dead, a lazy finger is lying across it.', demo: { type: 'chord', name: 'Em' } },
      { title: 'Strum everything', body: 'All six strings, one smooth motion, from the thick string down to the thin one. Let the guitar ring.', demo: { type: 'chord', name: 'Em' } },
    ],
    notes: [
      ch(0, 'Em', 4), ch(4, 'Em', 4),
      ch(8, 'Em', 2), ch(10, 'Em', 2), ch(12, 'Em', 2), ch(14, 'Em', 2),
      ch(16, 'Em', 1), ch(17, 'Em', 1), ch(18, 'Em', 1), ch(19, 'Em', 1),
      ch(20, 'Em', 1), ch(21, 'Em', 1), ch(22, 'Em', 1), ch(23, 'Em', 1),
      ch(24, 'Em', 2), ch(26, 'Em', 2),
      ch(28, 'Em', 1), ch(29, 'Em', 1), ch(30, 'Em', 2),
    ],
  },
  {
    id: 'two-chord-town',
    title: 'Two-Chord Town',
    subtitle: 'Original · the first chord change',
    bpm: 88, beatsPerBar: 4, difficulty: 3,
    kind: 'chords',
    teaches: ['Asus2', 'Changing chords in time'],
    band: { drums: 'rock', bass: true },
    lesson: [
      { title: 'The easy A', body: 'Asus2 — two fingers side by side on the 4th and 3rd strings, fret 2. Skip the thickest string when you strum.', demo: { type: 'chord', name: 'Asus2' } },
      { title: 'The change is the skill', body: 'Nobody struggles with holding a chord. Everybody struggles with SWAPPING one. Move both fingers at the same time, like one block.', demo: { type: 'chord', name: 'Em' } },
      { title: 'Late is better than wrong', body: 'If you are not ready, skip the strum and arrive on the next one. Stopping the beat is the only real mistake.', demo: null },
    ],
    notes: [
      ch(0, 'Em', 2), ch(2, 'Em', 2), ch(4, 'Em', 2), ch(6, 'Em', 2),
      ch(8, 'Asus2', 2), ch(10, 'Asus2', 2), ch(12, 'Asus2', 2), ch(14, 'Asus2', 2),
      ch(16, 'Em', 1), ch(17, 'Em', 1), ch(18, 'Em', 1), ch(19, 'Em', 1),
      ch(20, 'Em', 1), ch(21, 'Em', 1), ch(22, 'Em', 1), ch(23, 'Em', 1),
      ch(24, 'Asus2', 1), ch(25, 'Asus2', 1), ch(26, 'Asus2', 1), ch(27, 'Asus2', 1),
      ch(28, 'Asus2', 1), ch(29, 'Asus2', 1), ch(30, 'Asus2', 1), ch(31, 'Asus2', 1),
      ch(32, 'Em', 1), ch(33, 'Em', 1), ch(34, 'Em', 1), ch(35, 'Em', 1),
      ch(36, 'Asus2', 1), ch(37, 'Asus2', 1), ch(38, 'Asus2', 1), ch(39, 'Asus2', 1),
      ch(40, 'Em', 1), ch(41, 'Em', 1), ch(42, 'Em', 1), ch(43, 'Em', 1),
      ch(44, 'Asus2', 2), ch(46, 'Em', 2),
    ],
  },
  {
    id: 'rising-sun',
    title: 'House of the Rising Sun',
    subtitle: 'Traditional · public domain',
    bpm: 100, beatsPerBar: 4, difficulty: 4,
    kind: 'chords',
    teaches: ['Am, C, D, Fmaj7, E7', 'A real song form'],
    band: { drums: 'folk', bass: true },
    lesson: [
      { title: 'Five chords, no barre', body: 'Am, C, D, Fmaj7 and E7. Fmaj7 is the friendly F — no barre, nothing hurts.', demo: { type: 'chord', name: 'Fmaj7' } },
      { title: 'Am and C are neighbours', body: 'Look at Am, then C. Two of your fingers barely move between them. Find the finger that stays put and pivot around it.', demo: { type: 'chord', name: 'Am' } },
      { title: 'This one is old', body: 'Nobody knows who wrote it. It has been passed hand to hand for over a century, and now it is yours.', demo: { type: 'chord', name: 'E7' } },
    ],
    notes: [
      ch(0, 'Am', 2), ch(2, 'Am', 2), ch(4, 'C', 2), ch(6, 'C', 2),
      ch(8, 'D', 2), ch(10, 'D', 2), ch(12, 'Fmaj7', 2), ch(14, 'Fmaj7', 2),
      ch(16, 'Am', 2), ch(18, 'Am', 2), ch(20, 'C', 2), ch(22, 'C', 2),
      ch(24, 'E7', 2), ch(26, 'E7', 2), ch(28, 'E7', 2), ch(30, 'E7', 2),
      ch(32, 'Am', 2), ch(34, 'Am', 2), ch(36, 'C', 2), ch(38, 'C', 2),
      ch(40, 'D', 2), ch(42, 'D', 2), ch(44, 'Fmaj7', 2), ch(46, 'Fmaj7', 2),
      ch(48, 'Am', 2), ch(50, 'Am', 2), ch(52, 'E7', 2), ch(54, 'E7', 2),
      ch(56, 'Am', 2), ch(58, 'Am', 2), ch(60, 'Am', 4),
    ],
  },
  {
    id: 'campfire',
    title: 'Campfire',
    subtitle: 'Original · G, C and D',
    bpm: 96, beatsPerBar: 4, difficulty: 5,
    kind: 'chords',
    teaches: ['G, C, D', 'The three chords behind a thousand songs'],
    band: { drums: 'folk', bass: true },
    lesson: [
      { title: 'The big three', body: 'G, C and D. Learn these and you can busk through an enormous amount of music for the rest of your life.', demo: { type: 'chord', name: 'G' } },
      { title: 'G is a stretch', body: 'It feels impossible for about a week, then it feels like nothing. Keep the thumb low behind the neck to buy your fingers room.', demo: { type: 'chord', name: 'G' } },
      { title: 'Ready for it', body: 'This is the graduation song. Slow it down first if you need to — 75% still counts.', demo: { type: 'chord', name: 'D' } },
    ],
    notes: [
      ch(0, 'G', 2), ch(2, 'G', 2), ch(4, 'G', 2), ch(6, 'G', 2),
      ch(8, 'C', 2), ch(10, 'C', 2), ch(12, 'C', 2), ch(14, 'C', 2),
      ch(16, 'G', 2), ch(18, 'G', 2), ch(20, 'G', 2), ch(22, 'G', 2),
      ch(24, 'D', 2), ch(26, 'D', 2), ch(28, 'D', 2), ch(30, 'D', 2),
      ch(32, 'G', 1), ch(33, 'G', 1), ch(34, 'G', 1), ch(35, 'G', 1),
      ch(36, 'C', 1), ch(37, 'C', 1), ch(38, 'C', 1), ch(39, 'C', 1),
      ch(40, 'G', 1), ch(41, 'G', 1), ch(42, 'G', 1), ch(43, 'G', 1),
      ch(44, 'D', 1), ch(45, 'D', 1), ch(46, 'D', 1), ch(47, 'D', 1),
      ch(48, 'G', 1), ch(49, 'G', 1), ch(50, 'C', 1), ch(51, 'C', 1),
      ch(52, 'G', 1), ch(53, 'G', 1), ch(54, 'D', 1), ch(55, 'D', 1),
      ch(56, 'G', 2), ch(58, 'C', 2), ch(60, 'D', 2), ch(62, 'G', 2),
    ],
  },
];

export const songById = (id) => SONGS.find(s => s.id === id) || null;
export const songIndex = (id) => SONGS.findIndex(s => s.id === id);

// Beats -> seconds, honouring the practice-speed multiplier.
export const beatSecs = (bpm, rate = 1) => 60 / (bpm * rate);

// Total length of a chart in beats, including the tail of the last note.
export function chartBeats(song) {
  return song.notes.reduce((m, ev) => Math.max(m, ev.b + (ev.hold || 1)), 0);
}

// Every chord shape a chart uses, in first-appearance order — the lesson screen
// and the in-game chord hint both read this.
export function chordsUsed(song) {
  const seen = [];
  song.notes.forEach(ev => {
    if (ev.type === 'chord' && !seen.includes(ev.name)) seen.push(ev.name);
  });
  return seen;
}

// Fail fast in development if a chart references a chord that does not exist,
// or puts a note on a string that is not there.
export function validateSong(song) {
  const errs = [];
  if (!song.notes.length) errs.push(`${song.id}: empty chart`);
  song.notes.forEach((ev, i) => {
    if (typeof ev.b !== 'number' || ev.b < 0) errs.push(`${song.id}[${i}]: bad beat ${ev.b}`);
    if (ev.type === 'note') {
      if (!(ev.s >= 0 && ev.s <= 5)) errs.push(`${song.id}[${i}]: string ${ev.s} out of range`);
      if (!(ev.f >= 0 && ev.f <= 12)) errs.push(`${song.id}[${i}]: fret ${ev.f} out of range`);
    } else if (ev.type === 'chord') {
      if (!CHORDS[ev.name]) errs.push(`${song.id}[${i}]: unknown chord ${ev.name}`);
    } else {
      errs.push(`${song.id}[${i}]: unknown event type ${ev.type}`);
    }
  });
  for (let i = 1; i < song.notes.length; i++) {
    if (song.notes[i].b < song.notes[i - 1].b) errs.push(`${song.id}[${i}]: chart is not sorted by beat`);
  }
  return errs;
}
