import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (path) => readFileSync(path, "utf8");

test("booking lifecycle API is tenant-scoped and validates status transitions", () => {
  const route = read("app/api/portal/bookings/[id]/route.ts");
  assert.match(route, /appointments\.manage/);
  assert.match(route, /eq\("organization_id", session\.organizationId\)/);
  assert.match(route, /rescheduled/);
  assert.match(route, /cancelled/);
  assert.match(route, /deposit_status/);
  assert.match(route, /delivery_status/);
  assert.match(route, /assigned_photographer_id/);
});

test("booking detail UI provides lifecycle controls and is reachable from the calendar", () => {
  const detail = read("app/portal/appointments/[id]/page.tsx");
  const form = read("app/portal/appointments/BookingLifecycleForm.tsx");
  const list = read("app/portal/appointments/page.tsx");
  assert.match(detail, /Booking lifecycle/);
  assert.match(form, /Save changes/);
  assert.match(form, /Booking title/);
  assert.match(form, /Cancel booking/);
  assert.match(form, /assignedPhotographerId/);
  assert.match(form, /api\/portal\/bookings/);
  assert.match(list, /portal\/appointments\/\$\{item\.id\}/);
});

test("confirmed Xposure bookings submit the configured appointment WhatsApp template", () => {
  const createRoute = read("app/api/portal/bookings/route.ts");
  const updateRoute = read("app/api/portal/bookings/[id]/route.ts");
  assert.match(createRoute, /enqueueAppointmentConfirmation/);
  assert.match(updateRoute, /enqueueAppointmentConfirmation/);
  assert.match(createRoute, /booking_reference:/);
  assert.match(updateRoute, /booking_reference:/);
  assert.match(updateRoute, /whatsapp_confirmation_submitted_at/);
  const worker = read("lib/appointment-notification-outbox-runtime.ts");
  assert.match(worker, /sendWhatsAppMessage/);
  assert.match(worker, /templatePurpose: row\.purpose/);
  assert.match(worker, /requestedTemplateName: row\.template_name/);
  assert.match(updateRoute, /status === "confirmed" && appointment\.status !== "confirmed"/);
  assert.match(updateRoute, /eq\("organization_id", session\.organizationId\)/);
});

test("booking dashboard offers explicit confirm, cancel, and delete actions", () => {
  const form = read("app/portal/appointments/BookingLifecycleForm.tsx");
  const route = read("app/api/portal/bookings/[id]/route.ts");
  assert.match(form, /Confirm booking/);
  assert.match(form, /Cancel booking/);
  assert.match(form, /Delete booking/);
  assert.match(form, /method: "DELETE"/);
  assert.match(route, /export async function DELETE/);
  assert.match(route, /eq\("organization_id", session\.organizationId\)/);
  assert.match(route, /external calendar/);
});


test("new studio bookings can remain requested without sending confirmation", () => {
  const createRoute = read("app/api/portal/bookings/route.ts");
  const form = read("app/portal/appointments/NewBookingForm.tsx");
  assert.match(createRoute, /body\.status === "confirmed" \? "confirmed" : "requested"/);
  assert.match(createRoute, /if \(status === "confirmed" && customer\.phone\)/);
  assert.match(form, /Save as requested/);
  assert.match(form, /Confirm now/);
  assert.match(form, /status: String\(form\.get\("status"\) \|\| "requested"\)/);
});


test("new booking status rejects unsupported values and booking form pins Lagos wall time", () => {
  const createRoute = read("app/api/portal/bookings/route.ts");
  const newForm = read("app/portal/appointments/NewBookingForm.tsx");
  const detail = read("app/portal/appointments/[id]/page.tsx");
  assert.match(createRoute, /New bookings must be requested or confirmed/);
  assert.match(createRoute, /!\["requested", "confirmed"\]\.includes\(body\.status\)/);
  assert.match(newForm, /toLagosIso/);
  assert.match(newForm, /\+01:00/);
  assert.match(newForm, /formElement\.reset\(\)/);
  assert.match(detail, /timeZone: "Africa\/Lagos"/);
});

test("concurrent confirmation uses a conditional status update and returns conflict for stale requests", () => {
  const route = read("app/api/portal/bookings/[id]/route.ts");
  assert.match(route, /updateQuery = updateQuery\.eq\("status", appointment\.status\)/);
  assert.match(route, /status changed in another request/);
  assert.match(route, /status === "confirmed" && appointment\.status !== "confirmed"/);
});

test("booking confirmation action submits its own form without a global DOM query or timer", () => {
  const form = read("app/portal/appointments/BookingLifecycleForm.tsx");
  assert.match(form, /useRef<HTMLFormElement>\(null\)/);
  assert.match(form, /formRef\.current\.requestSubmit\(\)/);
  assert.doesNotMatch(form, /document\.querySelector<HTMLFormElement>/);
  assert.doesNotMatch(form, /setTimeout\(/);
});

test("photography metadata failure does not short-circuit booking WhatsApp confirmation", () => {
  const route = read("app/api/portal/bookings/[id]/route.ts");
  const metadataUpdate = route.indexOf('const { data: metadata, error: metadataError }');
  const metadataFailure = route.indexOf('if (metadataError) return NextResponse.json', metadataUpdate);
  const deleteHandler = route.indexOf('export async function DELETE');
  const confirmationSend = route.indexOf('await enqueueAppointmentConfirmation({', metadataUpdate);
  assert.ok(metadataUpdate >= 0);
  assert.ok(metadataFailure === -1 || metadataFailure > deleteHandler);
  assert.ok(confirmationSend > metadataUpdate);
  assert.match(route, /const warnings: string\[\] = \[\]/);
  assert.match(route, /warnings\.push\("Booking updated, but photography metadata could not be updated\."/);
  assert.match(route, /warnings\.length \? \{ warnings \} : \{\}/);
});


test("appointment notification outbox is tenant-scoped and avoids automatic resend after interrupted processing", () => {
  const migration = read("supabase/migrations/20261023070000_appointment_notification_outbox.sql");
  const enqueue = read("lib/appointment-notification-outbox.ts");
  const worker = read("lib/appointment-notification-outbox-runtime.ts");
  const task = read("src/trigger/appointment-notification-outbox.ts");
  assert.ok(migration.includes("unique (organization_id, event_key)"));
  assert.match(migration, /for update skip locked/i);
  assert.match(migration, /uncertain/);
  assert.ok(migration.toLowerCase().includes("revoke all on public.appointment_notification_outbox from anon, authenticated"));
  assert.match(enqueue, /appointment-confirmed:/);
  assert.match(enqueue, /ignoreDuplicates: true/);
  assert.match(worker, /claim_appointment_notification_outbox/);
  assert.match(worker, /status: "sent"/);
  assert.match(worker, /status: "failed"/);
  assert.match(worker, /manual reconciliation required/);
  assert.match(task, /appointment-notification-outbox-sweep/);
});
