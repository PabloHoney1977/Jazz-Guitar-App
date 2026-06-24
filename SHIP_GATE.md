# v1.0 Ship Gate — Definition of Done

The purpose of this file is to **end the "one more bug pass" loop**. Bug passes
always find something; "no findings" is never reachable and is not the gate.
The gate is below. When every **Ship-blocker** is checked, **ship** — even if
`BACKLOG.md` is non-empty. Everything not on the blocker list is, by definition,
a post-launch item.

## Rule

1. A new finding is triaged into exactly one bucket: **Ship-blocker** (below) or
   **Backlog** (`BACKLOG.md`). There is no third "maybe before launch" bucket.
2. Only Ship-blockers may delay launch.
3. The feature set is **frozen** (see `CLAUDE.md` → "Decided Against"). No new
   features before v1.0. Post-launch: only blocker bugfixes + marketing until
   real users ask for something specific.

## Ship-blockers (must ALL be green before submitting to Apple)

### Money (the actual gate — see docs/IAP_PLAN.md)
- [ ] Real IAP purchase wired to `doUpgrade()` — currently a stub that grants
      Pro for free (`app.js` ~`function doUpgrade`). **Apple will reject a fake
      paywall**, so this is mandatory, not optional.
- [ ] Real `restorePurchases()` wired to `doRestore()` (App Review tests this).
- [ ] Entitlement is the source of truth, not trusted localStorage. A user must
      not be able to unlock Pro for free, and Pro must survive reinstall.
- [ ] The dev-only "revert to Essentials" affordances (Pro ✦ chip / level
      toggle) are removed or hidden in production builds.

### Stability (on a real device, not just the browser)
- [ ] No crash launching the app cold.
- [ ] No crash exercising each of the 5 tabs: Guide, Keys, Chords, Play, Train.
- [ ] Play tab: start → 4-count-in → loop → stop, repeated 3×, no hang/crash.
- [ ] Audio survives backgrounding the app and returning (iOS suspends AudioContext).
- [ ] No crash in iOS private-browsing / storage-blocked mode (localStorage wrapped — verify).

### State & first run
- [ ] Brand-new user (cleared storage) lands on Guide, onboarding reads cleanly.
- [ ] Progress (streak, path, faves, scores) persists across full app restart.
- [ ] Freemium gates hold: Essentials cannot reach Pro-only voicings/forms/modes.

### Store readiness
- [ ] App icon present in all required sizes; splash screen reviewed.
- [ ] 6.7" + 6.5" + iPad screenshots captured (see docs/APP_STORE_LISTING.md).
- [ ] Listing copy finalized (title/subtitle/keywords/description).
- [ ] Privacy "nutrition label" answered (this app stores only local data — declare accordingly).
- [ ] One successful TestFlight build via Codemagic, installed and smoke-tested on a device.
- [ ] $9.99 non-consumable `pro_unlock` created + "Ready to Submit" in App Store Connect.

## Explicitly NOT blockers (ship with these open)
- Cosmetic / copy / single-pixel layout issues.
- Edge-case logic with no user-visible damage (e.g. the class of bugs found in
  the last review pass — milestone counters, label suffixes, stale refs).
- Anything in the "Pending / Next Session" list in `CLAUDE.md` that isn't money
  or a crash (e.g. local notifications can land in 1.0.1).
- Audio "niceness" tuning (EQ defaults, strum feel, voicing choices).

## When the gate is green
Submit. Then the only allowed work until you have real usage data is:
1. Ship-blocker bugfixes (crash / data-loss / IAP).
2. Marketing & ASO (docs/APP_STORE_LISTING.md).
