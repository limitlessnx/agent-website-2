import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const followups = read("src/trigger/system-orchestrator.ts");
const installments = read("lib/limitless-installment-reminder-runtime.ts");
const reminders = read("src/trigger/tenant-reminder-sweep.ts");
const appointments = read("src/trigger/tenant-appointment-reminder-drain.ts");

test("Limitless Realty follow-up drain refuses to send when the organization is inactive", () => {
  assert.match(followups, /select\("id,status"\)\.eq\("slug", "limitless-realty"\)/);
  assert.match(followups, /organization\.status !== "active"[^\n]*reason: "organization_not_active"/);
});

test("installment reminder sweep only processes plans belonging to active organizations", () => {
  assert.match(installments, /admin\.from\("organizations"\)\.select\("id,name"\)\.eq\("status", "active"\)/);
  assert.match(installments, /if \(!orgMap\.has\(organizationId\)\)[\s\S]*?reason: "organization_not_active"/);
});

test("tenant reminder sweep does not queue work for inactive organizations", () => {
  assert.match(reminders, /from\("organizations"\)\.select\("id,status"\)\.in\("id", organizationIds\)/);
  assert.match(reminders, /activeOrganizationIds\.has\(rule\.organization_id\)/);
});

test("appointment reminder drain cancels due work for inactive organizations", () => {
  assert.match(appointments, /from\("organizations"\)[\s\S]*?eq\("id", row\.organization_id\)[\s\S]*?organization\.status !== "active"/);
  assert.match(appointments, /status: "cancelled"[\s\S]*?reminder suppressed/);
});


