const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./helpers/load-typescript.cjs');

function harness({ admin = true, consumeAccepted = true } = {}) {
  const calls = [];
  const route = load('app/api/limitless/inspections/route.ts', {
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200 }) } },
    '@/lib/admin-auth': { getAdminSession: async () => admin ? { email: 'operator@fixture.test', issuedAt: 12345 } : null },
    '@/lib/admin-organization-scope': { resolveAdminOrganizationScope: async () => ({ kind: 'system', systemId: 'limitless-realty', organizationId: 'fixture-limitless-id' }) },
    '@/lib/limitless-api-auth': { requireAutomationApiKey: () => ({ ok: true }) },
    '@/lib/leo-action-approval': {
      createLeoActionApproval: async input => { calls.push(['approval_create', input]); return { approvalId: 'approval-fixture', token: 'token-fixture', status: 'issued' }; },
      consumeLeoActionApproval: async input => { calls.push(['approval_consume', input]); return consumeAccepted ? { accepted: true, status: 'accepted', approvalId: input.approvalId } : { accepted: false, status: 'consumed', approvalId: input.approvalId }; },
    },
    '@/lib/limitless-inspections': {
      LIMITLESS_REALTY_ORGANIZATION_ID: 'fixture-limitless-id',
      requestLimitlessInspection: async input => { calls.push(['request', input]); return { id: 'request-id', status: 'requested' }; },
      bookLimitlessInspection: async input => { calls.push(['book', input]); return { id: 'booked-id', status: 'booking_pending' }; },
      updateLimitlessInspectionStatus: async input => { calls.push(['update', input]); return { id: 'status-id', status: input.status }; },
      listLimitlessInspections: async () => [],
    },
  });
  return { route, calls };
}

const request = body => ({ json: async () => body, headers: { get: () => null }, url: 'https://local.test/api/limitless/inspections' });

test('legacy admin booking needs explicit confirmation and consumes an exact single-use Leo appointment approval', async () => {
  const h = harness();
  const denied = await h.route.POST(request({ scheduledAt: '2030-01-02T12:00:00Z', confirmed: true }));
  assert.equal(denied.status, 400);
  assert.equal(h.calls.length, 0);

  const accepted = await h.route.POST(request({ scheduledAt: '2030-01-02T12:00:00Z', confirmBooking: 'yes', inspectionId: 'inspection-fixture', propertyId: 'property-fixture' }));
  assert.equal(accepted.status, 201);
  assert.equal(accepted.body.approvalId, 'approval-fixture');
  const issued = h.calls.find(([kind]) => kind === 'approval_create')[1];
  const consumed = h.calls.find(([kind]) => kind === 'approval_consume')[1];
  assert.equal(issued.toolKey, 'leo.appointment.manage');
  assert.equal(issued.identity.userId, 'operator@fixture.test');
  assert.equal(issued.identity.organizationId, 'fixture-limitless-id');
  assert.equal(issued.sessionId, 'limitless-inspections:operator@fixture.test:12345');
  assert.equal(issued.arguments.operation, 'book');
  assert.deepEqual(consumed.arguments, issued.arguments);
  assert.equal(consumed.approvalId, 'approval-fixture');
  assert.equal(consumed.token, 'token-fixture');
  assert.deepEqual(h.calls.map(([kind]) => kind), ['approval_create', 'approval_consume', 'book']);
  assert.equal(JSON.stringify(accepted.body).includes('token-fixture'), false, 'the approval token is not returned in the API response');
});

test('legacy admin status changes use a distinct exact approval and abort if its one-time consume fails', async () => {
  const h = harness();
  const accepted = await h.route.PATCH(request({ status: 'completed', inspectionId: 'inspection-fixture', confirmStatusChange: 'yes' }));
  assert.equal(accepted.status, 200);
  const issued = h.calls.find(([kind]) => kind === 'approval_create')[1];
  const consumed = h.calls.find(([kind]) => kind === 'approval_consume')[1];
  assert.equal(issued.arguments.operation, 'status_change');
  assert.equal(issued.arguments.status, 'completed');
  assert.deepEqual(consumed.arguments, issued.arguments);
  assert.equal(h.calls.at(-1)[0], 'update');

  const replay = harness({ consumeAccepted: false });
  const rejected = await replay.route.PATCH(request({ status: 'completed', inspectionId: 'inspection-fixture', confirmStatusChange: 'yes' }));
  assert.equal(rejected.status, 409);
  assert.equal(replay.calls.some(([kind]) => kind === 'update'), false, 'no mutation runs when the one-time approval is rejected');
});

test('automation API keys can create requests but cannot book or change inspection status', async () => {
  const h = harness({ admin: false });
  const created = await h.route.POST(request({ leadId: 'lead-fixture', propertyQueryText: 'Apartment in fixture area' }));
  assert.equal(created.status, 201);
  assert.equal(h.calls[0][0], 'request');
  const denied = await h.route.POST(request({ scheduledAt: '2030-01-02T12:00:00Z', confirmBooking: 'yes' }));
  assert.equal(denied.status, 403);
  const deniedPatch = await h.route.PATCH(request({ status: 'completed', confirmStatusChange: 'yes' }));
  assert.equal(deniedPatch.status, 403);
  assert.equal(h.calls.length, 1);
});
