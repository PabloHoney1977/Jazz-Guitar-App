# Jazz Guitar Lab — Project Context

## Workflow Preferences
- Always use model **claude-opus-4-8** (set in `.claude/settings.json`).
- When making a fix, always commit it without being asked — only skip committing if explicitly told not to.
- After committing, always push to the appropriate branch immediately — do not wait to be asked.
- The app is served from `main`; always ensure finished work lands on `main` and is pushed. Merge finished fixes into `main` automatically without asking each time (commit on a feature branch, then merge to `main` and push).
- **Git gotcha (remote-env quirk):** the fresh container clones a stray local `main` with unrelated history (just "Initial commit" / "Improve readability") — do NOT base work on it. The real served main is `origin/main`. A plain `git merge` of a feature branch into local main fails with "refusing to merge unrelated histories". To land work on main: `git fetch origin main`, then `git checkout -B main origin/main` (or `git reset --hard origin/main`), then bring in the fix (`git cherry-pick <fix-commit>` applies cleanly), then `git push origin main`. Other sessions push to `main` concurrently, so `git fetch origin main` again right before pushing and expect to merge `origin/main` before `git push` succeeds.

### Git Workflow Notes (environment-specific)
- No build step — `main` is served live, so landing on `main` = instantly live for testing.
- **Rollback checkpoints use a branch, not a tag.** The session git proxy blocks tag pushes (HTTP 403) and there's no tag-creation API tool. Use a `baseline-YYYY-MM-DD` branch (e.g. via the GitHub `create_branch` API from `main`) as a named known-good restore point. Current baseline: `baseline-2026-06-26`.
- **To undo a live change, use `git revert <sha>`** (creates a new undo commit, safe to push). Never `reset --hard` on shared `main`. Keep commits small and atomic so reverts are surgical.

## Big Picture Goal
Ship Jazz Guitar Lab as a **freemium iOS App Store app** targeting adult guitarists who want to learn jazz harmony. Monetization: **free download** (Essentials tier) with a **$14.99 one-time IAP** to unlock Pro. No subscription.

**Freemium split:**
- **Free (Essentials):** Shell voicings only, major II-V-I only, melodic intervals (5 consonant intervals), first 4 chord types in Any Chord tab, all 16 Guide stages (no feature gating in Guide)
- **Paid Pro ($14.99):** Drop 2/3/Rootless voicings, minor II-V-I + jazz blues + I-VI-ii-V turnaround + tritone sub + sec dom + custom + 5 jazz standards (Blue Bossa, Autumn Leaves, All The Things You Are, Stella by Starlight, There Will Never Be Another You), all 12 intervals + harmonic mode + triads + 7th chords + cadences + Auto ear training in Ear Training, all extended chord types (9ths, 11ths, 13ths, altered) in Any Chord, Favorites (save/restore progressions) in Play

**Destination:** Apple App Store via Capacitor (web→native wrapper) + Codemagic (cloud CI/CD build — no Mac required).
**Timeline:** Ship as soon as the product is ready.
**Apple Developer account:** Not yet set up ($99/year enrollment needed). Also enroll in the Apple Small Business Program (15% cut instead of 30% — raises net per sale from $10.49 to $12.74 on a $14.99 purchase).
**Bundle ID:** `com.pablohoney.jazzguitarlab`
**Support:** Simple email channel (no dedicated support infrastructure needed pre-launch).
**Marketing:** Organic only — ASO (App Store search optimization), YouTube guitar community, Reddit (r/jazzguitar, r/guitarlessons), musician forums. No paid ads — one-time IAP economics don't support paid acquisition (CPI would exceed LTV). Build audience through content and community.

## Stack
Single-file React 18 PWA. No build step. CDN React, all inline styles, ~5100 lines in `app.js`. Serve from `main` branch, develop on feature branches. Target: iPad (720px content width) primary, iPhone secondary.

Capacitor iOS project lives in `ios/`. Build script (`npm run build`) copies web assets to `www/` before `cap sync`. Codemagic config is in `codemagic.yaml`.

