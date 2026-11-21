// Streak reminder timing. Regression guard for the bug where practising in the
// morning scheduled "practice today to keep it going" for 7 pm the SAME day —
// a reminder to do something the user had already done.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

// Execute the real Notif module out of app.js, not a copy of it.
function loadNotif() {
  const m = SRC.match(/const Notif=\(\(\)=>\{[\s\S]*?\n\}\)\(\);/);
  assert.ok(m, 'Notif module not found in app.js');
  const ctx = { window: {}, Date };
  vm.runInNewContext(m[0] + '\nthis.Notif=Notif;', ctx);
  return ctx.Notif;
}
const { reminderTime } = loadNotif();
const at = (h, min = 0) => new Date(2026, 10, 21, h, min, 0, 0); // Nov 21 2026, local

test('practised this morning → reminder is tomorrow 7 pm, not tonight', () => {
  const r = reminderTime(true, at(10));
  assert.equal(r.getDate(), 22);
  assert.equal(r.getHours(), 19);
});

test('practised late at night → still tomorrow 7 pm', () => {
  const r = reminderTime(true, at(23, 30));
  assert.equal(r.getDate(), 22);
  assert.equal(r.getHours(), 19);
});

test('not practised yet, before 7 pm → tonight 7 pm', () => {
  const r = reminderTime(false, at(10));
  assert.equal(r.getDate(), 21);
  assert.equal(r.getHours(), 19);
});

test('not practised yet, after 7 pm → tomorrow 7 pm', () => {
  const r = reminderTime(false, at(20));
  assert.equal(r.getDate(), 22);
});

test('month rollover is handled', () => {
  const r = reminderTime(true, new Date(2026, 10, 30, 9));
  assert.equal(r.getMonth(), 11);
  assert.equal(r.getDate(), 1);
});

test('markPracticed schedules with practicedToday=true on both paths', () => {
  assert.ok(SRC.includes('Notif.requestPermission().then(()=>Notif.schedule(newStreak,true))'));
  assert.ok(SRC.includes('else{Notif.schedule(newStreak,true);}'));
});
