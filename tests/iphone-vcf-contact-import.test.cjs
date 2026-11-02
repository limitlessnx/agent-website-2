const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');

const source = readFileSync('components/admin/PhoneContactsImporter.tsx', 'utf8');

test('VCF parser accepts parameterized FN/N fields from iPhone exports', () => {
  assert.match(source, /property === "FN"/);
  assert.match(source, /property === "N"/);
  assert.match(source, /split\("\."\)\.pop\(\)/);
  assert.match(source, /decodeVCardValue/);
});

test('VCF parser handles grouped phone properties and prefers mobile numbers', () => {
  assert.match(source, /split\("\."\)\.pop\(\)/);
  assert.match(source, /values\("TEL"\)/);
  assert.match(source, /CELL\|MOBILE/);
});

test('VCF parser supports quoted-printable and folded vCard lines', () => {
  assert.match(source, /QUOTED-PRINTABLE\|QP/);
  assert.match(source, /replace\(/);
  assert.match(source, /TextDecoder\("utf-8"\)/);
});

test('iOS browsers retain the VCF fallback and explain the correct export path', () => {
  assert.match(source, /accept="\.vcf,\.vcard/);
  assert.match(source, /Contacts, select the contacts you want, use Share/);
  assert.match(source, /Import \.vcf file/);
});
