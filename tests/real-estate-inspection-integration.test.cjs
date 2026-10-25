const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const load = require('./helpers/load-typescript.cjs');

const org = 'b15f21b4-5697-4d21-9421-8a34eae3476d';
const inspection = {
  id: 'inspection-1', organization_id: org, legacy_lead_id: 'lead-1', crm_lead_id: null,
  customer_id: 'customer-1', property_id: 'property-1', property_query_text: null,
  property_verification_status: 'verified', requested_start_at: null, requested_end_at: null,
  timezone: 'Africa/Lagos', status: 'requested', source: 'limitless_automation', notes: null,
  created_at: '2026-10-24T08:00:00.000Z', updated_at: '2026-10-24T08:00:00.000Z',
};

function query(data) {
  const q = {
    select() { return q; }, eq() { return q; }, in() { return q; }, order() { return q; }, limit() { return q; },
    maybeSingle() { return Promise.resolve({ data: Array.isArray(data) ? data[0] || null : data, error: null }); },
    then(resolve, reject) { return Promise.resolve({ data: Array.isArray(data) ? data : [], error: null }).then(resolve, reject); },
  };
  return q;
}

function facadeAdmin() {
  return {
    from(table) {
      if (table === 'properties') return query({ title: 'Verified Listing' });
      if (table === 'real_estate_inspection_jobs') return query([]);
      return query(null);
    },
  };
}

test('Limitless facade keeps missing requested time as intent and preserves legacy response fields', async () => {
  const calls = [];
  const facade = load('lib/limitless-inspections.ts', {
    '@/lib/real-estate-timezone':{realEstateDateTimeToIso:(v)=>v,validateTimeZone:v=>v},
    '@/lib/supabase/admin': { createAdminClient: facadeAdmin },
    '@/lib/real-estate-inspections': {
      requestRealEstateInspection: async (input) => { calls.push(input); return inspection; },
      listRealEstateInspections: async () => [],
      loadRealEstateInspection: async () => inspection,
      approveRealEstateInspection: async () => ({ inspection }),
      resolveLimitlessSourceSystemId: async () => 'installation-1',
      cancelRealEstateInspection: async () => ({ inspection }),
      rescheduleRealEstateInspection: async () => ({ inspection }),
      recordRealEstateInspectionOutcome: async () => ({ inspection }),
    },
  });
  const result = await facade.requestLimitlessInspection({ leadId: 'lead-1', propertyId: 'property-1' });
  assert.equal(calls[0].requestedStartAt, null);
  assert.equal(result.lead_id, 'lead-1');
  assert.equal(result.property_name, 'Verified Listing');
  assert.equal(result.scheduled_at, null);
  assert.equal(result.status, 'requested');
});

test('inspection integration contracts never use retired limitless_inspections and keep booking pending until canonical event', () => {
  const service = fs.readFileSync('lib/real-estate-inspections.ts', 'utf8');
  const facade = fs.readFileSync('lib/limitless-inspections.ts', 'utf8');
  const route = fs.readFileSync('app/api/limitless/inspections/route.ts', 'utf8');
  assert.doesNotMatch(service, /from\(["']limitless_inspections["']\)/);
  assert.doesNotMatch(facade, /from\(["']limitless_inspections["']\)/);
  assert.match(service, /resolveCanonicalCustomer/);
  assert.match(service, /booking_idempotency_key/);
  assert.match(service, /status: "booking_pending"/);
  assert.match(service, /Canonical appointment customer does not match inspection customer/);
  assert.match(route, /resolveAdminOrganizationScope/);
  assert.match(route, /systemId !== "limitless-realty"/);
  assert.match(route, /requestLimitlessInspection/);
});

test('inspection worker claims atomically, requires explicit schedule opt-in, and tracks provider acceptance separately from receipts', () => {
  const worker = fs.readFileSync('lib/real-estate-inspection-worker.ts', 'utf8');
  const scheduler = fs.readFileSync('app/api/cron/real-estate-inspections/route.ts', 'utf8');
  const safetyNet = fs.readFileSync('app/api/cron/maia-safety-net/route.ts', 'utf8');
  assert.match(worker, /claim_real_estate_inspection_job/);
  assert.match(worker, /organizationId is required/);
  assert.match(worker, /industry.*realestate/);
  assert.match(worker, /customer_opted_out/);
  assert.match(worker, /active_handoff/);
  assert.match(worker, /customer_replied/);
  assert.match(worker, /const deliveryStatus = "accepted"/);
  assert.match(worker, /provider_message_id: providerMessageId/);
  assert.match(worker, /delivery_status: "unknown"/);
  assert.match(worker, /delivery_status_received_at:null/);
  assert.match(worker, /retry_safe: false/);
  assert.match(worker, /outcome_followup/);
  assert.match(scheduler, /list_due_real_estate_inspection_organizations/);
  assert.match(scheduler, /limit:5/);
  assert.match(safetyNet, /externalSchedulerAuthorized\) tasks\.push\(\{ task: "real-estate-inspections"/);
  assert.doesNotMatch(scheduler, /from\("organizations"\)/);
});

test('calendar adapter only diverts explicitly flagged real-estate inspection events', () => {
  const adapter = fs.readFileSync('lib/system-event-adapters.ts', 'utf8');
  assert.match(adapter, /input\.event\.source !== "real_estate_inspection"/);
  assert.match(adapter, /reconcileRealEstateInspectionFromAppointment/);
  assert.match(adapter, /appointment\.metadata/);
});
