# Jazz Guitar Lab — Project Context

## Workflow Preferences
- After committing, always push to the appropriate branch immediately — do not wait to be asked.
- The app is served from `main`; always ensure finished work lands on `main` and is pushed.

## Big Picture Goal
Ship Jazz Guitar Lab as a **freemium iOS App Store app** targeting adult guitarists who want to learn jazz harmony. Monetization: **free download** (Essentials tier) with a **$9.99 one-time IAP** to unlock Pro. No subscription.

**Freemium split:**
- **Free (Essentials):** Shell voicings only, major II-V-I only, melodic intervals (5 consonant intervals), first 4 chord types in Any Chord tab, all 16 Guide stages (no feature gating in Guide)
- **Paid Pro ($9.99):** Drop 2/3/Rootless voicings, minor II-V-I + jazz blues + tritone sub + sec dom + custom + standards play forms, all 12 intervals + harmonic mode + triads + 7th chords + cadences + Auto ear training in Ear Training, all extended chord types (9ths, 11ths, 13ths, altered) in Any Chord

**Destination:** Apple App Store via Capacitor (web→native wrapper) + Codemagic (cloud CI/CD build — no Mac required).
**Timeline:** Ship as soon as the product is ready. User has no existing audience and is willing to spend on paid acquisition.
**Apple Developer account:** Not yet set up ($99/year enrollment needed).
**Bundle ID:** `com.pablohoney.jazzguitarlab`
**Support:** Simple email channel (no dedicated support infrastructure needed pre-launch).
**Marketing:** Paid ads (Instagram/TikTok/YouTube targeting guitarists). No prior audience to leverage.

## Stack
Single-file React 18 PWA. No build step. CDN React, all inline styles, ~5100 lines in `app.js`. Serve from `main` branch, develop on feature branches. Target: iPad (720px content width) primary, iPhone secondary.

Capacitor iOS project lives in `ios/`. Build script (`npm run build`) copies web assets to `www/` before `cap sync`. Codemagic config is in `codemagic.yaml`.

## App Store Deployment Checklist
**Launch plan lives in:** `SHIP_GATE.md` (v1.0 definition of done / stopping rule),
`BACKLOG.md` (parked non-blockers), `docs/IAP_PLAN.md` (the revenue gate — real
$9.99 IAP), `docs/APP_STORE_LISTING.md` (listing copy + ASO). The critical path
to revenue is: freeze scope → wire real IAP → distribution. Minor bug findings
go in `BACKLOG.md`, not in the way of launch.

Steps completed and still needed to ship:
- [x] Capacitor iOS project initialized (`ios/` directory committed)
- [x] `codemagic.yaml` build pipeline configured
- [x] Bundle ID decided: `com.pablohoney.jazzguitarlab`
- [ ] Enroll in Apple Developer Program — developer.apple.com, $99/year, 1–2 days to process
- [ ] Sign up for Codemagic — codemagic.io, connect to GitHub repo
- [ ] Register bundle ID in Apple Developer portal
- [ ] Create App Store Connect API key, paste into Codemagic dashboard
- [ ] Create App Store listing (name, screenshots, description, pricing)
- [ ] Set up $9.99 one-time IAP in App Store Connect (product ID: `pro_unlock`)
- [ ] Add Capacitor Local Notifications plugin (for practice streak reminders — defer until after first build succeeds)
- [ ] App icon: needs all required sizes (currently have `icon.svg` and `icons/` — need to verify App Store required sizes)
- [ ] Splash screen: review default Capacitor splash, customize if needed
- [ ] First TestFlight build via Codemagic
- [ ] Internal testing
- [ ] App Store submission

## What's Built (current `app.js` features)
- **5 nav tabs:** Guide, Chords (Diatonic), Any Chord (Custom), Play (II-V-I), Ear Training
- **Freemium paywall:** `UpgradeSheet` bottom sheet triggered by 🔒 lock badges on gated features. `showUpgrade(feature)` / `doUpgrade()` in App. Currently calls `setLevel('full')` directly — TODO: wire to RevenueCat/StoreKit IAP. Pro ✦ chip in header (tap to revert to Essentials for testing).
- **First-time onboarding:** Brand-new users (no `jg-viewMode` saved, no `jg-path` progress) land on the Guide tab. Returning users go straight to their last view. Logic in `viewMode` useState init.
- **Guide tab:** 16 ordered learning stages with expandable content, tappable checklist items (persisted to `jg-path-items`), resume card, phase labels, links to live presets
- **Chords tab:** All 7 diatonic chords in any key, shell/drop2/drop3/rootless voicings, scale overlay, guide tones, fingering numbers
- **Any Chord tab:** All chord types including extensions, find-in-key, custom root picker
- **Play tab (IIVIView):** Backing track with walking bass, ride cymbal, jazz guitar comping. Forms: major/minor II-V-I, jazz blues, tritone sub, sec. dom., custom. Swing feel, variable BPM (35–150). Voice leading, pinned chords, bar-level voicing override.
- **Ear Training tab:** Interval recognition (melodic + harmonic), triads, 7th chords, cadence recognition (II-V, V-I, II-V-I, I-VI, iv-I). Essentials: consonant intervals (melodic) only, single "3 more modes 🔒" upgrade CTA (not individual per-tab badges). Pro: all 12 intervals + harmonic mode + triads + 7th chords + cadences. Nav row uses ← ♪ → circle buttons (always in viewport, no scroll needed).
- **Two-tier tour system:** App overview tour (5 steps across nav tabs) + per-page contextual tour for each tab
- **Streak tracking:** 🔥 Xd badge in header. `markPracticed()` fires after 4 completed loops in the Play tab, after the 5th Ear Training answer in a session, or when checking off a Guide checklist item. Resets if a day is skipped (with a one-day grace once streak ≥ 3). `playSessions` counted in localStorage. Push notification reminders deferred to Capacitor build.
- **Streak milestones:** Celebration card slides up at days 3, 7, 14, 30. Auto-dismisses at 5.4s. Tap to dismiss early. `streakMilestone` state, `STREAK_MILESTONES=[3,7,14,30]`, `milestoneUp` CSS animation in index.html.
- **Dark/light theme toggle**
- **Bluetooth page-turner pedal support** (AirTurn / PageFlip keyboard events)
- **PWA:** `manifest.json` + `sw.js` service worker for offline caching

