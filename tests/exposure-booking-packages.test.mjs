import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (path) => readFileSync(path, "utf8");

test("Xposure booking API enforces tenant ownership and links package metadata", () => {
  const route = read("app/api/portal/bookings/route.ts");
  assert.match(route, /appointments\.manage/);
  assert.match(route, /crm_customers/);
  assert.match(route, /organization_systems/);
  assert.match(route, /photography_catalogue_items/);
  assert.match(route, /photography_booking_metadata/);
  assert.match(route, /organization_id: session\.organizationId/);
  assert.match(route, /depositStatus/);
  assert.match(route, /deliveryStatus/);
});

test("Xposure booking UI exposes package and fulfilment fields", () => {
  const form = read("app/portal/appointments/NewBookingForm.tsx");
  const page = read("app/portal/appointments/page.tsx");
  assert.match(form, /name="catalogueItemId"/);
  assert.match(form, /name="depositStatus"/);
  assert.match(form, /name="deliveryStatus"/);
  assert.match(form, /api\/portal\/bookings/);
  assert.match(page, /New booking/);
  assert.match(page, /Package:/);
  assert.match(page, /Deposit/);
  assert.match(page, /Delivery/);
});
