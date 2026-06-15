# Jazz Guitar Lab — Project Context

## Workflow Preferences
- After committing, always push to the appropriate branch immediately — do not wait to be asked.
- The app is served from `main`; always ensure finished work lands on `main` and is pushed.

## Big Picture Goal
Ship Jazz Guitar Lab as a **paid iOS App Store app** targeting adult guitarists who want to learn jazz harmony. Monetization: free Essentials tier (limited features) with a **$9.99 one-time IAP** to unlock Full. No subscription.

**Destination:** Apple App Store via Capacitor (web→native wrapper) + Codemagic (cloud CI/CD build — no Mac required).
**Timeline:** Ship as soon as the product is ready. User has no existing audience and is willing to spend on paid acquisition.
**Apple Developer account:** Not yet set up ($99/year enrollment needed).
**Bundle ID:** `com.pablohoney.jazzguitarlab`
**Support:** Simple email channel (no dedicated support infrastructure needed pre-launch).
**Marketing:** Paid ads (Instagram/TikTok/YouTube targeting guitarists). No prior audience to leverage.

## Stack
Single-file React 18 PWA. No build step. CDN React, all inline styles, ~3650 lines in `app.js`. Serve from `main` branch, develop on feature branches. Target: iPad (720px content width) primary, iPhone secondary.

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
- [ ] Set up $9.99 one-time IAP in App Store Connect (product ID: `full_unlock`)
- [ ] Add Capacitor Local Notifications plugin (for practice streak reminders — defer until after first build succeeds)
- [ ] App icon: needs all required sizes (currently have `icon.svg` and `icons/` — need to verify App Store required sizes)
- [ ] Splash screen: review default Capacitor splash, customize if needed
- [ ] First TestFlight build via Codemagic
- [ ] Internal testing
- [ ] App Store submission

## What's Built (current `app.js` features)
- **5 nav tabs:** Guide, Chords (Diatonic), Any Chord (Custom), Play (II-V-I), Ear Training
- **Essentials / Full tier toggle** — Essentials hides advanced voicing types, extended ear training, advanced scale hints
- **Guide tab:** 13 ordered learning stages with expandable content, mark-done tracking, links to live presets
- **Chords tab:** All 7 diatonic chords in any key, shell/drop2/drop3/rootless voicings, scale overlay, guide tones, fingering numbers
- **Any Chord tab:** All chord types including extensions, find-in-key, custom root picker
- **Play tab (IIVIView):** Backing track with walking bass, ride cymbal, jazz guitar comping. Forms: major/minor II-V-I, jazz blues, tritone sub, sec. dom., custom. Swing feel, variable BPM (35–150). Voice leading, pinned chords, bar-level voicing override.
- **Ear Training tab:** Interval recognition (melodic + harmonic), cadence recognition (II-V, V-I, II-V-I, I-VI, iv-I). Essentials: consonant intervals only. Full: all 12 intervals + cadences mode.
- **Two-tier tour system:** App overview tour (5 steps across nav tabs) + per-page contextual tour for each tab
- **Streak tracking:** 🔥 Xd badge in header. Fires when Play tab session starts. Resets if day is skipped. `playSessions` counted in localStorage. Push notification reminders deferred to Capacitor build.
- **Dark/light theme toggle**
- **Bluetooth page-turner pedal support** (AirTurn / PageFlip keyboard events)
- **PWA:** `manifest.json` + `sw.js` service worker for offline caching

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
- Essentials tier: 5 consonant intervals only in ear training, no cadences tab, no drop3/rootless voicings, first scale hint only per chord

## Decided Against (don't re-suggest)
- Comping rhythm patterns
- Chord melody examples
- Enclosures
- Guitar tone unlocks / EQ presets labeled as guitar models (sounds like EQ, not like actual guitars)
- Locking Full version behind achievements (advanced users hit a wall = bad reviews)
- Subscription pricing (one-time $9.99 is the model)

## Pending / Next Session Priorities
1. **Streak milestones** — brief in-app visual moment when hitting day 3, 7, 30 (no push notifications yet — those come with Capacitor)
2. **Ear training counts toward streak** — currently only Play tab fires `markPracticed()`; ear training rounds should too
3. **Code audit** — re-renders, audio memory leaks, edge cases in `calcVoicing`/`calcFingering`
4. **App Store assets** — app icon in all required sizes, screenshots, store description copywriting
5. **IAP implementation** — `@capacitor/purchases` or RevenueCat for the $9.99 Full unlock
6. **Apple Developer enrollment** — user action required, $99, developer.apple.com
