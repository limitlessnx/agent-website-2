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

test("Phase 3 uses the approved installment Meta template variable contract", () => {
  const cron = read("app/api/cron/limitless-installment-reminders/route.ts");
  const activation = read("supabase/migrations/20261007120000_activate_limitless_installment_reminders.sql");

  assert.match(cron, /client_name: String\(plan\.client_name/);
  assert.match(cron, /property_title: String\(plan\.property_title/);
  assert.match(cron, /outstanding_balance: formatMoney/);
  assert.match(cron, /templatePurpose: "installment_payment_reminder"/);
  assert.match(activation, /installment_payment_reminder/);
  assert.match(activation, /limitless_realty_reminder/);
  assert.match(activation, /en_US/);
  assert.match(activation, /\["client_name","property_title","outstanding_balance"\]/);
  assert.match(activation, /provider_status.*approved/);
});

test("Phase 3 payment completion stops reminders", () => {
  const migration = read("supabase/migrations/20261006190000_property_payment_phase1_3.sql");
  assert.match(migration, /paid >= agreed_price/);
  assert.match(migration, /then false/);
  assert.match(migration, /then null/);
});
