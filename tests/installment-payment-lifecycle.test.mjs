import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

test("Phase 1 payment records are tenant scoped and ledger-backed", () => {
  const actions = read("app/dashboard/limitless/payments/actions.ts");
  const payments = read("lib/limitless-payments.ts");
  assert.match(actions, /organizationId/);
  assert.match(actions, /createPaymentRecord\(\{/);
  assert.match(actions, /organization_id: organizationId/);
  assert.match(payments, /payment_records\?organization_id=eq/);
  assert.match(payments, /updatePaymentRecord\(organizationId: string, recordId: string/);
  assert.match(payments, /deletePaymentRecord\(organizationId: string, recordId: string/);
});

test("Phase 1 has a dedicated outright property payment action", () => {
  const page = read("app/dashboard/limitless/payments/page.tsx");
  const actions = read("app/dashboard/limitless/payments/actions.ts");
  assert.match(page, /\+ Add outright payment/);
  assert.match(page, /Record outright property payment/);
  assert.match(page, /createOutrightPaymentAction/);
  assert.match(actions, /payment_type: "outright"/);
  assert.match(actions, /status: "completed"/);
  assert.match(actions, /reminders_enabled: false/);
  assert.match(actions, /Outright property payment recorded/);
});

test("Phase 2 installment form requires a start date and supports an optional end date", () => {
  const page = read("app/dashboard/limitless/payments/installments/page.tsx");
  const actions = read("app/dashboard/limitless/payments/actions.ts");
  assert.match(page, /name="start_date"/);
  assert.match(page, /name="end_date"/);
  assert.doesNotMatch(page, /name="end_date"[^>]*required/);
  assert.match(actions, /function endAtFromForm/);
  assert.match(actions, /if \(!value\) return null/);
  assert.match(actions, /end_at: endAt/);
  assert.match(actions, /end date cannot be before the start date/);
});

test("Phase 2 schema distinguishes payment type and enforces end-date ordering", () => {
  const migration = read("supabase/migrations/20261006190000_property_payment_phase1_3.sql");
  assert.match(migration, /payment_type text not null default 'installment'/);
  assert.match(migration, /payment_type in \('installment','outright'\)/);
  assert.match(migration, /end_at timestamptz/);
  assert.match(migration, /end_at_after_start_check/);
  assert.match(migration, /end_at is null or end_at >= start_at/);
  assert.match(migration, /final_due_date::timestamptz/);
});

test("Phase 2 balance lifecycle remains payment-ledger authoritative", () => {
  const migration = read("supabase/migrations/20261006190000_property_payment_phase1_3.sql");
  assert.match(migration, /create or replace function public\.sync_payment_plan_total/);
  assert.match(migration, /select coalesce\(sum\(amount\), 0\)/);
  assert.match(migration, /status = case/);
  assert.match(migration, /then 'completed'/);
  assert.match(migration, /reminders_enabled = case/);
});

test("Phase 3 supports weekly, bi-weekly and monthly cadence", () => {
  const page = read("app/dashboard/limitless/payments/installments/page.tsx");
  const actions = read("app/dashboard/limitless/payments/actions.ts");
  const migration = read("supabase/migrations/20261006190000_property_payment_phase1_3.sql");
  for (const cadence of ["weekly", "biweekly", "monthly"]) {
    assert.match(page, new RegExp(`value="${cadence}"`));
    assert.match(actions, new RegExp(`"${cadence}"`));
  }
  assert.match(migration, /7 days/);
  assert.match(migration, /14 days/);
  assert.match(migration, /30 days/);
});

test("Phase 3 reminder runtime is tenant independent and installment-only", () => {
  const cron = read("app/api/cron/limitless-installment-reminders/route.ts");
  assert.match(cron, /organization_id/);
  assert.match(cron, /payment_type.*installment/);
  assert.match(cron, /installment_payment_reminder/);
  assert.match(cron, /outstanding_balance/);
  assert.match(cron, /reminders_enabled/);
  assert.match(cron, /property_title/);
  assert.doesNotMatch(cron, /b15f21b4-5697-4d21-9421-8a34eae3476d/);
});

test("Phase 3 uses the approved seven-variable Meta template contract", () => {
  const cron = read("app/api/cron/limitless-installment-reminders/route.ts");
  const activation = read("supabase/migrations/20261007150000_fix_limitless_installment_reminder_template_contract.sql");
  assert.match(cron, /client_name: String\(plan\.client_name/);
  assert.match(cron, /property_title: String\(plan\.property_title/);
  assert.match(cron, /amount_paid: formatMoney/);
  assert.match(cron, /outstanding_balance: formatMoney/);
  assert.match(cron, /handover_agent_name/);
  assert.match(cron, /handover_agent_phone/);
  assert.match(cron, /company_name: organizationName/);
  assert.match(cron, /templatePurpose: "installment_payment_reminder"/);
  assert.match(cron, /variableKeys.length !== EXPECTED_VARIABLE_KEYS.length/);
  assert.match(cron, /variableKeys.some\(\(key, index\) => key !== EXPECTED_VARIABLE_KEYS\[index\]\)/);
  assert.match(activation, /limitless_realty_reminder/);
  assert.match(activation, /en_US/);
  assert.match(activation, /'Landsmith Estate'/);
  assert.match(activation, /'2348127753308'/);
  assert.match(activation, /company_name/);
  assert.match(activation, /handover_agent_phone/);
});

test("Phase 3 installment creation form sends the required handover fields", () => {
  const page = read("app/dashboard/limitless/payments/installments/page.tsx");
  const actions = read("app/dashboard/limitless/payments/actions.ts");
  assert.match(page, /name="handover_agent_name"/);
  assert.match(page, /name="handover_agent_phone"/);
  assert.match(page, /value="2348127753308"/);
  assert.match(page, /payment-handover-card/);
  assert.match(page, /Limitless Realty Handover/);
  assert.match(actions, /formData\.get\("handover_agent_name"\) \|\| "Limitless Realty Handover"/);
  assert.match(actions, /formData\.get\("handover_agent_phone"\) \|\| "2348127753308"/);
});

test("Fluxknight errors are user-safe and do not expose technical diagnostics", () => {
  const safe = read("lib/user-safe-errors.ts");
  const globalBoundary = read("app/error.tsx");
  const workspaceBoundary = read("app/dashboard/limitless/error.tsx");
  assert.match(safe, /console\.error|user-safe|friendly/i);
  assert.match(safe, /We couldn't complete that request right now/);
  assert.match(globalBoundary, /toUserSafeMessage\(error\)/);
  assert.match(workspaceBoundary, /toUserSafeMessage\(error\)/);
  assert.doesNotMatch(globalBoundary, /error\.message/);
  assert.doesNotMatch(workspaceBoundary, /error\.message/);
  assert.doesNotMatch(globalBoundary, /error\.digest.*<|digest.*error/i);
  assert.doesNotMatch(workspaceBoundary, /error\.digest.*<|digest.*error/i);
});

test("Friendly error boundaries cover global, dashboard, and tenant-scoped workspaces", () => {
  const globalBoundary = read("app/error.tsx");
  const rootBoundary = read("app/global-error.tsx");
  const dashboardBoundary = read("app/dashboard/limitless/error.tsx");
  const scope = read("lib/admin-organization-scope.ts");
  for (const boundary of [globalBoundary, rootBoundary, dashboardBoundary]) {
    assert.match(boundary, /toUserSafeMessage\(error\)/);
    assert.doesNotMatch(boundary, /\{error\.message\}/);
    assert.doesNotMatch(boundary, /<[^>]*>.*error\.digest/);
  }
  assert.match(scope, /context\.kind === "tenant"/);
  assert.match(scope, /organizationId: String\(data\.id\)/);
  assert.match(scope, /organizations/);
});

test("Phase 3 payment intent has a configured human handover target", () => {
  const migration = read("supabase/migrations/20261007150000_fix_limitless_installment_reminder_template_contract.sql");
  assert.match(migration, /handover_agent_phone.*2348127753308/);
});

test("Phase 3 payment completion stops reminders", () => {
  const migration = read("supabase/migrations/20261006190000_property_payment_phase1_3.sql");
  assert.match(migration, /paid >= agreed_price/);
  assert.match(migration, /then false/);
  assert.match(migration, /then null/);
});
