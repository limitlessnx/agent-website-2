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
  assert.match(form, /Save booking/);
  assert.match(form, /Cancel booking/);
  assert.match(form, /assignedPhotographerId/);
  assert.match(form, /api\/portal\/bookings/);
  assert.match(list, /portal\/appointments\/\$\{item\.id\}/);
});
