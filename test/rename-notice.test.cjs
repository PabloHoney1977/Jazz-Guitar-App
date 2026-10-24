// One-time rename notice guard (Jazz Guitar Lab -> Archtone).
//
// Static source checks, no browser. The notice is a one-shot thing shown to
// people who already owned the app under its old name, so it is impossible to
// re-test by hand once it has been seen — these assertions are the only thing
// standing between a refactor and either (a) silently showing "we changed our
// name" to brand-new users who never knew the old one, or (b) nagging the same
// person every launch.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const has = (s) => SRC.includes(s);

test('the notice component exists and is rendered', () => {
  assert.ok(has('function RenameNoticeSheet('), 'RenameNoticeSheet component missing');
  assert.ok(has('e(RenameNoticeSheet,{onClose:dismissRenameNotice})'),
    'RenameNoticeSheet is defined but never rendered');
});

test('only shown to people who predate the rename', () => {
  assert.ok(has("!safeLS('jg-rename-seen')&&RENAME_KEYS.some(k=>safeLS(k,null)!==null)"),
    'the notice must be gated on an old-install key, not shown to everyone');
});

test('RENAME_KEYS excludes keys every user gets on first launch', () => {
  // This is the bug this file mainly exists for. jg-viewMode / jg-theme /
  // jg-dotMode / jg-key are written by mount effects for EVERY user, so a
  // brand-new installer would have them by their second launch and would then
  // be told the app was renamed from something they never used.
  const m = SRC.match(/const RENAME_KEYS=\[([\s\S]*?)\];/);
  assert.ok(m, 'RENAME_KEYS list missing');
  const keys = m[1].match(/'[^']+'/g).map((k) => k.slice(1, -1));
  for (const bad of ['jg-viewMode', 'jg-theme', 'jg-dotMode', 'jg-key', 'jg-rename-seen']) {
    assert.ok(!keys.includes(bad),
      bad + ' is written on every first launch — it cannot identify an old install');
  }
  assert.ok(keys.length >= 5, 'RENAME_KEYS got suspiciously short');
});

test('a brand-new install is opted out permanently', () => {
  assert.ok(has("else safeLSSet('jg-rename-seen','1');"),
    'fresh installs must be flagged on first render or they see the notice later');
});

test('dismissing it is remembered, so it cannot nag', () => {
  assert.ok(/function dismissRenameNotice\(\)\{[\s\S]*?safeLSSet\('jg-rename-seen','1'\)/.test(SRC),
    'dismissRenameNotice must persist jg-rename-seen');
});

test('it never stacks with another sheet or a tour', () => {
  assert.ok(has('ratePrompt&&!renameNotice?e(RatePromptSheet'),
    'the rate prompt would render underneath the rename notice');
  assert.ok(has('renameNotice&&!showOnboard&&overviewStep===null'),
    'the notice must not cover onboarding or the first-run tour');
});

test('the copy reassures about progress, not just the name', () => {
  // "Same great product" is not the worry. "Did I lose my progress / will I be
  // charged again" is, which is why this sentence is the load-bearing one.
  assert.ok(has('New name, same app'), 'notice headline changed');
  assert.ok(has('Jazz Guitar Lab is now '), 'the notice must name the old app');
  assert.ok(/your progress, your streak and your Pro unlock all carried over/.test(SRC),
    'the carried-over reassurance is the whole point of the notice');
});

test('the old name stays discoverable in About', () => {
  assert.ok(has("'formerly Jazz Guitar Lab'"),
    'About should keep the old name so it is findable long after the notice is gone');
});

test('the browser harnesses suppress the notice', () => {
  // Every harness seeds jg-toured (and friends), which legitimately marks the
  // session as a pre-rename install — so without an explicit opt-out the sheet
  // covers the UI and every check in that suite fails for the wrong reason.
  for (const rel of ['smoke.cjs', 'audio-engine.cjs', path.join('explore', 'run.cjs')]) {
    const src = fs.readFileSync(path.join(__dirname, rel), 'utf8');
    assert.ok(/jg-rename-seen/.test(src), rel + ' must set jg-rename-seen');
  }
});
