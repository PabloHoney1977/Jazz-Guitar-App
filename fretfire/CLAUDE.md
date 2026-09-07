# Fretfire — Project Context

> Guitar Hero for people who have never held a guitar. **Completely separate
> from Jazz Guitar Lab** — different audience (absolute beginners vs. theory-
> literate players), different design language (game-first vs. reference-first),
> zero shared code. Do not import from, mirror, or "align with" that app.

## Repo status — READ FIRST

Fretfire was built in a session scoped to the `Jazz-Guitar-App` repo, and the
GitHub integration is **not authorised to create repositories** (`POST
/user/repos` → 403). So this project currently lives in a `fretfire/`
subdirectory on the branch `claude/guitar-learning-app-fag0sw` of
`PabloHoney1977/Jazz-Guitar-App`, purely as durable storage.

**It must never be merged into that repo's `main`** — `main` is served live as
Jazz Guitar Lab and is bundled into its iOS build. Merging would ship a second
app inside the first.

To move it to its own home, create an empty `pablohoney1977/fretfire` on
github.com, then:

```bash
git subtree split --prefix=fretfire -b fretfire-only     # history, just this dir
git push git@github.com:pablohoney1977/fretfire.git fretfire-only:main
```

Once that is done, delete the `fretfire/` directory from the Jazz branch and
update this section.

## Big picture

Free, offline, no-account guitar game for absolute beginners. Web/PWA first;
Capacitor→iOS is plausible later but nothing is built for it yet and no
monetisation exists. The product thesis: **beginners quit because the first two
weeks are boring and painful, not because guitar is hard.** Everything is judged
against that — is this more fun, and does it get them playing sooner?

## Stack

Vanilla ES modules, no framework, no build step, no runtime dependencies. Canvas
2D for the note highway, DOM for every other screen. Playwright is a dev
dependency for tests only. Serve from any static host; `npm run serve` for local.

## Rules that are not up for renegotiation

- **The audio clock is the only clock.** Every game time comes from
  `AudioContext.currentTime`. Never schedule or judge on `rAF` deltas,
  `setTimeout`, or `Date.now`.
- **No external requests, ever.** No CDN, no webfont, no analytics. The smoke
  suite fails on a single non-local request. This is what lets the app boot
  offline on first run.
- **No audio files.** Guitar is Karplus-Strong, drums and bass are synthesised.
  Adding a sample pack would multiply the app's size by ~50x for a marginal
  tone improvement.
- **Public domain melodies only.** Chord progressions are not copyrightable;
  melodies are. Every tune is pre-1900 traditional, Beethoven, or original.
  Adding a modern song's melody would need a licence.
- **No barre chords, nothing past fret 4.** Enforced by a unit test. This is a
  beginner app and a barre chord in week one is why people quit.
- **The backing band never plays the guitar part.** Drums and bass only. If the
  backing played the melody, hitting notes would be meaningless.
- **Never punish a beginner for technique.** A muted-sounding chord in Guitar
  Mode is graded down, never counted as a miss. A stray strum only breaks the
  combo when a note was visibly there to hit.

## Gotchas already paid for

- **`[hidden]` loses to any class that sets `display`.** `.lanes { display:grid }`
  silently defeated `hidden`, so the strum bar and lane pads both showed at once.
  `css/app.css` now carries `[hidden] { display: none !important; }` — keep it.
- **An SVG filter on a zero-height bbox renders nothing.** A horizontal `<line>`
  has a geometry bbox of height 0, so a bbox-relative `filterRegion` collapses
  and the element vanishes. The icon's hit-line glow is faked with a second
  wider translucent stroke instead. Do not "fix" it back to a filter.
- **Playwright's npm package expects a browser build the container does not
  have** (wants 1243, has 1194). `test/browser.mjs` launches with an explicit
  `executablePath`. Do not run `npx playwright install`.
- **The smoke harness must not clear `localStorage` on every navigation** — it
  makes "does a returning player skip the intro?" untestable. It clears once per
  run, guarded by `sessionStorage`.
- **Screens fade in over 220ms.** Screenshotting through the fade produces
  washed-out images that look exactly like a CSS bug. `shot()` waits it out.
- **Chromium needs `--autoplay-policy=no-user-gesture-required`** or the audio
  clock never advances and every timing test hangs.

## Testing

- `npm test` — **30 checks**. Theory and tuning, chord-shape playability, chart
  validity and curriculum ordering, timing windows and star thresholds, pitch
  detection across the whole playable range (including octave-error and
  noisy-room cases), XP curve and date arithmetic.
- `npm run test:smoke` — **45 checks** in a real browser at 390×844. Boots, walks
  the first-run flow, plays a melody chart and a chord chart to completion with
  an autoplaying bot, verifies the canvas is actually painting, checks progress
  persists and unlocks the next song, exercises pause/resume, the tuner and
  settings. Screenshots land in `test/screenshots/` (gitignored).
- **Guitar Mode is tested without a guitar** by feeding fabricated readings
  straight into `game.feedMic()`: right note = hit, wrong note = ignored, muted
  chord = graded down but never a miss. If you touch `feedMic`, these are the
  checks that matter.

Both suites are green. There is no accepted-red baseline — a failure is a
regression.

## Where it stands / what is next

Built and working: the full ten-song ladder, tap and Guitar Mode, pre-song
lessons with chord and string diagrams, the tuner, XP/levels/stars/daily streak,
practice speeds, trouble-spot detection, pause, left-handed lanes, PWA offline.

Not built, roughly in value order:

1. **Never tested with a real guitar or a real beginner.** Guitar Mode's timing
   offset default (55ms) and the onset threshold are educated guesses. First
   real-hardware session should tune `Listener.inputOffset` and `noiseFloor`.
2. **Strumming patterns** — every chord chart is currently downstrokes on the
   beat. Down-down-up-up-down is the thing that makes a beginner sound like a
   musician, and it is the single biggest missing lesson.
3. **More songs**, especially between #6 and #7 — the melody→chord jump is the
   steepest step on the ladder.
4. **Hold/sustain notes are drawn but not judged** — the tail renders, but
   releasing early costs nothing.
5. Fire meter is implemented and activatable (`Q` key) but has no touch control.
6. No iOS wrapper, no store presence, no monetisation.

## Layout

```
index.html      shell + boot placeholder + watchdog
css/app.css     one stylesheet
js/             theory, audio, pitch, songs, game, fx, store, ui, main
test/           unit tests (*.test.mjs), smoke.mjs, serve.mjs, browser.mjs
icons/          icon.svg + rasterised PNGs (npm run icons)
sw.js           atomic precache of the whole app
```
