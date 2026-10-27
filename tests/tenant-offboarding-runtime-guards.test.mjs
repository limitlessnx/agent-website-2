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
const systemOrchestratorTask = read("src/trigger/system-orchestrator.ts");
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
  assert.match(systemOrchestratorTask, /!\("suppressed" in result && result\.suppressed\)/);
  assert.match(orchestrationRecovery, /startsWith\("Offboarding suppression:"\)[\s\S]*?action: "suppressed"/);
});

const reminderExecutionDrain = read("src/trigger/tenant-reminder-execution-drain.ts");

test("already-queued internal reminders are cancelled when their organization is inactive", () => {
  assert.match(reminderExecutionDrain, /from\("organizations"\)[\s\S]*?eq\("id", row\.organization_id\)[\s\S]*?organization\.status !== "active"/);
  assert.match(reminderExecutionDrain, /status: "cancelled"[\s\S]*?Organization is not active; reminder suppressed/);
});

function assertBefore(source, first, second, message) {
  const firstIndex = source.indexOf(first);
  const secondIndex = source.indexOf(second);
  assert.notEqual(firstIndex, -1, `Missing first marker: ${first}`);
  assert.notEqual(secondIndex, -1, `Missing second marker: ${second}`);
  assert.ok(firstIndex < secondIndex, message);
}

test("queued reminder cancellation is compare-and-set and scoped to the claimed tenant row", () => {
  assertBefore(
    reminderExecutionDrain,
    '.eq("status", "queued").select("id").maybeSingle()',
    '.from("organizations")',
    "the row must be claimed before the tenant status is checked",
  );
  assert.match(
    reminderExecutionDrain,
    /from\("organizations"\)[\s\S]*?\.eq\("id", row\.organization_id\)[\s\S]*?if \(organizationError\) throw organizationError/,
  );
  assert.match(
    reminderExecutionDrain,
    /from\("tenant_reminder_executions"\)[\s\S]*?status: "cancelled"[\s\S]*?\.eq\("id", row\.id\)[\s\S]*?\.eq\("organization_id", row\.organization_id\)[\s\S]*?\.eq\("status", "processing"\)/,
  );
  assertBefore(
    reminderExecutionDrain,
    'last_error: "Organization is not active; reminder suppressed."',
    '.from("tenant_reminder_rules")',
    "inactive reminders must be suppressed before rule lookup or notification work",
  );
});

test("appointment reminder cancellation is scoped and occurs before appointment processing", () => {
  assertBefore(
    appointments,
    '.from("organizations")',
    '.from("appointments")',
    "organization status must be checked before appointment processing",
  );
  assert.match(
    appointments,
    /from\("tenant_appointment_reminders"\)[\s\S]*?status: "cancelled"[\s\S]*?\.eq\("organization_id", row\.organization_id\)[\s\S]*?\.eq\("id", row\.id\)[\s\S]*?\.eq\("status", "processing"\)/,
  );
  assert.match(appointments, /if \(organizationError\) throw organizationError/);
});

test("CRM reminder and handoff cancellation is tenant-scoped and precedes external side effects", () => {
  assertBefore(
    systemEventAdapters,
    '.from("organizations")',
    'callAdminRpc(admin, "publish_system_event"',
    "inactive appointment reminders must not publish a system event",
  );
  assert.match(
    systemEventAdapters,
    /from\("crm_tasks"\)[\s\S]*?status: "cancelled"[\s\S]*?\.eq\("organization_id", task\.organization_id\)[\s\S]*?\.eq\("id", task\.id\)[\s\S]*?\.eq\("status", "scheduled"\)/,
  );
  assertBefore(
    handoffFollowup,
    'select("status").eq("id",task.organization_id)',
    "sendWhatsAppMessage({",
    "inactive handoff follow-ups must be stopped before WhatsApp delivery",
  );
  assert.match(
    handoffFollowup,
    /from\("crm_tasks"\)[\s\S]*?status:"cancelled"[\s\S]*?\.eq\("organization_id",task\.organization_id\)\.eq\("id",task\.id\)\.eq\("status","scheduled"\)/,
  );
  assert.match(handoffFollowup, /if\(organizationError\) throw organizationError/);
});

test("offboarding suppression is terminal for recovery and cannot trigger automatic retry", () => {
  assertBefore(
    systemOrchestrator,
    '.from("organizations")',
    'if(event.eventType==="handoff.requested")',
    "the organization status must be checked before dispatching any event type",
  );
  assert.match(
    systemOrchestrator,
    /Offboarding suppression: organization is not active\.[\s\S]*?status: "failed"[\s\S]*?\.eq\("organization_id", event\.organizationId\)\.eq\("id", event\.id\)[\s\S]*?suppressed: true/,
  );
  assertBefore(
    orchestrationRecovery,
    'startsWith("Offboarding suppression:")',
    "classifyOrchestrationFailure(event.last_error)",
    "terminal offboarding suppressions must be excluded before retry classification",
  );
  assert.match(systemOrchestratorTask, /result\.status === "failed" && !\("suppressed" in result && result\.suppressed\)/);
});

test("organization lookup failures fail closed instead of allowing scheduled work to continue", () => {
  for (const [name, source] of [
    ["Limitless Realty follow-ups", followups],
    ["installment reminders", installments],
    ["tenant reminder sweep", reminders],
    ["appointment reminder drain", appointments],
    ["internal reminder execution drain", reminderExecutionDrain],
    ["CRM appointment reminders", systemEventAdapters],
    ["handoff follow-ups", handoffFollowup],
    ["system event dispatch", systemOrchestrator],
  ]) {
    assert.match(source, /organizationError\) throw organizationError/, `${name} must propagate organization lookup errors`);
  }
});
