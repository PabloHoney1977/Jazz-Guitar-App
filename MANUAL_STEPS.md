# What still has to be clicked by hand

Apple and Google don't offer an API for these steps. Each takes a few minutes, and most happen once per app.
Everything else (listing text, screenshots, versions, builds, submitting, track promotion) runs through `fastlane`.

## Once per developer account

**Apple: App Store Connect API key**
1. App Store Connect → Users and Access → Integrations → App Store Connect API → Team Keys → **+**.
2. Name it `fastlane`, role **App Manager**. Download the `.p8` file; Apple lets you download it only once.
3. Add GitHub secrets `ASC_KEY_ID` (Key ID), `ASC_ISSUER_ID` (Issuer ID at the top of the page), and `ASC_KEY_CONTENT` (paste the whole `.p8` file).
   The same three secrets work for every app repo. An org-wide secret means you only set them once.

**Google: Play service account**
1. Google Cloud console → create a project, e.g. `play-publishing` → enable **Google Play Android Developer API**.
2. IAM → Service accounts → create one → Keys → Add key → JSON. Download it.
3. Play Console → Users and permissions → Invite new users → paste the service account's email.
   Grant **Admin (all permissions)**, or at least *Release apps*, *Manage store presence* and *View app information*.
4. Add the GitHub secret `PLAY_JSON_KEY_DATA` (paste the whole JSON file).

## Once per app: Apple

- [ ] **Bundle ID.** Codemagic's `fetch-signing-files --create` makes the bundle ID and signing files automatically. Nothing to do if you build there.
- [ ] **App record.** App Store Connect → Apps → **+** → New App: platform, name, language, bundle ID, SKU. (There's no API for this.)
- [ ] **App Privacy** ("nutrition label"): App → App Privacy. Not in the API.
- [ ] **Age rating** questionnaire: App Information → Age Rating. Do it once; it carries over to every version.
- [ ] **Pricing and availability**, plus **in-app purchases** if the app has them. Attach a new IAP to the first version submitted with it.
- [ ] **Content rights** declaration (App Information).
- [ ] First build: push to `main`, then Codemagic uploads it to TestFlight.

From then on: edit `store/store.yml` → `ios metadata` → `ios submit` → press **Release** after approval.

## Once per app: Google

- [ ] **Create app.** Play Console → Create app: name, language, app/game, free/paid, and the declarations. (There's no API for this.)
- [ ] **First upload must be manual.** Upload the first `.aab` in Play Console (an internal testing release is fine). After that, `android release` works.
- [ ] **App content** section, all form-only:
  - Privacy policy URL, App access, Ads
  - Content rating questionnaire
  - Target audience
  - Data safety
  - Government apps / financial features / health declarations
- [ ] **Store settings:** category, contact email.
- [ ] **Testing requirement (personal accounts only).** Accounts registered as an organization (your LLC) are exempt. A *personal* developer account must run a closed test with at least 12 testers for 14 days before it can apply for production.
- [ ] Graphics: Google requires `feature.png` (1024×500) and `icon.png` (512×512) before the first release. Put them in `store/screenshots/android/en-US/`.

From then on: `android release aab:… track:internal` → test → `android promote from:internal to:production`.

## Every release (Apple)

`ios submit` handles export compliance (when `ITSAppUsesNonExemptEncryption` is `false` in Info.plist) and the IDFA question.
If Apple asks something new on submission, fastlane stops and prints it. Answer it once in App Store Connect, then re-run.
