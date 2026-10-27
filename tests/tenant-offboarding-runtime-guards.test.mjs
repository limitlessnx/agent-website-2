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



const handoffFollowup = read("lib/handoff-followup.ts");
const systemEventAdapters = read("lib/system-event-adapters.ts");
const systemOrchestrator = read("lib/system-orchestrator.ts");
const orchestrationRecovery = read("lib/orchestration-operations.ts");

test("handoff follow-up tasks are cancelled before sending when the tenant is inactive", () => {
  assert.match(handoffFollowup, /select\("status"\)\.eq\("id",task\.organization_id\)/);
  assert.match(handoffFollowup, /organization\.status!=="active"[\s\S]*?status:"cancelled"[\s\S]*?follow_up_error:"organization_not_active"/);
});

test("appointment reminder tasks are cancelled before publishing a system event for inactive tenants", () => {
  assert.match(systemEventAdapters, /select\("status"\)[\s\S]*?eq\("id", task\.organization_id\)[\s\S]*?organization\.status !== "active"[\s\S]*?status: "cancelled"[\s\S]*?reminder_error: "organization_not_active"/);
});

test("system-event dispatch suppresses inactive-tenant events without retry storms", () => {
  assert.match(systemOrchestrator, /Offboarding suppression: organization is not active/);
  assert.match(systemOrchestrator, /!\("suppressed" in result && result\.suppressed\)/);
  assert.match(orchestrationRecovery, /startsWith\("Offboarding suppression:"\)[\s\S]*?action: "suppressed"/);
});
