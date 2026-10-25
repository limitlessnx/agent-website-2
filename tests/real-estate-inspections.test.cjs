const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const load = require('./helpers/load-typescript.cjs');

const org = '11111111-1111-4111-8111-111111111111';
const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

test('production policy keeps unresolved properties unresolved and requires an external event to confirm', () => {
  const policy = load('lib/real-estate-inspection-policy.ts');
  const unresolved = policy.propertyVerificationForInput({ propertyId: 'unknown', propertyQueryText: 'Lekki apartment', propertyIsActive: false });
  assert.equal(unresolved.propertyId, null);
  assert.equal(unresolved.status, 'unresolved');
  assert.equal(unresolved.queryText, 'Lekki apartment');
  assert.equal(policy.canTransitionInspection('requested', 'booking_pending'), true);
  assert.equal(policy.canTransitionInspection('completed', 'booked'), false);
  assert.equal(policy.appointmentEventCanConfirm({ eventType: 'appointment.booked', appointmentStatus: 'confirmed', externalEventId: null }), false);
  assert.equal(policy.appointmentEventCanConfirm({ eventType: 'appointment.booked', appointmentStatus: 'confirmed', externalEventId: 'provider-event-1' }), true);
  assert.equal(policy.reminderSchedule(future).length, 3);
});

test('inspection worker requires explicit tenant schedule opt-in and suppresses stale appointment reminders', () => {
  const worker = fs.readFileSync('lib/real-estate-inspection-worker.ts','utf8');
  assert.match(worker,/real_estate_inspection_automation/);
  assert.match(worker,/setting\.data\?\.status !== "enabled"/);
  assert.match(worker,/inspection_time_passed/);
  assert.match(worker,/REMINDER_TYPES\.has\(String\(job\.job_type\)\)/);
});

function policyMock() {
  const futureIso = (value) => { const d = new Date(value); if (Number.isNaN(d.getTime()) || d <= new Date()) throw new Error('future required'); return d.toISOString(); };
  return {
    asFutureIso: futureIso,
    optionalFutureIso: (value) => value ? futureIso(value) : null,
    assertTransition() {},
    assertVerifiedActiveProperty({ requestedPropertyId, existingPropertyId, propertyStatus }) {
      const id = requestedPropertyId || existingPropertyId;
      if (!id || propertyStatus !== 'active') throw new Error('exact active property required');
      return id;
    },
    assertBookingPrerequisites({ customerId, requestedStartAt, sourceSystemId, propertyId }) {
      if (!customerId || !requestedStartAt || !sourceSystemId || !propertyId) throw new Error('required');
      return new Date(requestedStartAt).toISOString();
    },
    inspectionLeadStatus() { return 'inspection'; },
    propertyVerificationForInput({ propertyId, propertyQueryText, propertyIsActive }) {
      return propertyId && propertyIsActive
        ? { propertyId, status: 'verified', queryText: null }
        : { propertyId: null, status: 'unresolved', queryText: propertyQueryText || propertyId || null };
    },
    reminderSchedule(startAt) { return [{ jobType: 'reminder_24h', dueAt: startAt, eligible: true }]; },
    appointmentEventCanConfirm({ eventType, appointmentStatus, externalEventId }) {
      return ['appointment.booked', 'appointment.rescheduled'].includes(eventType)
        && ['confirmed', 'rescheduled'].includes(appointmentStatus)
        && Boolean(externalEventId);
    },
  };
}

function makeAdmin(fixtures, calls) {
  return {
    from(table) {
      const state = { table, values: null, op: null };
      const q = {
        select() { return q; },
        eq() { return q; },
        in() { return q; },
        order() { return q; },
        limit() { return q; },
        insert(values) { state.values = values; state.op = 'insert'; calls.push(['insert', table, values]); return q; },
        update(values) { state.values = values; state.op = 'update'; calls.push(['update', table, values]); return q; },
        maybeSingle() {
          if (table === 'leads') return Promise.resolve({ data: fixtures.legacyLead || null, error: null });
          if (table === 'crm_leads') return Promise.resolve({ data: fixtures.crmLead || null, error: null });
          if (table === 'crm_customers') return Promise.resolve({ data: fixtures.customer || null, error: null });
          if (table === 'properties') return Promise.resolve({ data: fixtures.property || null, error: null });
          if (table === 'real_estate_inspections') return Promise.resolve({ data: fixtures.inspection || null, error: null });
          if (table === 'appointments') return Promise.resolve({ data: fixtures.appointment || null, error: null });
          return Promise.resolve({ data: null, error: null });
        },
        single() {
          if (state.table === 'real_estate_inspections' && state.op === 'insert') return Promise.resolve({ data: fixtures.insertedInspection, error: null });
          return Promise.resolve({ data: fixtures.transitioned || fixtures.inspection, error: null });
        },
        then(resolve, reject) {
          if (state.op === 'insert') return Promise.resolve({ data: fixtures.insertedJobs || [], error: null }).then(resolve, reject);
          return Promise.resolve({ data: [], error: null }).then(resolve, reject);
        },
      };
      return q;
    },
    rpc(name, args) {
      calls.push(['rpc', name, args]);
      if (name === 'create_real_estate_inspection_request_with_audit') return Promise.resolve({ data: fixtures.insertedInspection || null, error: null });
      if (name === 'transition_real_estate_inspection_with_audit') return Promise.resolve({ data: fixtures.transitioned || fixtures.inspection, error: null });
      if (name === 'cancel_real_estate_inspection_with_audit') return Promise.resolve({ data: fixtures.transitioned || fixtures.inspection, error: null });
      return Promise.resolve({ data: null, error: null });
    },
  };
}

