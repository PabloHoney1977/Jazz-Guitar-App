// Android release-path tests.
//
// The Android build shares every line of app.js with iOS, which is exactly why
// it can break silently: the code that differs per platform is a handful of
// branches, and getting one wrong doesn't fail a build — it fails a purchase,
// or quits the app under a user's thumb. These are static checks on the shipped
// files (no browser, no Android SDK), covering the three things that have no
// other guard:
//
//   1. the RevenueCat key is chosen per platform (one hardcoded key means the
//      Play build configures the SDK with an App Store key and every purchase
//      dies at the dialog);
//   2. the hardware back button is handled (Capacitor's default quits the app
//      from any tab — the app is one page with no history stack);
//   3. the release pipeline can actually produce an uploadable AAB.
//
// The back button's *behaviour* is covered by smoke Test 28, which drives a
// fake Capacitor bridge in a real browser. This file only guards that the
// wiring exists at all.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const exists = (f) => fs.existsSync(path.join(ROOT, f));

const app = read('app.js');
const pkg = JSON.parse(read('package.json'));
const capConfig = JSON.parse(read('capacitor.config.json'));

test('the Android platform is committed, like ios/', () => {
  for (const f of [
    'android/app/build.gradle',
    'android/app/src/main/AndroidManifest.xml',
    'android/gradlew',
    'android/variables.gradle',
  ]) {
    assert.ok(exists(f), f + ' is missing — run `npx cap add android` and commit it');
  }
});

test('@capacitor/android and @capacitor/app are declared dependencies', () => {
  // @capacitor/app is what delivers the backButton event. Without it Capacitor
  // falls back to its default handling, which exits the app.
  for (const dep of ['@capacitor/android', '@capacitor/app']) {
    assert.ok(pkg.dependencies[dep], dep + ' must be a dependency');
  }
});

test('the Android applicationId matches the Capacitor appId', () => {
  const gradle = read('android/app/build.gradle');
  const m = gradle.match(/applicationId\s+"([^"]+)"/);
  assert.ok(m, 'applicationId not found in android/app/build.gradle');
  assert.equal(m[1], capConfig.appId,
    'a mismatched applicationId ships as a different app on Play than the one RevenueCat and Play Console are configured for');
});

test('the RevenueCat key is selected per platform, not hardcoded', () => {
  assert.ok(/function apiKey\(\)\{return isAndroid\(\)\?ANDROID_KEY:IOS_KEY;\}/.test(app),
    'IAP must pick its SDK key per platform via apiKey()');
  const ios = app.match(/const IOS_KEY='([^']*)'/);
  const android = app.match(/const ANDROID_KEY='([^']*)'/);
  assert.ok(ios && android, 'both IOS_KEY and ANDROID_KEY must be defined');
  assert.ok(ios[1].startsWith('appl_'), 'the iOS key must be a public appl_… key');
  assert.ok(android[1].startsWith('goog_') || android[1].startsWith('__'),
    'the Android key must be a public goog_… key, or an unset __PLACEHOLDER__ (which fails closed)');
});

test('an unset SDK key leaves purchases fail-closed', () => {
  // keySet() is what stands between "no key configured" and handing Pro out.
  assert.ok(/function keySet\(\)\{return !apiKey\(\)\.startsWith\('__'\);\}/.test(app),
    'keySet() must gate on the placeholder prefix');
  assert.ok(/function available\(\)\{return !!plug\(\)&&keySet\(\);\}/.test(app),
    'available() must require BOTH the native plugin and a configured key');
});

test('the Android hardware back button is handled', () => {
  assert.ok(app.includes("addListener('backButton'"),
    "no backButton listener — Capacitor's default back handling quits the app from any tab");
  assert.ok(/if\(!backRef\.current\(\)\)\{try\{P\.exitApp\(\);\}catch\(ex\)\{\}\}/.test(app),
    'exitApp must be the fallback only, reached when the handler declined to consume the press');
  // The layers the handler must peel off before it ever lets the app exit.
  for (const guard of ['if(upgradeSheet)', 'if(aboutOpen)', 'if(showOnboard)', "if(viewMode!=='guide')"]) {
    assert.ok(app.includes(guard), 'back handler must handle ' + guard + ' before exiting');
  }
});

test('the build can produce an uploadable AAB', () => {
  const gradle = read('android/app/build.gradle');
  assert.ok(/versionCode jglVersionCode/.test(gradle),
    'versionCode must come from -PjglVersionCode — Play rejects a re-used version code');
  assert.ok(gradle.includes('CM_KEYSTORE_PATH'),
    'the release build type must pick up the CI keystore');

  const yml = read('codemagic.yaml');
  assert.ok(/^\s{2}android-play:/m.test(yml), 'codemagic.yaml needs the android-play workflow');
  const wf = yml.slice(yml.indexOf('  android-play:'));
  assert.ok(wf.includes('npx cap sync android'),
    'CI must sync the web assets into the Android project, or it ships a stale app');
  assert.ok(wf.includes('bundleRelease'), 'Play requires an App Bundle (.aab), not an .apk');
  assert.ok(wf.includes('google_play:'), 'the workflow must publish to Google Play');
});

test('the copied web assets are not committed to the Android project', () => {
  // android/app/src/main/assets/public is `cap sync` output, regenerated on
  // every build — same reason www/ is gitignored.
  const ignore = read('android/.gitignore');
  assert.ok(ignore.includes('app/src/main/assets/public'),
    'the copied web assets must stay out of git');
});
