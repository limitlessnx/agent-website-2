import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (path) => readFileSync(path, "utf8");

test("reminder execution ledger links rules within the same tenant and prevents duplicate occurrences", () => {
  const sql = read("supabase/migrations/20261022100000_tenant_reminder_executions.sql");
  assert.match(sql, /foreign key \(organization_id, rule_id\)/);
  assert.match(sql, /recipient_key text not null/);
  assert.match(sql, /unique \(organization_id, rule_id, recipient_key, scheduled_for\)/);
  assert.match(sql, /unique \(organization_id, id\)/);
  assert.match(sql, /enable row level security/);
});

test("scheduled reminder evaluator never attempts external delivery before consent-aware adapters are ready", () => {
  const task = read("src/trigger/tenant-reminder-sweep.ts");
  assert.match(task, /schedules\.task/);
  assert.match(task, /tenant_reminder_rules/);
  assert.match(task, /tenant_reminder_executions/);
  assert.match(task, /delivery_adapter_not_ready/);
  assert.doesNotMatch(task, /sendWhatsAppMessage/);
});

test("calendar recurrence uses real month boundaries", () => {
  const calendar = read("src/trigger/tenant-reminder-calendar.ts");
  assert.match(calendar, /addCalendarMonths/);
  assert.match(calendar, /frequency === "monthly"/);
  assert.match(calendar, /frequency === "quarterly"/);
  assert.match(calendar, /frequency === "yearly"/);
  assert.match(calendar, /Math\.min\(day, lastDay\)/);
});

test("scheduled evaluator delegates recurring rules to the calendar helper", () => {
  const task = read("src/trigger/tenant-reminder-sweep.ts");
  assert.match(task, /getLatestRecurrence/);
  assert.match(task, /resolveFixedDate/);
  assert.doesNotMatch(task, /frequency === "monthly" \? 30/);
});

test("birthday and anniversary reminder audiences are resolved from same-tenant contacts", () => {
  const task = read("src/trigger/tenant-reminder-sweep.ts");
  assert.match(task, /tenant_customer_contacts/);
  assert.match(task, /\.eq\("organization_id",rule\.organization_id\)/);
  assert.match(task, /\["birthday","anniversary"\]/);
  assert.match(task, /recipient_key:target\.recipient\.key/);
});

test("contact schema keeps consent explicit and unique within each tenant", () => {
  const sql = read("supabase/migrations/20261022130000_tenant_customer_contacts.sql");
  assert.match(sql, /whatsapp_consent text not null default 'unknown'/);
  assert.match(sql, /email_consent text not null default 'unknown'/);
  assert.match(sql, /unique index if not exists tenant_customer_contacts_org_phone_unique/);
  assert.match(sql, /enable row level security/);
});

test("Maia captures explicitly stated birthdays and anniversaries into tenant contacts", () => {
  const helper = read("lib/tenant-contact-dates.ts");
  const runtime = read("src/trigger/maia-runtime.ts");
  assert.match(runtime, /captureTenantContactDates/);
  assert.match(helper, /extractExplicitContactDates/);
  assert.match(helper, /birthday/);
  assert.match(helper, /anniversary/);
  assert.match(helper, /\.eq\("organization_id", input\.organizationId\)/);
  assert.match(helper, /date_already_present/);
  assert.match(helper, /whatsapp_consent: "unknown"/);
  assert.match(helper, /email_consent: "unknown"/);
});

test("confirmed appointments receive tenant-scoped 24-hour and 2-hour reminder schedules", () => {
  const migration = read("supabase/migrations/20261022140000_tenant_appointment_lifecycle_reminders.sql");
  const drain = read("src/trigger/tenant-appointment-reminder-drain.ts");
  assert.match(migration, /create table if not exists public\.tenant_appointment_reminders/);
  assert.match(migration, /foreign key \(organization_id, appointment_id\)/);
  assert.match(migration, /unique \(organization_id, id\)/);
  assert.match(migration, /1440/);
  assert.match(migration, /120/);
  assert.match(migration, /appointments_sync_tenant_reminders/);
  assert.match(drain, /tenant_appointment_reminder_notifications/);
  assert.match(drain, /\.eq\("organization_id", row\.organization_id\)/);
});
