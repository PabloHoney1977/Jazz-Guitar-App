# Tests

Run unit/theory/gating tests:

```
npm test        # or: node --test
```

Run DOM smoke tests (requires Playwright Chromium):

```
npm run test:smoke    # or: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node test/smoke.cjs
```

## What this covers

`theory.test.cjs` is the regression net for the **pure music-theory layer** of
`app.js` — the deterministic functions and data tables that have no UI or audio
dependencies: `getChordTones`, `getRootlessTones`, `calcVoicing`,
`calcFingering`, `getScalePos`, `getArpPos`, `getParentRoot`, `nn`, and the
`DNAMES` / `INT_NAMES` / `EXT_TYPES` / `CHORD_SCALES` / `QTYPES` / `ROMAN`
tables. Every bug previously hand-fixed in this area (the `maj7` seventh
mislabel, scale-interval labels, finger-number capping, rootless spelling,
open-string positions) has an explicit guard so it cannot silently return.

The strongest single check is the **diatonic invariant**: for all 12 keys,
every one of the 7 diatonic 7th chords must use only notes in the key. A wrong
interval in any chord quality breaks it immediately.

## How it works

`load-app.cjs` loads `app.js` inside a Node `vm` sandbox with minimal browser
stubs (React, ReactDOM, document, localStorage, AudioContext, …). The file ends
with a `ReactDOM.createRoot(...).render()` wrapped in try/catch, so it fails
harmlessly under the stubs; a capture line then exposes the module-scoped
functions and tables for assertion. This keeps `app.js` a single, build-free
file — nothing is exported from or modified in the app itself.

If a captured symbol is renamed in `app.js`, its test fails with `undefined`;
update the `CAPTURE_NAMES` list in `load-app.cjs` to match.

## Smoke tests (`smoke.cjs`)

`smoke.cjs` drives the app in a real headless Chromium browser with an iPhone 14
viewport (390×844, Safari UA) using Playwright. This catches layout/render bugs
that the vm sandbox can't see — including the class of `visualViewport` misalignment
the iOS tour-spotlight fix addressed.

What it covers (31 checks across 14 test blocks):
- App bootstraps without JS errors
- All 5 nav tabs render with correct labels
- Guide tab renders ≥10 stages; scrolls to top when nothing done; auto-scrolls
  when progress exists (`jg-path`)
- Tour spotlight rectangle aligns within 60px of its nav target
- Keys (Diatonic) tab: 7 chord buttons with correct Roman numeral casing
  (uppercase I/IV/V, lowercase ii/iii/vi/vii)
- Play tab: BPM in range, Start/Stop button present
- Ear Training tab renders without error
- Dark/light theme toggle flips `data-theme`
- `prefers-reduced-motion` collapses `animation-duration` to ≤1ms
- Viewport meta present with `user-scalable=no`
- PWA manifest linked
- **Visual snapshots** of every tab (Guide, Keys, Chords, Play, Train) plus the
  Play tab with the per-bar voicing override expanded, captured in **Pro** mode
  (so every gated control renders) to `test/screenshots/`

### Why the snapshots

DOM assertions verify *correctness* — the right elements exist, the right values
render. They cannot express *clarity*: e.g. two near-duplicate controls that read
as redundant, an overflowing label, or a confusing layout. Those are perceptual
bugs you have to **see**. The snapshots exist so a reviewer — or a vision-capable
agent — can look at each screen cold and catch UI-confusion issues that no
selector can encode. They are diagnostic artifacts, regenerated each run and
git-ignored (not committed).

**Note:** WebKit binary is blocked in this CI environment, so Chromium is used
instead. For true iOS Safari fidelity, test on a physical device via TestFlight.

CDN React is intercepted and served from local copies in `test/react*.js`
(copied from npm at setup time; not committed to git).

## What this does NOT cover

Audio playback/scheduling, RevenueCat IAP flow, Bluetooth pedal events, and
true iOS WebKit rendering quirks. Those need a physical device via TestFlight.
