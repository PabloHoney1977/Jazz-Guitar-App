# Google Play listing — assets and answers

Everything here is Android-only. Nothing in this folder ships inside the app or
touches the iOS build.

Regenerate the rendered assets with:

    node play-store/render-assets.cjs

## What's in here

| File | Play requirement |
|---|---|
| `icon-512.png` | 512×512, 32-bit PNG, **full bleed, no transparency** — Play applies its own rounding |
| `feature-graphic-1024x500.png` | 1024×500, required, **no Apple equivalent** |
| `screenshots/01-play … 05-guide.png` | 1080×2160 each; min 2, max 8 |

**Why 1080×2160 and not the App Store's 390×844 shape:** Play rejects a phone
screenshot more than twice as tall as it is wide. A 390×844 viewport is 9:19.5
and would be refused, so these render at a 432×864 viewport × 2.5.

The screenshots are rendered with the app in **Pro** tier and a 12-day streak, so
the listing shows the product at full strength.

## Listing copy

**App name** (30 char limit) — `Jazz Guitar Lab` (15)

**Short description** (80 char limit):

> Learn jazz harmony on guitar: voicings, backing tracks and ear training.

(72 characters.)

**Full description** (4000 char limit):

> Jazz Guitar Lab teaches the harmony behind jazz guitar — the voicings, the
> progressions, and the ear that ties them together.
>
> A 16-stage guide takes you in order, from shell voicings through drop 2, drop 3
> and rootless shapes, so you always know what to practise next.
>
> **See every chord on the neck.** All seven diatonic chords in any key, plus any
> chord you can name — extensions, alterations and all — drawn on the fretboard
> with guide tones, intervals and fingerings. Tap any shape to hear it.
>
> **Play with a band.** A backing track with walking bass, jazz guitar comping and
> a real ride cymbal, from 35 to 150 BPM with swing feel. Major and minor ii-V-I,
> jazz blues, turnarounds, tritone subs, and the changes to five standards.
> Everything is voice-led, and you can pin or re-voice any bar.
>
> **Train your ear.** Intervals melodic and harmonic, triads, seventh chords and
> cadences, in graded levels.
>
> **Practical details.** Works completely offline — there is nothing to log into
> and no account to make. No ads. No subscription: the app is free, and a single
> $14.99 purchase unlocks everything, once, forever.
>
> Chord changes only — no melodies, lyrics or recordings of copyrighted songs.

## Data safety — READ BEFORE FILLING THIS IN

⚠️ **Do not copy the App Store answer over.** The iOS listing declares *Data Not
Collected*, which is right for the app's own code — PostHog is still off and the
key is a placeholder. But **RevenueCat's SDK transmits purchase receipts and an
app-user ID to RevenueCat's servers**, and Play's Data safety form asks about
every SDK you bundle, not just your own code.

The likely correct Play answers are:

- **Purchase history** — collected, not shared, used for *App functionality*
  (unlocking a paid feature). Not optional, since the purchase is the mechanism.
- **Device or other IDs** — check RevenueCat's own published Data-safety guidance
  for whether its anonymous app-user ID counts; answer accordingly.
- Everything else — not collected.
- Data is **not** used for advertising or tracking, and there is no account, so
  the account-deletion URL requirement does not apply.

**This is worth a second look at the live Apple declaration too.** If RevenueCat
counts as collection on Play, the same reasoning may apply to the App Store
privacy labels, which currently say nothing is collected. Confirm against
RevenueCat's docs rather than taking this note as settled.

## Content rating (IARC questionnaire)

Category: **Reference / Education**. No violence, sexuality, profanity, gambling,
drugs, or user-generated content. No location sharing, no user-to-user
communication. Digital purchases: **yes** ($14.99 non-consumable). Expected
outcome: Everyone / PEGI 3.

Other declarations: no ads · target audience 13+ (or 18+, it makes no practical
difference here) · not a news app · no financial features · not government.

## App access

Nothing is behind a login. Pro is unlocked by purchase, so add a note for the
reviewer saying so, and add yourself as a **license tester** in Play Console
(Setup → License testing) if you want to exercise the paywall without being
charged.

## Setup still to do, in order

1. **Play Console account — register as the ORGANIZATION (Highland Music LLC).**
   $25 one-time. New *personal* accounts must run a closed test with ~12 testers
   for 14 continuous days before production; organizations are exempt. Verify the
   current rule in Console — the threshold has moved before.
2. **Upload keystore.** Generate once, then **back it up somewhere that is not
   Codemagic**:

       keytool -genkeypair -v -keystore jgl-upload.jks -alias jgl-upload \
         -keyalg RSA -keysize 4096 -validity 10000

   Upload it in Codemagic under the reference name **`jgl_upload_keystore`**
   (that exact string is what `codemagic.yaml` expects). Enrol in Play App
   Signing at first upload — it is the only recovery path if the key is lost.
3. **Google Cloud service account** with *Release to testing tracks* + *Release to
   production* granted in Play Console → Users and permissions. Paste the whole
   JSON key as `GCLOUD_SERVICE_ACCOUNT_CREDENTIALS` in a Codemagic variable group
   named **`google_play_credentials`**.
4. **Create the app in Play Console** and add `pro_unlock` as a **one-time
   product** at $14.99, matching the App Store product ID exactly.
5. **RevenueCat**: add the Play app to the **same project**, attach the Play
   `pro_unlock` to the **same `pro` entitlement**, then paste the public
   `goog_…` key into `ANDROID_KEY` in `app.js`. Until that key is set, the
   Android paywall fails closed — it will not give Pro away, but it cannot sell
   either.
6. **First upload** goes to the `internal` track (the `android-play` Codemagic
   workflow is already pointed there). Play will not take a production release
   until the app has passed its first review.
7. **Trader/address exposure repeats here.** Play publishes a developer email and
   physical address. Use the motel address (708 Water St, Genoa WI), not the home
   one — the same mistake the EU App Store listing is currently living with.