## App Store Deployment Checklist
Steps completed and still needed to ship:
- [x] Capacitor iOS project initialized (`ios/` directory committed)
- [x] `codemagic.yaml` build pipeline configured
- [x] Bundle ID decided: `com.pablohoney.jazzguitarlab`
- [ ] Enroll in Apple Developer Program — developer.apple.com, $99/year, 1–2 days to process
- [ ] Sign up for Codemagic — codemagic.io, connect to GitHub repo
- [ ] Register bundle ID in Apple Developer portal
- [ ] Create App Store Connect API key, paste into Codemagic dashboard
- [ ] Create App Store listing (name, screenshots, description, pricing)
- [ ] Set up $14.99 one-time IAP in App Store Connect (product ID: `pro_unlock`) — client code is wired (RevenueCat); still need the App Store product + RevenueCat project/key
- [ ] Add Capacitor Local Notifications plugin (for practice streak reminders — defer until after first build succeeds)
- [ ] App icon: needs all required sizes (currently have `icon.svg` and `icons/` — need to verify App Store required sizes)
- [ ] Splash screen: review default Capacitor splash, customize if needed
- [ ] First TestFlight build via Codemagic
- [ ] Internal testing
- [ ] App Store submission

## What's Built (current `app.js` features)
- **5 nav tabs:** Guide, Chords (Diatonic), Any Chord (Custom), Play (II-V-I), Ear Training
- **Freemium paywall:** `UpgradeSheet` bottom sheet triggered by 🔒 lock badges on gated features. `showUpgrade(feature)` / `doUpgrade()` in App. **IAP wired via RevenueCat** (`IAP` module near top of `app.js`, mirrors the `Notif` no-op-on-web pattern): `doUpgrade`/`doRestore` run a real `purchasePackage`/`restorePurchases` on a native build once `__REVENUECAT_IOS_KEY__` is filled in; otherwise (web/PWA, or native pre-key) they fall back to the dev-unlock `setLevel('pro')`. A launch effect re-grants Pro from the receipt. Entitlement id `pro`, product `pro_unlock`. Pro ✦ chip in header (tap to revert to Essentials for testing).
- **7-day Pro trial ("taste of Pro"):** `UpgradeSheet` shows a "Try Pro free for 7 days" secondary button, only when no trial started yet. Stored as `jg-trial-start` (date string). `trialActive` is computed from that date (<7 days). KEY ARCHITECTURE: `effectiveLevel = (level==='essentials' && trialActive) ? 'pro' : level` is what gets passed to ALL four child views (Guide, Play, Keys/CustomChord, Train) and drives `isEss`. The purchased `level`/`jg-level` is NEVER set to 'pro' during a trial — only `effectiveLevel` lifts gates, so an expired trial cleanly reverts without a stale 'pro' confusing future IAP wiring. Header shows "Trial ✦" (vs "Pro ✦"); tap toggles `trialActive` off to preview Essentials. When trial expired, `UpgradeSheet` shows "Your free trial has ended" copy. `trial.started` tracked via PostHog.
- **First-time onboarding:** Brand-new users (no `jg-viewMode` saved, no `jg-path` progress) land on the Guide tab. Returning users go straight to their last view. Logic in `viewMode` useState init.
- **Guide tab:** 16 ordered learning stages with expandable content, tappable checklist items (persisted to `jg-path-items`), resume card, phase labels, links to live presets. Collapsible "Start Here" intro (open for new users, collapsed once there's progress; choice persisted to `jg-guide-intro`). **Scroll-restore on return:** GuideView unmounts on tab switch, so a module-level `guideReturn` snapshots scroll position + open stages on unmount and restores them on remount within the session (fresh reload still jumps to current stage). Scroll is captured via a scroll listener, not `window.scrollY` at unmount, because nav-away calls `window.scrollTo(0,0)` synchronously first.
- **Chords tab:** All 7 diatonic chords in any key, shell/drop2/drop3/rootless voicings, scale overlay, guide tones, fingering numbers
- **Any Chord tab:** All chord types including extensions, find-in-key, custom root picker. Two modes: **Build a Chord** (pick root + type, see voicings on neck) and **Find Chord** (Pro — tap notes on fretboard to identify chord). Find Chord: exact matches show chord name + "open ↗" to jump to Build a Chord; incomplete matches are clickable and highlight missing chord tones as blue dashed dots on the fretboard so you can tap them to complete the voicing.
- **Play tab (IIVIView):** Backing track with walking bass, ride cymbal, jazz guitar comping. Forms: major/minor II-V-I, jazz blues, I-VI-ii-V turnaround, tritone sub, sec. dom., custom. Standards (Pro): Blue Bossa, Autumn Leaves, All The Things You Are, Stella by Starlight, There Will Never Be Another You. Swing feel, variable BPM (35–150). Voice leading, pinned chords, bar-level voicing override. Per-instrument **MIX controls** (Bass/Guitar/Ride): each has a LED enable toggle + MIX button that opens a 5-band EQ + volume slider (keys `jg-eq`/`jg-geq`/`jg-req`, plus volume state). **Favorites (Pro):** ★ saves current form+BPM+voicing (+custom prog / bar voicings); saved chips restore in one tap (`jg-faves`). In Essentials, Favorites shows as a locked dashed "🔒 Pro" discovery card that opens the UpgradeSheet. Both MIX (`play-mix`) and Favorites (`play-faves`) have contextual tour steps.
- **Ear Training tab:** Interval recognition (melodic + harmonic), triads, 7th chords, cadence recognition (II-V, V-I, II-V-I, I-VI, iv-I). Essentials: consonant intervals (melodic) only, single "3 more modes 🔒" upgrade CTA (not individual per-tab badges). Pro: all 12 intervals + harmonic mode + triads + 7th chords + cadences. Nav row uses ← ♪ → circle buttons (always in viewport, no scroll needed).
- **Two-tier tour system:** App overview tour (5 steps across nav tabs) + per-page contextual tour for each tab. **Tier-aware:** `tourStepsFor(steps, isPro)` adapts copy for Pro users — drops the pricing-pitch step (`essentialsOnly:true`) and swaps "unlocks with Pro" wording for `proText`/`proTitle` describing features they already have. Used in both render and the `overviewNext`/`pageTourNext` length checks.
- **Streak tracking:** 🔥 Xd badge in header. Fires when Play tab session starts OR first Ear Training answer. Resets if day is skipped. `playSessions` counted in localStorage. Push notification reminders deferred to Capacitor build.
- **Streak milestones:** Celebration card slides up at days 3, 7, 14, 30. Auto-dismisses at 5.4s. Tap to dismiss early. `streakMilestone` state, `STREAK_MILESTONES=[3,7,14,30]`, `milestoneUp` CSS animation in index.html. Days 7 and 30 show an inline upgrade nudge for essentials users.
- **CRO upgrade CTAs:** Guide Stage 16 ("standard") shows a gold upgrade card before "I've got this" (essentials only). Guide allDone graduation card has an Unlock Pro button (essentials only).
- **Analytics:** PostHog CDN snippet in `index.html` with `__POSTHOG_KEY__` placeholder (no-ops until key is set — user must replace after signing up at posthog.com). `track(event, props)` helper in `app.js`. Events tracked: `app.loaded`, `paywall.shown {feature}`, `upgrade.completed {feature}`, `trial.started`, `guide.stage.completed {stage_id}`, `streak.milestone {days, level}`.
- **Dark/light theme toggle**
- **Bluetooth page-turner pedal support** (AirTurn / PageFlip keyboard events)
- **PWA:** `manifest.json` + `sw.js` service worker for offline caching

## Test Suite
- **Unit + gating:** `npm test` — 40 checks (theory, content, freemium gate assertions). Lives in `test/theory.test.cjs`, `test/content.test.cjs`, `test/gating.test.cjs`.
- **Smoke (Playwright):** `npm run test:smoke` — 68 checks across 24 test blocks. Headless Chromium, iPhone 14 viewport (390×844). Covers layout, interactive flows, upgrade sheet, BPM control. Screenshots written to `test/screenshots/`.
  - **React UMD copies required (fresh-container gotcha):** CDN is blocked, so the test maps the React CDN URL to local `test/react.production.min.js` + `test/react-dom.production.min.js`. These are gitignored and **missing in every fresh container** — without them the app never mounts and you get ~22 failures all stemming from `React is not defined` (only 43 checks run, not 68). This is environmental, not a regression. Recovery: `npm install react@18.2.0 react-dom@18.2.0 --no-save --prefix /tmp/react-umd` then copy both `*/umd/react*.production.min.js` into `test/`. Trust `npm test` (unit/gating) there.
  - **Known pre-existing failures:** with React present the baseline is **66/68 pass**. The 2 failures are Play-tab Essentials gating checks (`play-form-row has ≤3 buttons`) — treat as the known baseline, not something you broke.
- **Exploratory harness:** `npm run test:explore` — multi-persona simulation. 4 parallel sessions, each 20 steps, seeded PRNG for reproducibility (`--seed N`). Generates structured report in `test/explore/reports/YYYYMMDD-HHMM/`. Set `ANTHROPIC_API_KEY` for LLM synthesis of findings. Reports dir is gitignored.

## Audio Architecture
- Guitar samples from `nbrosowsky` CDN, pre-fetched as ArrayBuffers on load
- `playGuitarNote(ctx, midi, startTime, sustainSecs, vol)` — biquad EQ chain for jazz tone (warmth boost 180Hz, presence cut 2200Hz, hi-shelf cut 3500Hz)
- `playGuitarChord(ctx, midiNotes, startTime, sustainSecs, vol, strum)` — stagger per string, volume taper
- `playChordPreview(voicing, strings)` — module-level tap-to-preview helper (own `_getPreviewCtx`, independent of the Play tab's `audioCtxRef`). Used by `ChordBox` taps, the Diatonic chord cards, and the Build a Chord Root/Type/Extension selectors (via `previewSelection` in `CustomChordView`). Selector handlers compute tones from the passed args, NOT state — `setState` is async so derived `tones` lag a render. Always previews a shell voicing for consistency.
- `pickStrum(isStab)` — probabilistic strum direction/speed
- Bass: Web Audio API synthesis with `bLowBoost`, `bThump`, `bMidCut`, `bHiCut` filter chain
- Ride cymbal: pre-rendered via `OfflineAudioContext`
- Beat scheduling: `tick()` with `nextTimeRef`, `beatRef`, `barPatternRef`

## Key Architecture Notes
- `app.js` is the only source file — all components, data, audio, styles in one place
- CSS variables in `index.html` for dark/light theme (two blocks: `:root` dark, `:root[data-theme="light"]` light). Theme set via `document.documentElement.dataset.theme`.
- Tonal center colors: `TC = ['#FF6B6B','#4ECDC4','#74C0FC','#FFD43B']` (Root, 3rd, 5th, 7th) — teal restricted to chord-tone contexts only
- **Light-mode contrast:** bright pastels (the TC colors, instrument LED hexes `#74C0FC`/`#86EFAC`/`#FFD43B`) are legible on the dark bg but wash out as *text* on the light bg. Pattern: keep the bright hex for dots/glyphs/glows, but route label/text color through a theme-aware CSS var that darkens in light mode (e.g. `--led-bass-fg`/`--led-guitar-fg`/`--led-ride-fg` for the Play tab BASS/GUITAR/RIDE + MIX labels; `--dot-lbl` for dark-on-pastel chord-tone dots). Add new such vars to **both** `:root` blocks.
- `e()` = `React.createElement` alias used throughout
- `localStorage` keys: `jg-path` (guide done), `jg-path-items` (per-stage checklist), `jg-guide-intro` (Start Here collapsed state), `jg-streak`, `jg-last-practice`, `jg-play-sessions`, `jg-level`, `jg-trial-start` (7-day Pro trial start date), `jg-key`, `jg-bpm`, `jg-form`, `jg-toured`, `jg-eq`/`jg-geq`/`jg-req` (bass/guitar/ride EQ), `jg-faves` (Play favorites), etc.
- `SCALE_HINTS` has dom7 with 4 options including Phrygian Dom
- Unplayable voicings (Chords + Any Chord tabs): `calcVoicing` returns null when a drop voicing needs a wider-than-hand stretch. Handled in 3 layers — (1) a `playableSets` memo flags which string sets yield a shape for the current chord; (2) an effect auto-snaps `ssIdx` away from a dead set to `firstPlayableSet`; (3) dead string-set buttons are disabled/grayed (not removed — keeps layout stable), and when `noDropShape` (no set works at all) the neck is hidden and the full-width `NoShapes` notice shows. Shells/rootless already auto-jump via `firstValidShell`/`firstValidRl`. Don't "fix" the empty fretboard by removing options — disable, don't delete.
- **Fretboard display invariant:** `NeckSVG` only draws 15 frets (`NF=15`), so `calcVoicing` must never return a shape whose max fret exceeds 15 — anything higher renders as a dot floating off the right edge of the neck. When a computed voicing lands above fret 15, `calcVoicing` drops it an octave (even if that introduces an open string or a low-position stretch `spanOK` would otherwise reject) to keep all dots on the board.
- Essentials tier: shell voicings only, major II-V-I only, melodic intervals (consonant) only in ear training, first 4 chord types in Any Chord; gated features show 🔒 badges that trigger UpgradeSheet
- Pro tier: all voicings, all play forms, all ear training modes, all chord types
- **iOS Safari SVG repaint gotcha:** SVG elements that use a `filter` (e.g. the `url(#ng)` blur/glow on NeckSVG highlight dots) do NOT visually repaint on iOS Safari/WebKit when React updates their attributes — they stay stale until a user gesture forces a reflow. This caused the "Keys page chords don't update until I tap them" bug. Fix is to force a GPU compositing layer on the affected `<svg>` via `style:{transform:'translateZ(0)',WebkitTransform:'translateZ(0)'}`. Chromium does not reproduce this — only real iOS Safari does, so it can't be caught by the headless Playwright smoke tests. Apply the same `translateZ(0)` hint to any new filtered SVG that re-renders on state change.
- Voicing selection (`ssIdx`/`invIdx`/`shellIdx`) is **shared App state** between the Keys (diatonic) and Any Chord (`CustomChordView`) views, so the chosen string set/inversion/shape survives the "In a key ↗" / "Explore ↗" bridges and plain tab switches. `CustomChordView`'s reset-on-chord-change effects are skip-on-mount guarded (`typeChangeMount`/`shellResetMount` refs) so a carried-in voicing isn't wiped. Extensions (9/11/13) live **only** in Any Chord — the Keys map is the seven diatonic 7th chords, so jumping to a key shows the underlying 7th in the same voicing geometry.

## Decided Against (don't re-suggest)
- Comping rhythm patterns
- Chord melody examples
- Enclosures
- Guitar tone unlocks / EQ presets labeled as guitar models (sounds like EQ, not like actual guitars)
- Locking Pro version behind achievements (advanced users hit a wall = bad reviews)
- Subscription pricing (one-time $14.99 is the model)

## Pending / Next Session Priorities
1. **PostHog key** — user action: sign up at posthog.com, create project, replace `__POSTHOG_KEY__` in `index.html` with the real API key. Once live, paywall funnel (paywall.shown → upgrade.completed) will be visible.
2. **IAP implementation** — DONE in code (RevenueCat, `IAP` module in `app.js`, `@revenuecat/purchases-capacitor` dep). Remaining is config, not code: (a) enroll in Apple Developer, (b) create the `pro_unlock` non-consumable in App Store Connect, (c) create a RevenueCat project with entitlement `pro` + default offering, (d) replace `__REVENUECAT_IOS_KEY__` in `app.js` with the public iOS SDK key (`appl_…`). NOTE: the 7-day trial is honor-system / client-side only (`jg-trial-start` in localStorage). Fine for launch; if abused, gate via StoreKit intro-offer.
3. **App Store assets** — app icon in all required sizes, screenshots, store description copywriting
4. **Apple Developer enrollment** — user action required, $99, developer.apple.com. Also enroll in Small Business Program (15% cut → ~$12.74 net per sale).
5. **Code audit** — re-renders, audio memory leaks, edge cases in `calcVoicing`/`calcFingering`
6. **Add Capacitor Local Notifications** — practice streak reminders (defer until after first TestFlight build)
