// The Pro price shown in the app must come from the store, not be hardcoded:
// buyers outside the US pay in their own currency, and a sale changes the
// price without a new build. Guards against "$14.99" creeping back into copy.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

test('no hardcoded $14.99 in user-facing strings', () => {
  const offenders = SRC.split('\n')
    .map((l, i) => [i + 1, l])
    .filter(([, l]) => /\$14\.99/.test(l))
    .filter(([, l]) => !/^\s*\/\//.test(l))                 // comments
    .filter(([, l]) => !/const PRO_PRICE_FALLBACK=/.test(l)); // the one fallback
  assert.deepEqual(offenders, [], 'hardcoded price at line(s) ' + offenders.map(o => o[0]).join(', '));
});

function loadPrice(store = {}) {
  const start = SRC.indexOf('// ── Pro price as shown in the app');
  const end = SRC.indexOf('// ── Dev unlock');
  const ctx = {};
  vm.runInNewContext(
    'const safeLS=(k,fb="")=>(k in S?S[k]:fb);const safeLSSet=(k,v)=>{S[k]=String(v)};' +
    SRC.slice(start, end) + '\nthis.api={proPrice,setProPrice};', Object.assign(ctx, { S: store }));
  return ctx.api;
}

test('falls back to $14.99, then uses the store price and caches it', () => {
  const store = {};
  const p = loadPrice(store);
  assert.equal(p.proPrice(), '$14.99');
  assert.equal(p.setProPrice('14,99 €'), true);
  assert.equal(p.proPrice(), '14,99 €');
  assert.equal(store['jg-pro-price'], '14,99 €');
  // next launch starts from the cached store price (right even offline)
  assert.equal(loadPrice(store).proPrice(), '14,99 €');
});

test('ignores junk price strings', () => {
  const p = loadPrice({});
  assert.equal(p.setProPrice(''), false);
  assert.equal(p.setProPrice(null), false);
  assert.equal(p.setProPrice('x'.repeat(40)), false);
  assert.equal(p.proPrice(), '$14.99');
  assert.equal(loadPrice({ 'jg-pro-price': 'y'.repeat(40) }).proPrice(), '$14.99');
});

test('every paywall button and the pricing tour step read proPrice()', () => {
  assert.ok((SRC.match(/'Unlock Pro — '\+proPrice\(\)/g) || []).length >= 4);
  assert.ok(SRC.includes('Pro is {PRICE} once'));
  assert.ok(SRC.includes("split('{PRICE}').join(proPrice())"));
});

test('the live price is fetched from RevenueCat on launch', () => {
  assert.ok(SRC.includes('availablePackages?.[0]?.product?.priceString'));
  assert.ok(/IAP\.price\(\)\.then\(/.test(SRC));
});
