/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const load = require('./helpers/load-typescript.cjs');
const sourceRoot = process.env.PHOTOGRAPHY_TEST_SOURCE_ROOT || path.resolve(__dirname, '..');
const availability = load(path.join(sourceRoot, 'lib/photography-booking-conflicts.ts'));
const org = 'studio-a';
const input = { organizationId: org, photographerUserId: 'photographer-a', startAt: '2026-11-19T10:00:00Z', endAt: '2026-11-19T11:00:00Z' };
const existing = { id: 'other-booking', title: 'Existing session', start_at: input.startAt, end_at: input.endAt, status: 'confirmed' };
const safeError = 'Photographer availability could not be verified. Please retry.';

function database(options = {}) {
  const reads = [], writes = [];
  const admin = { from(table) {
    const filters = [];
    let operation = 'read', single = false;
    const query = {
      select() { return this; }, eq(key, value) { filters.push([key, value]); return this; },
      in(key, value) { filters.push([key, value]); return this; },
      maybeSingle() { single = true; return this; }, single() { single = true; return this; },
      insert(value) { operation = 'insert'; writes.push({ table, operation, value }); return this; },
      update(value) { operation = 'update'; writes.push({ table, operation, value }); return this; },
      then(resolve, reject) {
        reads.push({ table, filters, operation, single });
        const fail = table === options.failureTable && (!single || options.currentMetadataFailure);
        if (fail && options.failure === 'reject') return Promise.reject(Error('private provider detail')).then(resolve, reject);
        if (fail) return Promise.resolve({ data: null, error: options.failure === 'missing' ? null : { message: 'private provider detail' } }).then(resolve, reject);
        let data;
        if (single) data = {
          crm_customers: { id: 'customer-a', full_name: 'Synthetic client', email: 'client@example.test' },
          organization_systems: { id: 'system-a' }, organization_memberships: { user_id: 'photographer-a' },
          photography_booking_metadata: { assigned_photographer_id: 'photographer-a' },
          appointments: { id: 'current-booking', start_at: input.startAt, end_at: input.endAt, status: 'confirmed' },
        }[table];
        else data = table === 'photography_booking_metadata'
          ? (options.metadata || [{ appointment_id: 'other-booking' }]) : (options.appointments || []);
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      },
    };
    return query;
  } };
  return { admin, reads, writes };
}

for (const failureTable of ['photography_booking_metadata', 'appointments']) {
  for (const failure of ['error', 'missing', 'reject']) {
    test(`availability rejects ${failureTable} ${failure} without exposing provider details`, async () => {
      const db = database({ failureTable, failure });
      await assert.rejects(availability.findPhotographerConflict({ ...input, admin: db.admin }), error => error.name === 'PhotographyAvailabilityError' && error.message === safeError);
      assert.equal(db.writes.length, 0);
      assert.ok(db.reads.every(read => read.filters.some(([key, value]) => key === 'organization_id' && value === org)));
    });
  }
}

test('verified empty data, adjacent sessions and self exclusion retain their existing behavior', async () => {
  for (const options of [{ metadata: [] }, { appointments: [] }, { appointments: [{ ...existing, start_at: input.endAt, end_at: '2026-11-19T12:00:00Z' }] }]) {
    const db = database(options);
    assert.equal(await availability.findPhotographerConflict({ ...input, admin: db.admin }), null);
  }
  const db = database({ metadata: [{ appointment_id: 'current-booking' }] });
  assert.equal(await availability.findPhotographerConflict({ ...input, admin: db.admin, excludeAppointmentId: 'current-booking' }), null);
  assert.equal(db.reads.length, 1);
});

test('an observed overlap is retained and every read stays tenant scoped', async () => {
  const db = database({ appointments: [existing] });
  const result = await availability.findPhotographerConflict({ ...input, admin: db.admin });
  assert.equal(result.id, existing.id);
  assert.ok(db.reads.every(read => read.filters.some(([key, value]) => key === 'organization_id' && value === org)));
  assert.ok(db.reads[0].filters.some(([key, value]) => key === 'assigned_photographer_id' && value === input.photographerUserId));
});

function routeHarness(options = {}) {
  const db = database(options);
  const mocks = {
    'next/server': { NextResponse: { json: (body, { status = 200 } = {}) => ({ body, status }) } },
    '@/lib/client-auth': { getClientSession: async () => options.anonymous ? null : { organizationId: org, userId: 'owner-a' } },
    '@/lib/client-workspace-onboarding': { getClientOnboardingProfile: async () => ({ industry: 'photography-studio' }) },
    '@/lib/organization-membership': { getOrganizationAccessContext: async () => ({}), assertAnyOrganizationPermission: () => { if (options.denied) throw Error('denied'); } },
    '@/lib/supabase/admin': { createAdminClient: () => db.admin },
    '@/lib/photography-booking-conflicts': availability,
  };
  const create = load(path.join(sourceRoot, 'app/api/portal/bookings/route.ts'), mocks);
  const edit = load(path.join(sourceRoot, 'app/api/portal/bookings/[id]/route.ts'), mocks);
  return { ...db, async call(method) {
    const body = { organizationId: 'forged-other-studio', customerId: 'customer-a', assignedPhotographerId: 'photographer-a', startAt: input.startAt, endAt: input.endAt };
    if (options.currentMetadataFailure) delete body.assignedPhotographerId;
    return method === 'POST' ? create.POST({ json: async () => body }) : edit.PATCH({ json: async () => body }, { params: Promise.resolve({ id: 'current-booking' }) });
  } };
}

for (const method of ['POST', 'PATCH']) {
  for (const failureTable of ['photography_booking_metadata', 'appointments']) {
    test(`${method} returns retryable 503 before any write when ${failureTable} is unavailable`, async () => {
      const route = routeHarness({ failureTable, failure: 'error' });
      const response = await route.call(method);
      assert.equal(response.status, 503);
      assert.equal(response.body.error, safeError);
      assert.equal(route.writes.length, 0);
    });
  }
  test(`${method} retains 409 for a real conflict and success after verified availability`, async () => {
    const conflict = routeHarness({ appointments: [existing] });
    assert.equal((await conflict.call(method)).status, 409);
    assert.equal(conflict.writes.length, 0);
    const clear = routeHarness();
    assert.equal((await clear.call(method)).status, method === 'POST' ? 201 : 200);
    assert.equal(clear.writes.length, 2);
    assert.ok(clear.reads.every(read => read.operation === 'insert' || read.filters.some(([key, value]) => key === 'organization_id' && value === org)));
    assert.ok(clear.writes.filter(write => write.operation === 'insert').every(write => write.value.organization_id === org));
  });
  test(`${method} rejects anonymous and unauthorized callers before database access`, async () => {
    for (const [options, status] of [[{ anonymous: true }, 401], [{ denied: true }, 403]]) {
      const route = routeHarness(options);
      assert.equal((await route.call(method)).status, status);
      assert.equal(route.reads.length, 0);
      assert.equal(route.writes.length, 0);
    }
  });
}

for (const failure of ['error', 'reject']) test(`PATCH cannot treat a current-assignment ${failure} as an unassigned photographer`, async () => {
  const route = routeHarness({ failureTable: 'photography_booking_metadata', failure, currentMetadataFailure: true });
  const response = await route.call('PATCH');
  assert.equal(response.status, 503);
  assert.equal(response.body.error, safeError);
  assert.equal(route.writes.length, 0);
});
