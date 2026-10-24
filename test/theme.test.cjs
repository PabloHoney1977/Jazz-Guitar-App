// Theme follows the phone (Match phone / Light / Dark).
//
// Two copies of the same rule have to agree: the tiny boot script in
// index.html (runs before first paint, so nothing flashes the wrong colour)
// and initialThemePref() in app.js (what React then uses). If they ever
// disagree, the screen paints one theme and then snaps to the other on every
// launch. So both are executed here against the same table of cases.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const has = (s) => SRC.includes(s);

// [label, saved storage, phone is light?, expected painted theme]
const CASES = [
  ['brand-new install, phone light', {}, true, 'light'],
  ['brand-new install, phone dark', {}, false, 'dark'],
  // The old default saved 'dark' for everyone, so it isn't a real choice.
  ['old default dark, phone light -> follows phone', { 'jg-theme': 'dark' }, true, 'light'],
  ['old default dark, phone dark', { 'jg-theme': 'dark' }, false, 'dark'],
  // 'light' could only be saved by switching on purpose, so it is kept.
  ['deliberate old light, phone dark -> kept', { 'jg-theme': 'light' }, false, 'light'],
  ['chose Dark, phone light', { 'jg-theme-pref': 'dark', 'jg-theme': 'light' }, true, 'dark'],
  ['chose Light, phone dark', { 'jg-theme-pref': 'light' }, false, 'light'],
  ['chose Match phone, phone light', { 'jg-theme-pref': 'auto', 'jg-theme': 'dark' }, true, 'light'],
  ['garbage pref falls back to the migration rule', { 'jg-theme-pref': 'blue' }, true, 'light'],
];

function bootScript() {
  const m = HTML.match(/<script>(\(function\(\)\{try\{[\s\S]*?jg-theme-pref[\s\S]*?)<\/script>/);
  assert.ok(m, 'theme boot script not found in index.html');
  return m[1];
}

function runBoot(store, phoneLight, { noMatchMedia = false } = {}) {
  const meta = { content: '#07070f' };
  const document = { documentElement: { dataset: {} }, getElementById: (id) => (id === 'theme-meta' ? meta : null) };
  const window = noMatchMedia ? {} : { matchMedia: (q) => ({ matches: q.includes('light') ? phoneLight : !phoneLight }) };
  const localStorage = { getItem: (k) => (k in store ? store[k] : null) };
  vm.runInNewContext(bootScript(), { window, document, localStorage });
  return { theme: document.documentElement.dataset.theme === 'light' ? 'light' : 'dark', meta: meta.content };
}

function runApp(store, phoneLight) {
  const fn = SRC.match(/function initialThemePref\(\)\{[\s\S]*?\n\}/);
  assert.ok(fn, 'initialThemePref missing from app.js');
  const ctx = { safeLS: (k, fb = '') => (k in store ? store[k] : fb) };
  vm.runInNewContext(fn[0] + '\nresult=initialThemePref();', ctx);
  const pref = ctx.result;
  return pref === 'auto' ? (phoneLight ? 'light' : 'dark') : pref;
}

for (const [label, store, phoneLight, want] of CASES) {
  test('boot script + app agree: ' + label, () => {
    const boot = runBoot(store, phoneLight);
    assert.equal(boot.theme, want, 'index.html boot script painted the wrong theme');
    assert.equal(runApp(store, phoneLight), want, 'app.js resolved a different theme than it painted');
    assert.equal(boot.meta, want === 'light' ? '#f5f5fa' : '#07070f', 'status-bar colour does not match');
  });
}

test('boot script survives a browser without matchMedia (stays dark)', () => {
  assert.equal(runBoot({}, true, { noMatchMedia: true }).theme, 'dark');
});

test('the app follows the phone live, not just at launch', () => {
  assert.ok(/mq\.addEventListener\('change',on\)/.test(SRC),
    'no prefers-color-scheme listener — iOS auto light/dark at sunset would be ignored');
  assert.ok(has("const theme=themePref==='auto'?(phoneLight?'light':'dark'):themePref;"),
    'resolved theme must come from the preference plus the live phone setting');
  assert.ok(has("safeLSSet('jg-theme-pref',themePref)"), 'the preference is not saved');
});

test('the menu offers all three choices, including the way back to Match phone', () => {
  assert.ok(has("[['auto','Match phone'],['light','☀ Light'],['dark','☾ Dark']]"),
    'Appearance control must offer Match phone / Light / Dark');
  assert.ok(!/toggleTheme|onToggleTheme/.test(SRC), 'old two-state toggle still referenced');
});

test('theme-change notice only targets people the update visibly changed', () => {
  assert.ok(has("safeLS('jg-theme-pref',null)===null&&safeLS('jg-theme',null)==='dark'&&phonePrefersLight()"),
    'notice must require: no prior choice, old dark default saved, phone in light mode');
  assert.ok(has("safeLSSet('jg-theme-notice',themeNotice?'pending':'done')"),
    'everyone else must be marked done on first run so it can never fire later');
  assert.ok(has('const [themeNoticeDeferred]=useState(()=>renameNotice);'),
    'must not show on the same launch as the rename notice');
  assert.ok(/ratePrompt&&!renameNotice&&!themeNoticeVisible\?e\(RatePromptSheet/.test(SRC),
    'rate prompt would stack under the theme notice');
  assert.ok(has("if(choice==='dark') setThemePref('dark');"), '"Switch back to dark" must actually switch');
});

test('the overview tour points people at the ··· menu for light/dark', () => {
  const step = SRC.match(/\{target:'page-tour-btn'[\s\S]*?\}/);
  assert.ok(step, 'tour step for the ··· button missing');
  assert.ok(/light or dark/.test(step[0]), 'tour step must mention choosing light or dark');
  assert.ok(!/gold "\? Tour" button/.test(step[0]),
    'tour describes the "? Tour" button that was folded into ··· in the header rebuild');
});

test('the browser harnesses pin a theme so results do not depend on the host', () => {
  const smoke = fs.readFileSync(path.join(__dirname, 'smoke.cjs'), 'utf8');
  assert.ok(/colorScheme: 'dark'/.test(smoke), 'smoke freshPage must default to a dark phone');
  assert.ok(!/'jg-theme': theme/.test(smoke) && !/'jg-theme': 'light'/.test(smoke),
    'smoke must seed jg-theme-pref (jg-theme alone now means "follow the phone")');
});

test('launch screen has a light and a dark variant at every scale', () => {
  // Can't compile the asset catalog off a Mac, so guard its shape here: a typo
  // or missing file only surfaces as a failed Codemagic build otherwise.
  const dir = path.join(ROOT, 'ios', 'App', 'App', 'Assets.xcassets', 'Splash.imageset');
  const imgs = JSON.parse(fs.readFileSync(path.join(dir, 'Contents.json'), 'utf8')).images;
  for (const scale of ['1x', '2x', '3x']) {
    const at = imgs.filter((i) => i.scale === scale);
    const dark = at.filter((i) => (i.appearances || []).some((a) => a.appearance === 'luminosity' && a.value === 'dark'));
    const any = at.filter((i) => !i.appearances);
    assert.equal(dark.length, 1, scale + ': needs exactly one dark-appearance splash');
    assert.equal(any.length, 1, scale + ': needs exactly one default (light) splash');
    assert.ok(/light/.test(any[0].filename) && !/light/.test(dark[0].filename),
      scale + ': light and dark files are swapped');
  }
  for (const i of imgs) assert.ok(fs.existsSync(path.join(dir, i.filename)), 'missing ' + i.filename);
});