## Test Suite
- **Unit + gating:** `npm test` — 40 checks (theory, content, freemium gate assertions). Lives in `test/theory.test.cjs`, `test/content.test.cjs`, `test/gating.test.cjs`.
- **Smoke (Playwright):** `npm run test:smoke` — 68 checks across 24 test blocks. Headless Chromium, iPhone 14 viewport (390×844). Covers layout, interactive flows, upgrade sheet, BPM control. React UMD copies needed in `test/` (CDN blocked in CI; install once from npm). Screenshots written to `test/screenshots/`.
- **Exploratory harness:** `npm run test:explore` — multi-persona simulation. 4 parallel sessions, each 20 steps, seeded PRNG for reproducibility (`--seed N`). Generates structured report in `test/explore/reports/YYYYMMDD-HHMM/`. Set `ANTHROPIC_API_KEY` for LLM synthesis of findings. Reports dir is gitignored.

## Audio Architecture
- Guitar samples from `nbrosowsky` CDN, pre-fetched as ArrayBuffers on load
- `playGuitarNote(ctx, midi, startTime, sustainSecs, vol)` — biquad EQ chain for jazz tone (warmth boost 180Hz, presence cut 2200Hz, hi-shelf cut 3500Hz)
- `playGuitarChord(ctx, midiNotes, startTime, sustainSecs, vol, strum)` — stagger per string, volume taper
- `pickStrum(isStab)` — probabilistic strum direction/speed
- Bass: Web Audio API synthesis with `bLowBoost`, `bThump`, `bMidCut`, `bHiCut` filter chain
- Ride cymbal: pre-rendered via `OfflineAudioContext`
- Beat scheduling: `tick()` with `nextTimeRef`, `beatRef`, `barPatternRef`

## Key Architecture Notes
- `app.js` is the only source file — all components, data, audio, styles in one place
- CSS variables in `index.html` for dark/light theme
- Tonal center colors: `TC = ['#FF6B6B','#4ECDC4','#74C0FC','#FFD43B']` (Root, 3rd, 5th, 7th) — teal restricted to chord-tone contexts only
- `e()` = `React.createElement` alias used throughout
- `localStorage` keys: `jg-path` (guide done), `jg-streak`, `jg-last-practice`, `jg-play-sessions`, `jg-level`, `jg-key`, `jg-bpm`, `jg-form`, `jg-toured`, etc.
- `SCALE_HINTS` has dom7 with 4 options including Phrygian Dom
- Essentials tier: shell voicings only, major II-V-I only, melodic intervals (consonant) only in ear training, first 4 chord types in Any Chord; gated features show 🔒 badges that trigger UpgradeSheet
- Pro tier: all voicings, all play forms, all ear training modes, all chord types

## Decided Against (don't re-suggest)
- Comping rhythm patterns
- Chord melody examples
- Enclosures
- Guitar tone unlocks / EQ presets labeled as guitar models (sounds like EQ, not like actual guitars)
- Locking Pro version behind achievements (advanced users hit a wall = bad reviews)
- Subscription pricing (one-time $9.99 is the model)

## Pending / Next Session Priorities
1. **IAP implementation (revenue gate)** — Replace the `doUpgrade()`/`doRestore()` stubs (currently grant Pro for free) with a real RevenueCat purchase. Product ID: `pro_unlock`, entitlement-on-launch as source of truth. Full plan + code in `docs/IAP_PLAN.md`.
2. **App Store assets** — app icon in all required sizes, screenshots, store description copywriting. Copy + ASO drafted in `docs/APP_STORE_LISTING.md`.
3. **Apple Developer enrollment** — user action required, $99, developer.apple.com
4. **Code audit** — re-renders, audio memory leaks, edge cases in `calcVoicing`/`calcFingering`
5. **Add Capacitor Local Notifications** — practice streak reminders (defer until after first TestFlight build)
