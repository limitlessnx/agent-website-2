import test from 'node:test';
import assert from 'node:assert/strict';
import load from './helpers/load-typescript.cjs';
function fixture(options = {}) {
  const reads = [], signed = [];
  const tables = {
    organizations: [{ id: 'a', name: 'Garden Hotel' }, { id: 'b', name: 'River Hotel' }],
    hotel_settings: [{ organization_id: 'a', values: { business_name: 'Garden Retreat', escalation_phone: 'PRIVATE' } }, { organization_id: 'b', values: { business_name: 'River Lodge' } }],
    hotel_booking_enquiries: Array.from({ length: 15 }, (_, i) => ({ organization_id: 'a', id: 'stay-' + i, customer_id: 'guest-a', status: 'confirmed', arrival_date: '2026-12-01', departure_date: '2026-12-03', notes: 'PRIVATE', nightly_rate_minor: '999' })).concat([{ organization_id: 'b', id: 'foreign-stay', customer_id: 'guest-b', status: 'enquiry' }]),
    crm_customers: [{ organization_id: 'a', id: 'guest-a', full_name: 'Garden guest', email: 'PRIVATE' }, { organization_id: 'b', id: 'guest-b', full_name: 'River guest' }],
    hotel_catalog_items: [{ organization_id: 'a', id: 'published', room_type_id: 'double', kind: 'room', status: 'published' }, { organization_id: 'a', id: 'draft', room_type_id: 'suite', kind: 'room', status: 'draft' }, { organization_id: 'b', id: 'other', room_type_id: 'double', kind: 'room', status: 'published' }],
    hotel_catalog_media: [{ organization_id: 'a', item_id: 'published', status: 'ready', mime_type: 'image/jpeg', caption: 'Garden room', storage_path: 'a/room.jpg' }, { organization_id: 'a', item_id: 'draft', status: 'ready', mime_type: 'image/jpeg', storage_path: 'PRIVATE' }, { organization_id: 'b', item_id: 'other', status: 'ready', mime_type: 'image/jpeg', storage_path: 'b/room.jpg' }],
  };
  const admin = { from(table) {
    let filters = [], limit = Infinity;
    const q = { select(columns) { reads.push([table, columns]); return q; }, eq(k, v) { filters.push(row => row[k] === v); return q; }, in(k, values) { filters.push(row => values.includes(row[k])); return q; }, order() { return q; }, limit(n) { limit = n; return q; }, maybeSingle() { return run(true); }, then(resolve, reject) { return run(false).then(resolve, reject); } };
    async function run(single) { if (options.fail === table) return { data: null, error: {} }; const rows = tables[table].filter(row => filters.every(f => f(row))).slice(0, limit); return { data: single ? rows[0] || null : rows, error: null }; } return q;
  }, storage: { from() { return { createSignedUrl: async (path, ttl) => { signed.push({ path, ttl }); return options.mediaFail ? { error: {} } : { data: { signedUrl: 'https://media.example/' + path } }; } }; } } };
  const api = load('lib/hotel-overview-details.ts', { '@/lib/supabase/admin': { createAdminClient: () => admin } });
  return { api, reads, signed };
}
test('hotel identity, recent bookings and published room images remain tenant scoped and bounded', async () => {
  const f = fixture(), a = await f.api.loadHotelOverviewDetails('a', ['double', 'suite']), b = await f.api.loadHotelOverviewDetails('b', ['double']);
  assert.equal(a.name, 'Garden Retreat'); assert.equal(b.name, 'River Lodge');
  assert.equal(a.recentBookings.length, 5); assert.equal(a.recentBookings[0].guest_name, 'Garden guest');
  assert.equal(b.recentBookings[0].guest_name, 'River guest'); assert.equal(a.roomPhotos.length, 1);
  assert.ok(!JSON.stringify(a).includes('PRIVATE')); assert.ok(!JSON.stringify(a).includes('River'));
  assert.equal(f.signed[0].path, 'a/room.jpg'); assert.equal(f.signed[0].ttl, 900);
  assert.ok(!f.reads.some(([, columns]) => columns.includes('nightly_rate_minor') || columns.includes('notes') || columns.includes('email')));
});
test('empty hotels get their own identity and empty lists, while data/signing failures remain explicit', async () => {
  const f = fixture(), empty = await f.api.loadHotelOverviewDetails('new', []);
  assert.equal(empty.name, 'Your hotel'); assert.equal(empty.recentBookings.length, 0); assert.equal(empty.roomPhotos.length, 0); assert.equal(f.signed.length, 0);
  await assert.rejects(fixture({ fail: 'hotel_booking_enquiries' }).api.loadHotelOverviewDetails('a', ['double']), /unavailable/);
  await assert.rejects(fixture({ mediaFail: true }).api.loadHotelOverviewDetails('a', ['double']), /unavailable/);
});
