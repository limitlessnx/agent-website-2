import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import load from "./helpers/load-typescript.cjs";

const read = (path) => readFileSync(path, "utf8");
const actions = () => read("app/dashboard/limitless/payments/actions.ts");
const runtime = () => read("lib/limitless-installment-reminder-runtime.ts");
const overview = () => read("app/dashboard/limitless/payments/page.tsx");
const management = () => read("app/dashboard/limitless/payments/installments/page.tsx");
const migration = () => read("supabase/migrations/20261027220000_limitless_installment_reminder_contract.sql");
const phoneContract = load("lib/limitless-followup-contract.ts", {}, "export { LIMITLESS_REALTY_ORGANIZATION_ID, followupErrorSummary, limitlessPhoneCandidates };");
const scheduleHelpers = load("lib/limitless-installment-reminder-runtime.ts", {
  "@/lib/supabase/admin": { createAdminClient: () => ({}) },
  "@/lib/whatsapp-delivery": { sendWhatsAppMessage: async () => ({}) },
  "@/lib/flux-credits": { assertFluxFeatureAccess: async () => {}, reserveFluxCredits: async () => ({}) },
  "@/lib/limitless-followup-contract": phoneContract,
}, "export { computeReminderOccurrence, computeLimitlessReminderOccurrence, classifyReminderOccurrence };");
const LIMITLESS_ID = "b15f21b4-5697-4d21-9421-8a34eae3476d";

