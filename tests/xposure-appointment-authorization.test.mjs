import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("Xposure appointment authorization requires active membership and appointments.manage", () => {
  const auth = read("lib/xposure-appointment-authorization.ts");
  assert.match(auth, /getClientSession\(\)/);
  assert.match(auth, /organization\.status !== "active"/);
  assert.match(auth, /organization\.slug !== "xposure"/);
  assert.match(auth, /requirePortalPermission\(session, \["appointments\.manage"\]\)/);
  assert.match(auth, /getAdminSession\(\)/);
  assert.match(auth, /scope\.kind !== "tenant" \|\| scope\.slug !== "xposure"/);
});

test("appointment capacity GET and PUT both use the shared authorization guard", () => {
  const route = read("app/api/admin/appointment-availability-settings/route.ts");
  assert.equal((route.match(/authorizeXposureAppointmentManagement\(\)/g) || []).length, 2);
  assert.match(route, /eq\("organization_id", auth\.organizationId\)/);
  assert.match(route, /maxConcurrentAppointments/);
});

test("appointment status changes and reschedules use the same authorized tenant scope", () => {
  const route = read("app/api/admin/appointments/[appointmentId]/route.ts");
  assert.match(route, /authorizeXposureAppointmentManagement\(\)/);
  assert.match(route, /eq\("organization_id", auth\.organizationId\)/);
  assert.match(route, /selectAppointmentResource/);
  assert.match(route, /cancelCalendarEvent/);
  assert.match(route, /rescheduleCalendarEvent/);
  assert.doesNotMatch(route, /getAdminSession|resolveAdminOrganizationScope/);
});

test("manager authorization does not accept a tenant id or slug without permission verification", () => {
  const auth = read("lib/xposure-appointment-authorization.ts");
  assert.ok(auth.indexOf('organization.slug !== "xposure"') < auth.indexOf('requirePortalPermission(session, ["appointments.manage"])'));
});

test("appointment writes enforce database capacity before calendar changes and roll back on provider failure", () => {
  const route = read("app/api/admin/appointments/[appointmentId]/route.ts");
  const databaseWrite = route.indexOf(".update(updates)");
  const calendarWrite = route.indexOf("await rescheduleCalendarEvent({", databaseWrite);
  const calendarCancel = route.indexOf("await cancelCalendarEvent({", databaseWrite);
  assert.ok(databaseWrite > -1, "appointment database update exists");
  assert.ok(calendarWrite > databaseWrite, "calendar reschedule occurs after database capacity guard");
  assert.ok(calendarCancel > databaseWrite, "calendar cancellation occurs after database status update");
  assert.match(route, /const rollback = await admin\.from\("appointments"\)\.update\(/);
  assert.match(route, /reconciliation_required: true/);
  assert.match(route, /TENANT_APPOINTMENT_CAPACITY_REACHED/);
  assert.match(route, /status: 409/);
});
