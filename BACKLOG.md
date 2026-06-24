# Backlog — post-launch, non-blocking

Parking lot for findings that are NOT v1.0 ship-blockers (see `SHIP_GATE.md`).
Nothing here delays launch. Pull from here for point-releases after 1.0.

## Known minor issues (from bug-review passes)
- [ ] **Streak-bump on reset.** `GuideView` shows a "🔥 N-day streak!" bump when
      the streak changes; on a reset to 1 it can still bump. Harmless, rare.
- [ ] **Milestone "next badge" precision.** Header tooltip advertises day-100
      (now fires after fix); the 60/180 cards reuse the generic %30 copy path
      for non-listed 30-multiples (90/120/150). Cosmetic.
- [ ] **`markPracticed` closure staleness.** When fired from the Play tab `tick`
      after 4 loops, it can close over a slightly stale `streak`/`lastPracticeDay`.
      Guarded by the same-day early-return; no real-world impact. Proper fix =
      move streak state to refs. Defer unless it surfaces.
- [ ] **Per-bar voicing label during playback** now uses active per-bar values
      (fixed); revisit if per-bar overrides get more UI.

## Deferred features (intentional, from CLAUDE.md "Pending")
- [ ] Capacitor Local Notifications wiring for streak reminders (dep already
      installed; defer to 1.0.1 after first TestFlight build succeeds).
- [ ] Code audit follow-ups: re-render churn, audio node cleanup, edge cases in
      `calcVoicing`/`calcFingering`.

## Ideas (do NOT build pre-launch — validate with real users first)
- Anything not already in the app. Freeze holds until usage data exists.

---
**Triage discipline:** when a new finding appears, it goes here or onto the
Ship-blocker list in `SHIP_GATE.md`. Never a third "maybe" bucket.
