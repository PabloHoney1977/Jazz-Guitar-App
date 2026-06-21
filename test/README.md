# Tests

Run with:

```
npm test        # or: node --test
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

## What this does NOT cover

UI rendering, audio playback/scheduling, localStorage persistence flows, the
freemium paywall, and anything iOS/WebKit-specific. Those need a real device or
a DOM-driving harness and are tracked separately.
