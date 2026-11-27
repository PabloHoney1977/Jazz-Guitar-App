// Streak share card: the pure logic (7-day row, gold line, share text).
// Runs the real code out of app.js. The drawing itself is covered by smoke
// Test 28, which downloads the PNG from a real browser and checks its size.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');

function load(store = {}, platform) {
  const start = SRC.indexOf('// ── Streak share card');
  const end = SRC.indexOf('const CARD_SERIF=');
  assert.ok(start > 0 && end > start, 'share-card block not found in app.js');
  const helpers = SRC.match(/^function localDateStr\(.*$/m)[0];
  const ctx = {
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
    },
    Date, JSON, Set, Math, String, Array,
  };
  ctx.window = platform ? { Capacitor: { getPlatform: () => platform } } : {};
  vm.runInNewContext(
    'const safeLS=(key,fb="")=>{const v=localStorage.getItem(key);return v!==null?v:fb;};' +
    'const safeLSSet=(k,v)=>localStorage.setItem(k,v);' + helpers + '\n' +
    SRC.slice(start, end) +
    '\nthis.api={last7Days,streakLine,streakShareText,logPractice,readPracticeLog,SHARE_MIN_STREAK,APP_STORE_URL,localDateStr};',
    ctx);
  return { api: ctx.api, store };
}

const NOW = new Date(2026, 10, 21, 15, 0).getTime(); // Sat 21 Nov 2026
const day = (n) => { const { api } = load(); return api.localDateStr(NOW - n * 86400000); };

test('7-day row: a 21-day streak fills every dot, oldest → today', () => {
  const { api } = load();
  const d = api.last7Days(21, day(0), [], NOW);
  assert.equal(d.length, 7);
  assert.ok(d.every(x => x.on));
  assert.equal(d[6].day, day(0));
  assert.equal(d.map(x => x.label).join(''), 'SMTWTFS');
});

test('7-day row: not yet practised today leaves today empty', () => {
  const { api } = load();
  const d = api.last7Days(4, day(1), [], NOW);
  assert.deepEqual([...d.map(x => x.on)], [false, false, true, true, true, true, false]);
});

test('7-day row: the practice log shows a grace-day gap the streak count cannot', () => {
  const { api } = load();
  const log = [day(6), day(5), day(4), day(2), day(1), day(0)]; // day 3 missed
  const d = api.last7Days(6, day(0), log, NOW);
  assert.deepEqual([...d.map(x => x.on)], [true, true, true, false, true, true, true]);
});

test('logPractice keeps unique, sorted, last 30 days', () => {
  const { api, store } = load();
  for (let i = 40; i >= 0; i--) api.logPractice(day(i));
  api.logPractice(day(0));
  const log = api.readPracticeLog();
  assert.equal(log.length, 30);
  assert.equal(log[29], day(0));
  assert.ok(JSON.parse(store['jg-practice-log']));
});

test('readPracticeLog survives garbage in storage', () => {
  const { api } = load({ 'jg-practice-log': '{not json' });
  assert.equal(api.readPracticeLog().length, 0);
});

test('gold line', () => {
  const { api } = load();
  assert.equal(api.streakLine(21, 34), 'Two weeks and counting.');
  assert.equal(api.streakLine(40, 40), 'My longest streak yet.');
  assert.equal(api.streakLine(5, 12), 'Building the habit.');
  assert.equal(api.streakLine(8, 30), 'One week down.');
  assert.equal(api.streakLine(31, 60), 'A whole month of jazz.');
});

test('share text is first person, never asks for a rating, links only when the id is set', () => {
  const { api } = load();
  const t = api.streakShareText(21);
  assert.match(t, /^I.ve practiced jazz guitar 21 days in a row/);
  assert.doesNotMatch(t, /rat(e|ing)|review|★|stars?/i);
  if (api.APP_STORE_URL) assert.ok(t.endsWith(api.APP_STORE_URL));
  else assert.doesNotMatch(t, /__|undefined|apps\.apple/);
});

test('share needs a streak worth sharing', () => {
  const { api } = load();
  assert.equal(api.SHARE_MIN_STREAK, 3);
});

test('Save Image needs the photo-library usage string, or iOS kills the app', () => {
  const plist = fs.readFileSync(path.join(ROOT, 'ios/App/App/Info.plist'), 'utf8');
  assert.match(plist, /<key>NSPhotoLibraryAddUsageDescription<\/key>\s*<string>[^<]{10,}<\/string>/);
});

test('native share plugins are declared and registered', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.ok(pkg.dependencies['@capacitor/share']);
  assert.ok(pkg.dependencies['@capacitor/filesystem']);
  const spm = fs.readFileSync(path.join(ROOT, 'ios/App/CapApp-SPM/Package.swift'), 'utf8');
  assert.match(spm, /CapacitorShare/);
  assert.match(spm, /CapacitorFilesystem/);
});

// The merge of the share card into the Android build once shipped an Apple
// App Store link in the Android share text. The link must follow the platform.
test('share text links to Google Play on Android, the App Store on iOS', () => {
  const ios = load({}, 'ios').api.streakShareText(12);
  const android = load({}, 'android').api.streakShareText(12);
  assert.match(ios, /apps\.apple\.com\/app\/id\d+$/);
  assert.match(android, /play\.google\.com\/store\/apps\/details\?id=com\.pablohoney\.jazzguitarlab$/);
  assert.ok(!android.includes('apple.com'), 'Android share text must not link to Apple');
});

test('no hardcoded "App Store" / "Apple ID" in user-facing purchase copy', () => {
  assert.ok(!/setPurchaseErr\('The App Store/.test(SRC), 'purchase error names the App Store on every platform');
  assert.ok(!/No previous purchase found on this Apple ID/.test(SRC), 'restore error names Apple ID on every platform');
});