test("Limitless occurrences use next_due_date and deterministic Lagos local time while legacy tenants retain their cadence cursor", () => {
  const source = runtime();
  assert.match(source, /computeReminderOccurrence\(nextDueDate/);
  assert.match(source, /direction === "before"/);
  assert.match(source, /direction === "after"/);
  assert.match(source, /const LAGOS_TIME_ZONE = "Africa\/Lagos"/);
  assert.match(source, /const REMINDER_LOCAL_TIME = "10:00:00"/);
  assert.match(source, /new Date\(`\$\{occurrenceDate\}T\$\{REMINDER_LOCAL_TIME\}\+01:00`\)/);
  assert.match(source, /classifyReminderOccurrence\(occurrenceDate, scheduledFor, now\)/);
  assert.match(source, /missed_reminder_window/);
  assert.match(source, /next_due_date/);
  assert.match(source, /if \(isLimitless\)/);
  assert.match(source, /plan\.next_reminder_at/);
  assert.match(source, /plan\.start_at/);
  assert.match(source, /cadenceDays\(/);
  assert.match(source, /computeLimitlessReminderOccurrence\(String\(plan\.next_due_date\), template\.timing_direction, Number\(template\.timing_days\), plan\.next_reminder_at\)/);
  assert.match(source, /limitless_requires_single_local_reminder_template/);
});

test("Limitless reminders only send on their Lagos calendar day and missed windows never catch up in a burst", () => {
  const before = scheduleHelpers.computeReminderOccurrence("2026-10-31", "before", 3);
  const due = scheduleHelpers.computeReminderOccurrence("2026-10-28", "on", 0);
  const after = scheduleHelpers.computeReminderOccurrence("2026-10-25", "after", 3);
  assert.equal(before.occurrenceDate, "2026-10-28");
  assert.equal(due.occurrenceDate, "2026-10-28");
  assert.equal(after.occurrenceDate, "2026-10-28");
  assert.equal(scheduleHelpers.classifyReminderOccurrence(before.occurrenceDate, before.scheduledFor, new Date("2026-10-28T08:59:00Z")), "waiting");
  assert.equal(scheduleHelpers.classifyReminderOccurrence(due.occurrenceDate, due.scheduledFor, new Date("2026-10-28T09:05:00Z")), "due");
  assert.equal(scheduleHelpers.classifyReminderOccurrence(after.occurrenceDate, after.scheduledFor, new Date("2026-10-29T10:05:00Z")), "missed");
});

test("Limitless installment reminder cursor starts at 10:00 Lagos and repeats every 14 days independently of the due-date anchor", () => {
  const first = scheduleHelpers.computeLimitlessReminderOccurrence("2026-10-28", "on", 0, null);
  assert.equal(first.occurrenceDate, "2026-10-28");
  assert.equal(first.scheduledFor, "2026-10-28T09:00:00.000Z");
  const next = scheduleHelpers.computeLimitlessReminderOccurrence("2026-10-28", "on", 0, "2026-11-11T09:00:00.000Z");
  assert.equal(next.occurrenceDate, "2026-11-11");
  assert.equal(next.scheduledFor, "2026-11-11T09:00:00.000Z");
  assert.equal(scheduleHelpers.computeLimitlessReminderOccurrence("2026-10-28", "on", 0, "2026-11-11T08:30:00.000Z"), null);
  assert.equal(scheduleHelpers.computeLimitlessReminderOccurrence("2026-10-28", "on", 0, "2026-11-11T09:00:00.001Z"), null);
  assert.equal(scheduleHelpers.classifyReminderOccurrence(next.occurrenceDate, next.scheduledFor, new Date("2026-11-11T08:59:00Z")), "waiting");
  assert.equal(scheduleHelpers.classifyReminderOccurrence(next.occurrenceDate, next.scheduledFor, new Date("2026-11-11T09:01:00Z")), "due");
  assert.equal(scheduleHelpers.computeLimitlessReminderOccurrence("invalid", "on", 0, null), null);
});

test("both creation forms submit the same persisted installment schedule contract", () => {
  const fields = ["installment_amount", "next_due_date", "final_due_date", "frequency", "first_reminder_mode", "reminders_enabled"];
  for (const field of fields) {
    assert.match(overview(), new RegExp(`name="${field}"`));
    assert.match(management(), new RegExp(`name="${field}"`));
  }
  const source = actions();
  assert.match(source, /installment_amount: installmentAmount/);
  assert.match(source, /next_due_date: nextDueDate/);
  assert.match(source, /final_due_date: finalDueDate/);
  assert.match(source, /dateOnly\(String\(formData\.get\("next_due_date"\).*initialPaid < agreedAmount\)/);
  assert.match(source, /An active installment plan requires a next due date to advance its payment schedule/);
  assert.match(source, /firstReminderMode !== "due_date"/);
  assert.match(source, /next_reminder_at: null/);
  assert.match(source, /Reminders must use the next due date/);
});

test("approved WhatsApp template gating uses the approved seven-variable order", () => {
  const source = runtime();
  for (const key of ["client_name", "property_title", "amount_paid", "outstanding_balance", "handover_agent_name", "handover_agent_phone", "company_name"]) assert.match(source, new RegExp(`"${key}"`));
  assert.match(source, /const LEGACY_EXPECTED_VARIABLE_KEYS/);
  assert.match(source, /const LIMITLESS_EXPECTED_VARIABLE_KEYS/);
  assert.match(source, /organizationId === LIMITLESS_REALTY_ORGANIZATION_ID \? LIMITLESS_EXPECTED_VARIABLE_KEYS : LEGACY_EXPECTED_VARIABLE_KEYS/);
  assert.match(source, /variableKeys\.every\(\(key, index\) => key === expectedKeys\[index\]\)/);
  assert.match(source, /approved_variable_order/);
  assert.match(source, /missing_exact_approved_meta_template_config/);
});

test("legacy reminder plans retain their seven-variable contract and tenant-local template binding", () => {
  const source = runtime();
  for (const key of ["client_name", "property_title", "amount_paid", "outstanding_balance", "handover_agent_name", "handover_agent_phone", "company_name"]) {
    assert.match(source, new RegExp(`"${key}"`));
  }
  assert.match(source, /if \(!isLimitless\) return legacyValues/);
  assert.match(source, /const tenantTemplates = templateRows\.filter\(\(template\) => String\(template\.organization_id\) === organizationId\)/);
  assert.match(source, /: isLimitless \? tenantTemplates : tenantTemplates\.slice\(0, 1\)/);
});

test("retry is authenticated, tenant/plan scoped, compare-and-set, and never auto-retries unknown outcomes", () => {
  const source = actions();
  const runtimeSource = runtime();
  assert.match(source, /retryReminderAttemptAction/);
  assert.match(source, /retryLimitlessInstallmentReminder/);
  assert.match(runtimeSource, /\.eq\("organization_id", organizationId\)/);
  assert.match(runtimeSource, /\.eq\("payment_plan_id", planId\)/);
  assert.match(runtimeSource, /\.eq\("status", "failed"\)/);
  assert.match(runtimeSource, /\.eq\("status", "failed"\)[\s\S]*\.select\("id"\)/);
  assert.match(runtimeSource, /status: "pending"[\s\S]*send_authorized_at: null/);
  assert.match(runtimeSource, /const status = explicitDeliveryFailure\(error\) \? "failed" : "unknown"/);
  assert.match(runtimeSource, /\["sent", "pending", "skipped", "unknown"\]/);
});

test("scheduled and manual installment sends honor tenant-scoped lead opt-out status", () => {
  const source = runtime();
  assert.match(source, /async function checkLeadOptOut/);
  assert.match(source, /\.eq\("organization_id", plan\.organization_id\)\.eq\("id", plan\.contact_id\)/);
  assert.match(source, /\.eq\("opted_out", true\)\.in\("phone", candidates\)/);
  assert.match(source, /if \(optOut\.optedOut\)/);
  assert.match(source, /if \(!optOut\.safe \|\| optOut\.optedOut\)/);
});

test("manual retry makes no provider call for an opted-out linked or phone-matched lead", async () => {
  async function retryWithLead(plan, lead) {
    const calls = [];
    let providerCalled = false;
    class Query {
      constructor(table) { this.table = table; this.filters = {}; this.phoneCandidates = []; }
      select() { return this; }
      eq(key, value) { this.filters[key] = value; return this; }
      gt() { return this; }
      in(key, values) { this.filters[key] = values; this.phoneCandidates = values; return this; }
      limit() { return this; }
      maybeSingle() {
        calls.push({ table: this.table, filters: { ...this.filters } });
        return Promise.resolve({ data: this.table === "payment_plans" ? plan : lead, error: null });
      }
      then(resolve, reject) {
        calls.push({ table: this.table, filters: { ...this.filters }, phoneCandidates: this.phoneCandidates });
        const data = this.table === "leads" && lead?.opted_out ? [{ id: "lead-opted-out" }] : [];
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      }
    }
    const runtimeModule = load("lib/limitless-installment-reminder-runtime.ts", {
      "@/lib/supabase/admin": { createAdminClient: () => ({ from: (table) => new Query(table) }) },
      "@/lib/whatsapp-delivery": { sendWhatsAppMessage: async () => { providerCalled = true; return {}; } },
      "@/lib/flux-credits": { assertFluxFeatureAccess: async () => {}, reserveFluxCredits: async () => ({ ok: true }) },
      "@/lib/limitless-followup-contract": { followupErrorSummary: () => "safe_failure", LIMITLESS_REALTY_ORGANIZATION_ID: LIMITLESS_ID, limitlessPhoneCandidates: phoneContract.limitlessPhoneCandidates },
    }, "export { retryLimitlessInstallmentReminder };");
    await assert.rejects(
      runtimeModule.retryLimitlessInstallmentReminder({ organizationId: LIMITLESS_ID, planId: "plan-a", attemptId: "attempt-a" }),
      /opt-out is active/,
    );
    assert.equal(providerCalled, false);
    return calls;
  }

  const basePlan = { id: "plan-a", organization_id: LIMITLESS_ID, client_name: "Synthetic", client_phone: "08123456789", property_title: "Test property", currency: "NGN", total_paid: 0, outstanding_balance: 1000, installment_amount: 100, payment_type: "installment", frequency: "biweekly", next_due_date: "2026-11-01", final_due_date: null, reminder_template_id: "template-a", handover_agent_name: "Agent", handover_agent_phone: "2348000000000", status: "active", reminders_enabled: true };
  const linkedCalls = await retryWithLead({ ...basePlan, contact_id: "lead-a" }, { id: "lead-a", opted_out: true });
  assert.ok(linkedCalls.some((call) => call.table === "leads" && call.filters.organization_id === LIMITLESS_ID && call.filters.id === "lead-a"));
  const phoneCalls = await retryWithLead({ ...basePlan, contact_id: null }, { id: "lead-opted-out", opted_out: true });
  const phoneLookup = phoneCalls.find((call) => call.table === "leads" && call.phoneCandidates);
  assert.ok(phoneLookup.phoneCandidates.includes("2348123456789"));
  const repairedPrefixCalls = await retryWithLead({ ...basePlan, client_phone: "+234 08123456789", contact_id: null }, { id: "lead-opted-out", opted_out: true });
  const repairedPrefixLookup = repairedPrefixCalls.find((call) => call.table === "leads" && call.phoneCandidates);
  assert.ok(repairedPrefixLookup.phoneCandidates.includes("2348123456789"));
});

test("Limitless invalid monetary fields create no attempt and authorization denial makes no provider call", async () => {
  const validPlan = {
    id: "plan-a", organization_id: LIMITLESS_ID, contact_id: "lead-a", client_name: "Synthetic",
    client_phone: "08123456789", property_title: "Test property", currency: "NGN", agreed_price: "1000.00",
    total_paid: "0.00", outstanding_balance: "1000.00", installment_amount: "100.00", payment_type: "installment",
    frequency: "biweekly", next_due_date: "2026-11-01", final_due_date: null, reminder_template_id: "template-a",
    handover_agent_name: "Agent", handover_agent_phone: "2348000000000", status: "active", reminders_enabled: true,
  };
  async function runInvalid(plan) {
    let attemptInserted = false;
    let providerCalled = false;
    class Query {
      constructor(table) { this.table = table; }
      select() { return this; }
      eq() { return this; }
      gt() { return this; }
      in() { return this; }
      order() { return this; }
      limit() { return this; }
      maybeSingle() { return Promise.resolve({ data: this.table === "payment_plans" ? plan : null, error: null }); }
      single() { attemptInserted = true; return Promise.resolve({ data: { id: "attempt-a" }, error: null }); }
      insert() { attemptInserted = true; return this; }
      update() { return this; }
      then(resolve, reject) {
        const data = this.table === "payment_plans" ? [plan]
          : this.table === "organizations" ? [{ id: LIMITLESS_ID, name: "Company" }]
            : this.table === "reminder_templates" ? [{ id: "template-a", organization_id: LIMITLESS_ID, name: "On", timing_direction: "on", timing_days: 0, channel: "whatsapp", message_template: "{{client_name}}", enabled: true }]
              : [];
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      }
    }
    const runtimeModule = load("lib/limitless-installment-reminder-runtime.ts", {
      "@/lib/supabase/admin": { createAdminClient: () => ({ from: (table) => new Query(table) }) },
      "@/lib/whatsapp-delivery": { sendWhatsAppMessage: async () => { providerCalled = true; return { providerMessageId: "sent" }; } },
      "@/lib/flux-credits": { assertFluxFeatureAccess: async () => {}, reserveFluxCredits: async () => ({ ok: true }) },
      "@/lib/limitless-followup-contract": { followupErrorSummary: () => "safe_failure", LIMITLESS_REALTY_ORGANIZATION_ID: LIMITLESS_ID, limitlessPhoneCandidates: phoneContract.limitlessPhoneCandidates },
    }, "export { runLimitlessInstallmentReminderSweep };");
    const result = await runtimeModule.runLimitlessInstallmentReminderSweep(new Date("2026-11-01T08:05:00Z"));
    assert.equal(attemptInserted, false);
    assert.equal(providerCalled, false);
    assert.equal(result.status_counts.skipped, 1);
  }

  await runInvalid({ ...validPlan, total_paid: "0.001", outstanding_balance: "999.999" });
  await runInvalid({ ...validPlan, outstanding_balance: "900.00" });

  let providerCalled = false;
  let rpcArgs = null;
  const deniedAttempt = { id: "attempt-a", organization_id: LIMITLESS_ID, payment_plan_id: "plan-a", reminder_template_id: "template-a", scheduled_for: "2026-11-01T09:00:00.000Z", status: "failed", retry_count: 0 };
  class RetryQuery {
    constructor(table) { this.table = table; }
    select() { return this; }
    eq() { return this; }
    gt() { return this; }
    limit() { return this; }
    maybeSingle() {
      if (this.table === "payment_plans") return Promise.resolve({ data: validPlan, error: null });
      if (this.table === "leads") return Promise.resolve({ data: { id: "lead-a", opted_out: false }, error: null });
      if (this.table === "reminder_attempts") return Promise.resolve({ data: deniedAttempt, error: null });
      if (this.table === "reminder_templates") return Promise.resolve({ data: { id: "template-a", organization_id: LIMITLESS_ID, name: "On", timing_direction: "on", timing_days: 0, channel: "whatsapp", message_template: "{{client_name}}", enabled: true }, error: null });
      if (this.table === "whatsapp_template_configs") return Promise.resolve({ data: { template_name: "installment_reminder", language_code: "en", variable_keys: ["client_name", "property_title", "amount_paid", "outstanding_balance", "handover_agent_name", "handover_agent_phone", "company_name"], metadata: { approved_variable_order: ["client_name", "property_title", "amount_paid", "outstanding_balance", "handover_agent_name", "handover_agent_phone", "company_name"], company_name: "Company" }, status: "active" }, error: null });
      if (this.table === "organizations") return Promise.resolve({ data: { name: "Company" }, error: null });
      return Promise.resolve({ data: null, error: null });
    }
    update() { return this; }
    then(resolve, reject) { return Promise.resolve({ data: null, error: null }).then(resolve, reject); }
  }
  const runtimeModule = load("lib/limitless-installment-reminder-runtime.ts", {
    "@/lib/supabase/admin": { createAdminClient: () => ({
      from: (table) => new RetryQuery(table),
      rpc: async (name, args) => { assert.equal(name, "authorize_limitless_installment_reminder_send"); rpcArgs = args; return { data: { authorized: false, reason: "customer_opted_out" }, error: null }; },
    }) },
    "@/lib/whatsapp-delivery": { sendWhatsAppMessage: async () => { providerCalled = true; return { providerMessageId: "sent" }; } },
    "@/lib/flux-credits": { assertFluxFeatureAccess: async () => {}, reserveFluxCredits: async () => ({ ok: true }) },
    "@/lib/limitless-followup-contract": { followupErrorSummary: () => "safe_failure", LIMITLESS_REALTY_ORGANIZATION_ID: LIMITLESS_ID, limitlessPhoneCandidates: phoneContract.limitlessPhoneCandidates },
  }, "export { retryLimitlessInstallmentReminder };");
  const result = await runtimeModule.retryLimitlessInstallmentReminder({ organizationId: LIMITLESS_ID, planId: "plan-a", attemptId: "attempt-a" });
  assert.equal(result.status, "skipped");
  assert.equal(providerCalled, false);
  assert.deepEqual(rpcArgs.p_phone_candidates.includes("2348123456789"), true);
});

test("reminder logs retain safe delivery metadata only and scheduler output omits customer/payment identifiers", () => {
  const source = runtime();
  const sender = read("lib/whatsapp-delivery.ts");
  const cron = read("app/api/cron/limitless-installment-reminders/route.ts");
  assert.match(source, /followupErrorSummary\(error\)/);
  assert.match(source, /approved_template: approved\.template_name/);
  assert.match(source, /variable_keys: approved\.variable_keys/);
  assert.doesNotMatch(source, /payload: \{ values,/);
  assert.doesNotMatch(source, /local_template_preview:/);
  assert.doesNotMatch(source, /payload: \{[^}]*delivery\s*\}/);
  assert.match(source, /status_counts: statusCounts/);
  assert.doesNotMatch(source, /return \{ checkedPlans: plans\?\.length \|\| 0, processed: results\.filter/);
  assert.match(sender, /organizationId === LIMITLESS_REALTY_ORGANIZATION_ID && rows\.length !== 1/);
  assert.match(sender, /requestedTemplateName\)/);
  assert.match(sender, /recipient: "\[redacted\]"/);
  assert.match(sender, /request_payload: \{ redacted: true \}/);
  assert.doesNotMatch(cron, /error instanceof Error/);
});

test("payment sync advances due date only for a full installment and preserves tenant scope", () => {
  const source = migration();
  assert.match(source, /new\.advances_installment_schedule/);
  assert.match(source, /floor\(paid \/ plan_installment_amount\)/);
  assert.match(source, /public\.installment_frequency_interval\(plan_frequency\) \* installment_crossings/);
  assert.match(source, /advances_installment_schedule boolean not null default true/);
  assert.match(source, /and organization_id = tenant_id/);
  assert.match(source, /total_paid = paid/);
  assert.match(actions(), /advances_installment_schedule: false/);
  const paymentSyncFunction = source.split("create or replace function public.sync_payment_plan_reminder_state")[0];
  assert.doesNotMatch(paymentSyncFunction, /next_reminder_at\s*=/);
  assert.match(source, /next_reminder_at = next_scheduled_at/);
  assert.match(source, /interval '10 hours'/);
  const reminderStateFunction = source.split("create or replace function public.sync_payment_plan_reminder_state")[1].split("$function$;")[0];
  assert.match(reminderStateFunction, /reminder_interval interval := interval '14 days'/);
  assert.doesNotMatch(reminderStateFunction, /installment_frequency_interval/);
  assert.match(source, /v_expected_scheduled_at := coalesce\(\s*v_plan\.next_reminder_at/);
  assert.match(source, /reason', 'cursor_time_invalid/);
  assert.match(source, /new\.error_message is distinct from 'missed_reminder_window'/);
  assert.match(source, /status in \('pending','queued','sent','failed','cancelled','skipped','unknown'\)/);
});

test("explicit provider rejection remains manually retryable after the one-use send authorization", async () => {
  const plan = {
    id: "plan-a", organization_id: LIMITLESS_ID, contact_id: "lead-a", client_name: "Synthetic",
    client_phone: "08123456789", property_title: "Test property", currency: "NGN", agreed_price: "1000.00",
    total_paid: "0.00", outstanding_balance: "1000.00", installment_amount: "100.00", payment_type: "installment",
    frequency: "biweekly", next_due_date: "2026-11-01", final_due_date: null, reminder_template_id: "template-a",
    handover_agent_name: "Agent", handover_agent_phone: "2348000000000", status: "active", reminders_enabled: true,
  };
  const attempt = { id: "attempt-a", organization_id: LIMITLESS_ID, payment_plan_id: "plan-a", reminder_template_id: "template-a", scheduled_for: "2026-11-01T09:00:00.000Z", status: "failed", retry_count: 1, send_authorized_at: "2026-10-28T08:00:00.000Z" };
  const template = { id: "template-a", organization_id: LIMITLESS_ID, name: "On", timing_direction: "on", timing_days: 0, channel: "whatsapp", message_template: "Hello {{client_name}} {{property_title}} {{amount_paid}} {{outstanding_balance}} {{handover_agent_name}} {{handover_agent_phone}} {{company_name}}", enabled: true };
  const variableKeys = ["client_name", "property_title", "amount_paid", "outstanding_balance", "handover_agent_name", "handover_agent_phone", "company_name"];
  const approved = { template_name: "approved", language_code: "en", variable_keys: variableKeys, metadata: { approved_variable_order: variableKeys, company_name: "Company" }, status: "active" };
  const updates = [];
  const authorizationCalls = [];
  let providerCalls = 0;

  class RetryQuery {
    constructor(table) { this.table = table; this.filters = {}; this.updateValues = null; }
    select() { return this; }
    eq(key, value) { this.filters[key] = value; return this; }
    gt() { return this; }
    limit() { return this; }
    update(values) { this.updateValues = values; updates.push({ table: this.table, values }); return this; }
    maybeSingle() {
      if (this.table === "payment_plans") return Promise.resolve({ data: plan, error: null });
      if (this.table === "leads") return Promise.resolve({ data: { id: "lead-a", opted_out: false }, error: null });
      if (this.table === "reminder_attempts" && this.updateValues) return Promise.resolve({ data: { id: "attempt-a" }, error: null });
      if (this.table === "reminder_attempts") return Promise.resolve({ data: attempt, error: null });
      if (this.table === "reminder_templates") return Promise.resolve({ data: template, error: null });
      if (this.table === "whatsapp_template_configs") return Promise.resolve({ data: approved, error: null });
      if (this.table === "organizations") return Promise.resolve({ data: { name: "Company" }, error: null });
      return Promise.resolve({ data: null, error: null });
    }
    then(resolve, reject) { return Promise.resolve({ data: null, error: null }).then(resolve, reject); }
  }

  const runtimeModule = load("lib/limitless-installment-reminder-runtime.ts", {
    "@/lib/supabase/admin": { createAdminClient: () => ({ from: (table) => new RetryQuery(table), rpc: async (name, args) => { authorizationCalls.push({ name, args }); return { data: { authorized: true }, error: null }; } }) },
    "@/lib/whatsapp-delivery": { sendWhatsAppMessage: async () => { providerCalls += 1; const error = new Error("explicit provider rejection"); error.status = 400; throw error; } },
    "@/lib/flux-credits": { assertFluxFeatureAccess: async () => {}, reserveFluxCredits: async () => ({ credits: 1 }) },
    "@/lib/limitless-followup-contract": { followupErrorSummary: () => "WhatsApp template was rejected or is not configured.", LIMITLESS_REALTY_ORGANIZATION_ID: LIMITLESS_ID, limitlessPhoneCandidates: phoneContract.limitlessPhoneCandidates },
  }, "export { retryLimitlessInstallmentReminder };");

  const result = await runtimeModule.retryLimitlessInstallmentReminder({ organizationId: LIMITLESS_ID, planId: "plan-a", attemptId: "attempt-a" });
  assert.equal(result.status, "failed");
  assert.equal(providerCalls, 1);
  assert.equal(authorizationCalls.length, 1);
  assert.equal(authorizationCalls[0].name, "authorize_limitless_installment_reminder_send");
  assert.ok(updates.some((entry) => entry.values.status === "pending" && entry.values.send_authorized_at === null));
  assert.ok(updates.some((entry) => entry.values.status === "failed"));
});
