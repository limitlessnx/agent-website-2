const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./helpers/load-typescript.cjs');

const api = load('lib/limitless-data.ts');

test('formatted naira prices normalize to numeric values for Supabase', () => {
  assert.equal(api.parsePropertyPrice('₦3,000,000'), 3000000);
  assert.equal(api.parsePropertyPrice('NGN 3,000,000'), 3000000);
  assert.equal(api.parsePropertyPrice('N650,000'), 650000);
  assert.equal(api.parsePropertyPrice('3m'), 3000000);
  assert.equal(api.parsePropertyPrice('2.5m'), 2500000);
});

test('empty property price becomes null rather than an invalid empty string', () => {
  assert.equal(api.parsePropertyPrice(''), null);
  assert.equal(api.parsePropertyPrice('   '), null);
  assert.equal(api.parsePropertyPrice(null), null);
});

test('invalid property price is rejected with a readable validation message', () => {
  assert.throws(() => api.parsePropertyPrice('Price on request'), /Enter a valid property price/);
  assert.throws(() => api.parsePropertyPrice('₦3m negotiable'), /Enter a valid property price/);
});
