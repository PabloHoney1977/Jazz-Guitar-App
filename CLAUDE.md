# Jazz Guitar Lab — Project Context

## Big Picture Goal
Ship Jazz Guitar Lab as a **paid iOS App Store app** targeting adult guitarists who want to learn jazz harmony. Monetization: free Essentials tier (limited features) with a **$9.99 one-time IAP** to unlock Full. No subscription.

**Destination:** Apple App Store via Capacitor (web→native wrapper) + Codemagic (cloud CI/CD build — no Mac required).
**Timeline:** Ship as soon as the product is ready. User has no existing audience and is willing to spend on paid acquisition.
**Apple Developer account:** Not yet set up ($99/year enrollment needed).
**Support:** Simple email channel (no dedicated support infrastructure needed pre-launch).
**Marketing:** Paid ads (Instagram/TikTok/YouTube targeting guitarists). No prior audience to leverage.

## Stack
Single-file React 18 PWA. No build step. CDN React, all inline styles, ~3600 lines in `app.js`. Serve from `main` branch, develop on feature branches. Target: iPad (720px content width) primary, iPhone secondary.

## Active Agent Goals

### 1. UI Specialist
Reduce visual noise and improve consistency.

**Done:**
- Teal (`#4ECDC4`) restricted to chord-tone contexts only (TC[1] = 3rd). All non-harmonic uses replaced with `var(--txt)` or gold `#d4a855`.
- ChordBox selected state: stroke/label → `var(--txt)`, strokeWidth 2.5
- Tour spotlight ring/counter: teal → gold
- Nav tab active color: teal → `var(--txt)`
- Transport controls: flat buttons → LedToggle (LED + label) + stompbox play button
- Onboarding banner + auto-tour trigger removed. ViewMode defaults to `'guide'`.

**Still pending:**
- Visual hierarchy: review font sizes and spacing for clearer information hierarchy

### 2. Music Teacher
Help users learn jazz guitar more effectively through the app.

**Done:**
- Fingering suggestions: added `'finger'` option to DOTS toggle. ChordBox shows finger numbers 1–4 (index–pinky) assigned by fret order; same-fret strings share a finger.

**Decided against (out of scope):**
- Comping rhythm patterns
- Chord melody examples
- Enclosures

### 3. Coding Specialist
Ensure code is bug-free, efficient, and performant.

**Not yet started.** Key areas to audit:
- Any unnecessary re-renders (missing `useCallback`/`useMemo`, unstable object literals in JSX)
- Audio scheduling: verify no memory leaks in AudioContext nodes (disconnected nodes, uncleaned timeouts)
- `calcVoicing` / chord engine: check edge cases and correctness
- ScrollNeck scroll logic: verify scale factor calculation is correct across zoom levels
- `calcFingering`: verify barre detection is accurate for all voicing types

## Key Architecture Notes
- `app.js` is the only source file — all components, data, audio, and styles in one place
- CSS variables in `index.html` for dark/light theme
- Audio: guitar samples from nbrosowsky CDN (pre-fetched as ArrayBuffers on load), OfflineAudioContext ride cymbal pre-rendered, Web Audio API bass
- Tonal center colors: TC = `['#FF6B6B','#4ECDC4','#74C0FC','#FFD43B']` (Root, 3rd, 5th, 7th)
