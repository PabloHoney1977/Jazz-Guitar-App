# Fretfire

**Learn real guitar by playing a game.**

Notes fall down a neon highway toward a hit line. You hit them in time. That is
the whole game — and by the end of the ladder you can play ten songs on an
actual guitar.

Fretfire is built for people who have never held a guitar. It is not a theory
app, it does not show you notation, and it never asks you to know what a
dominant seventh is. It teaches by having you play.

---

## How it works

**Tap Mode** — play with your thumbs. Six lanes, one per string. Works on any
phone or laptop with no guitar in the room.

**Guitar Mode** — Fretfire listens through the microphone and checks the note
you actually played. Single notes are matched by pitch (autocorrelation, tuned
for the guitar's range); chords are matched by strum timing plus a lenient
chroma check, because a beginner's first chords are half-muted and the game
should coach that, not punish it.

There is a **built-in tuner** using the same pitch detection — an out-of-tune
guitar makes Guitar Mode useless, and beginners cannot hear it yet.

## The ladder

Ten songs, in the order a teacher would introduce them:

| # | Song | Teaches |
|---|------|---------|
| 1 | First Sparks | Strumming in time, one open string |
| 2 | String Safari | All six string names |
| 3 | Hot Cross Buns | Pressing your first fret |
| 4 | Ode to Joy | A five-note melody |
| 5 | Twinkle, Twinkle | Reaching fret 5 |
| 6 | When the Saints | Faster tempo, off-beat entries |
| 7 | Ember | Your first chord (Em) |
| 8 | Two-Chord Town | The first chord *change* |
| 9 | House of the Rising Sun | Am, C, D, Fmaj7, E7 |
| 10 | Campfire | G, C and D |

Rhythm before pitch, one string before six, single notes before chords, two
chords before three. A song unlocks when the one before it earns a single star,
which is a deliberately low bar — the ladder should pull you forward, not trap
you.

Every chord shape in the app is open-position and barre-free. A barre chord in
week one is how beginners quit.

### Licensing

Every tune is **public domain** (pre-1900 traditional, or Beethoven) or written
for Fretfire. No copyrighted melodies. A melody is the one part of a song that
is unambiguously protected, so the app contains none it does not own.

## Running it

No build step, no bundler, no install to play:

```bash
npm run serve      # http://localhost:8080
```

The app uses ES modules, so it needs a real origin — opening `index.html` from
the filesystem will not work.

```bash
npm test           # 30 unit checks: theory, charts, scoring, pitch, progression
npm run test:smoke # 45 browser checks: boots, plays a song end to end, saves
npm run icons      # re-rasterise icons/icon.svg into PNGs
```

`npm run test:smoke` needs Playwright's Chromium; `test/browser.mjs` points at
the copy already in the container rather than downloading a second one.

## Architecture

Seven small ES modules, no framework, no dependencies at runtime.

```
js/theory.js  guitar facts: tuning, chord shapes, note maths
js/audio.js   Karplus-Strong string synthesis, drums, bass — no audio files
js/pitch.js   microphone: autocorrelation pitch detection, onset, chroma
js/songs.js   the charts and the curriculum
js/game.js    the note highway: timing, judgment, scoring, drawing
js/fx.js      particles, floating text, screen shake
js/store.js   XP, stars, streaks, settings (localStorage)
js/ui.js      every screen that is not the highway
js/main.js    boot, routing, input wiring
```

Three decisions worth knowing:

- **One clock.** All timing comes from `AudioContext.currentTime`.
  `requestAnimationFrame` stutters, `setTimeout` drifts, and `Date.now` lies in
  throttled tabs. A rhythm game that trusts any of them feels broken.
- **No assets.** Guitar tone is Karplus-Strong (a noise burst recirculating
  through a delay line, lowpassed on each pass — which is what a real string
  does). Drums and bass are synthesised. There are no samples, no fonts and no
  CDN, so the app boots offline on the first run and weighs almost nothing.
- **The player makes the sound.** The backing track is drums and bass only. The
  guitar you hear is the note you just hit. Miss it and there is silence.

## Offline

Everything is local and the service worker precaches the entire app atomically —
if one file fails to cache, the install fails and the previous version keeps
serving. A half-installed PWA is how you get a black screen.
