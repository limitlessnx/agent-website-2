const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./helpers/load-typescript.cjs');

const { resolveNamedVerifiedPropertyId } = load('lib/ai/maia-estate-context.ts', {});

function payload(matches) {
  return 'Customer asks about the estate.\nVERIFIED LIMITLESS REALTY PROPERTY SEARCH RESULT:\n' +
    JSON.stringify({ matches }) +
    '\n\nUse the verified property result when answering.';
}

test('resolves a uniquely named estate from the trusted property-search payload', () => {
  const message = 'What are the inspection terms for D Prince Builders Diamond Estate?\n' +
    payload([{ id: 'property-dprince', title: 'D Prince Builders Diamond Estate. Benin.' }]);
  assert.equal(resolveNamedVerifiedPropertyId(message), 'property-dprince');
});

test('resolves a compact brand alias such as dprince builders against the full verified property title', () => {
  const message = 'Is there any fee or preferred inspection date with dprince builders?\\n' +
    payload([{ id: 'property-dprince', title: 'D Prince Builders Diamond Estate. Benin.' }]);
  assert.equal(resolveNamedVerifiedPropertyId(message), 'property-dprince');
});

test('does not guess when the customer names only an ambiguous estate suffix', () => {
  const message = 'Tell me about Diamond Estate\n' + payload([
    { id: 'property-edo', title: 'D Prince Builders Diamond Estate. Benin.' },
    { id: 'property-abuja', title: 'Diamond Estate Abuja' },
  ]);
  assert.equal(resolveNamedVerifiedPropertyId(message), null);
});

test('does not resolve properties not present in the verified search result', () => {
  const message = 'Tell me about D Prince Builders Diamond Estate\n' +
    payload([{ id: 'other-property', title: 'Atlanta City Estate Phase 1' }]);
  assert.equal(resolveNamedVerifiedPropertyId(message), null);
});

test('ignores malformed or absent verified search payloads', () => {
  assert.equal(resolveNamedVerifiedPropertyId('D Prince Builders Diamond Estate'), null);
  assert.equal(resolveNamedVerifiedPropertyId('VERIFIED LIMITLESS REALTY PROPERTY SEARCH RESULT: {bad json'), null);
});