function loadService(fixtures, calls, events, routing) {
  return load('lib/real-estate-inspections.ts', {
    '@/lib/real-estate-timezone':{realEstateDateTimeToIso:(v)=>v,validateTimeZone:v=>v},
    '@/lib/supabase/admin': { createAdminClient: () => makeAdmin(fixtures, calls) },
    '@/lib/system-orchestrator': { publishSystemEvent: async (event) => { events.push(event); return 'event-1'; } },
    '@/lib/appointment-scheduling': { selectAppointmentResource: async () => routing },
    '@/lib/canonical-customer': { resolveCanonicalCustomer: async () => ({ customerId: 'customer-1', status: 'matched' }) },
    '@/lib/real-estate-inspection-policy': policyMock(),
  });
}

test('customer intent with unresolved property stores verification request and no fictitious property id', async () => {
  const calls = [], events = [];
  const inserted = { id: 'inspection-1', organization_id: org, legacy_lead_id: 'legacy-1', property_id: null, property_query_text: '3 bedroom in Lekki', property_verification_status: 'unresolved', status: 'requested_verification' };
  const service = loadService({ legacyLead: { id: 'legacy-1' }, customer: { id: 'customer-1', status: 'active' }, insertedInspection: inserted }, calls, events, {});
  const result = await service.requestRealEstateInspection({
    organizationId: org,
    legacyLeadId: 'legacy-1',
    propertyId: 'not-an-active-property',
    propertyQueryText: '3 bedroom in Lekki',
    requestedStartAt: future,
  });
  assert.equal(result.status, 'requested_verification');
  assert.equal(result.property_id, null);
  assert.equal(result.property_verification_status, 'unresolved');
  assert.equal(events.length, 0, 'a customer request must not publish or book an appointment');
  assert.ok(calls.some(([op, table, values]) => op === 'update' && table === 'leads' && values.status === 'inspection'));
});

test('admin approval leaves intent unavailable and emits no event when resource/freebusy is unavailable', async () => {
  const calls = [], events = [];
  const inspection = { id: 'inspection-2', organization_id: org, status: 'requested', source: 'whatsapp', customer_id: 'customer-1', property_id: 'property-1', requested_start_at: future, requested_end_at: null, timezone: 'Africa/Lagos' };
  const service = loadService({ inspection, customer: { id: 'customer-1', status: 'active' }, property: { id: 'property-1', status: 'active' }, transitioned: { ...inspection, status: 'unavailable' } }, calls, events, { resource: null, endAt: null, reason: 'No free/busy slot' });
  const result = await service.approveRealEstateInspection({ organizationId: org, inspectionId: inspection.id, approvedBy: 'admin@example.test', sourceSystemId: 'source-system-1' });
  assert.equal(result.status, 'unavailable');
  assert.equal(events.length, 0);
  assert.ok(calls.some(([op, name]) => op === 'rpc' && name === 'transition_real_estate_inspection_with_audit'));
});

test('reconciliation does not confirm until canonical appointment has an external event', async () => {
  const calls = [], events = [];
  const inspection = { id: 'inspection-3', organization_id: org, status: 'booking_pending', source: 'whatsapp', timezone: 'Africa/Lagos', customer_id: 'customer-1', property_id: 'property-1', requested_start_at: future, canonical_appointment_id: 'appointment-1' };
  const service = loadService({ inspection, appointment: { id: 'appointment-1', customer_id: 'customer-1', status: 'confirmed', external_event_id: null } }, calls, events, {});
  const result = await service.reconcileRealEstateInspectionFromAppointment({ organizationId: org, inspectionId: inspection.id, appointmentId: 'appointment-1', eventType: 'appointment.booked' });
  assert.equal(result.status, 'awaiting_external_calendar_event');
  assert.equal(calls.filter(([op, name]) => op === 'rpc' && name === 'transition_real_estate_inspection_with_audit').length, 0);
});

test('migration contains tenant composite references, row locking, RLS, and external-event booking guard', () => {
  const sql = fs.readFileSync('supabase/migrations/20261024140600_real_estate_inspections.sql', 'utf8');
  assert.match(sql, /foreign key \(organization_id,legacy_lead_id\)\s+references public\.leads\(organization_id,id\)/i);
  assert.match(sql, /foreign key \(organization_id,crm_lead_id\)\s+references public\.crm_leads\(organization_id,id\)/i);
  assert.match(sql, /foreign key \(organization_id,customer_id\)\s+references public\.crm_customers\(organization_id,id\)/i);
  assert.match(sql, /foreign key \(organization_id,property_id\)\s+references public\.properties\(organization_id,id\)/i);
  assert.match(sql, /foreign key \(organization_id,canonical_appointment_id\)\s+references public\.appointments\(organization_id,id\)/i);
  assert.match(sql, /for update/i);
  assert.match(sql, /alter table public\.real_estate_inspections enable row level security/i);
  assert.match(sql, /Cannot mark inspection booked before canonical external calendar event exists/i);
});
