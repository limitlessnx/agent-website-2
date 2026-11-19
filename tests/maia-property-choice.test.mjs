import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import load from './helpers/load-typescript.cjs';
const { propertyMediaChoice } = load(fileURLToPath(new URL('../lib/ai/maia-property-media-choice.ts', import.meta.url)));
const choice = (...args) => Array.from(propertyMediaChoice(...args));
test('property enquiries and availability questions do not authorize media delivery', () => {
  for (const message of ['Details on Apo Wasa estate', 'Show me your Abuja estates', 'Do you have images?', 'No, send nothing', 'Send images later']) assert.deepEqual(choice(message), []);
});
test('explicit customer choice authorizes only the requested type', () => {
  assert.deepEqual(choice('Show me pictures'), ['image']);
  assert.deepEqual(choice('Videos please'), ['video']);
  assert.deepEqual(choice('Send the brochure'), ['document']);
});
test('yes accepts a single offered type and requires clarification for multiple types', () => {
  assert.deepEqual(choice('Yes please', 'Would you like to see images of this property?'), ['image']);
  assert.deepEqual(choice('Sure', 'Would you like to watch a video of this property?'), ['video']);
  assert.deepEqual(choice('Yes', 'Would you like to see images or videos of this property?'), []);
  assert.deepEqual(choice('Yes', 'This estate has images.'), []);
});
