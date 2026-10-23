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
  for (const route of [createRoute, updateRoute]) {
    assert.match(route, /sendWhatsAppMessage/);
    assert.match(route, /templatePurpose: "appointment_reminder"/);
    assert.match(route, /requestedTemplateName: "appointment_reminder"/);
    assert.match(route, /booking_reference:/);
    assert.match(route, /whatsapp_confirmation_submitted_at/);
  }
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
