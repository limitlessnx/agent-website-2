import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync("app/dashboard/limitless/payments/installments/page.tsx", "utf8");
const actions = readFileSync("app/dashboard/limitless/payments/actions.ts", "utf8");
const payments = readFileSync("lib/limitless-payments.ts", "utf8");
const cron = readFileSync("app/api/cron/limitless-installment-reminders/route.ts", "utf8");
const migration = readFileSync("supabase/migrations/20261005133000_installment_payment_plan_v2.sql", "utf8");
const vercel = readFileSync("vercel.json", "utf8");

test("installment UI uses agreed amount plus variable payments, not a fixed periodic amount", () => {
  assert.match(page, /name="agreed_price"/);
  assert.match(page, /name="amount_paid"/);
  assert.match(page, /outstanding_balance/);
  assert.doesNotMatch(page, /name="installment_amount"/);
  assert.match(page, /name="end_date"/);
  assert.match(page, /End date is the expected completion date/);
  assert.match(actions, /endAtFromForm/);
  assert.match(actions, /end_at: endAt/);
});

test("installment UI has weekly, bi-weekly and monthly cadence with a required end date", () => {
  for (const cadence of ["weekly", "biweekly", "monthly"]) assert.match(page, new RegExp(`value="${cadence}"`));
  assert.match(page, /name="end_date"/);
  assert.match(page, /overdue after this date/);
});

test("installment creation is tenant scoped and records the initial amount as a payment ledger entry", () => {
  assert.match(actions, /organization_id: organizationId/);
  assert.match(actions, /createPaymentRecord\(\{/);
  assert.match(actions, /Initial amount recorded/);
  assert.match(actions, /payment_plan_id: plan\.id/);
});

test("payment mutations are tenant scoped", () => {
  assert.match(actions, /updatePaymentRecord\(organizationId, recordId/);
  assert.match(actions, /deletePaymentRecord\(organizationId, recordId/);
  assert.match(actions, /updatePaymentPlan\(organizationId, planId/);
  assert.match(payments, /payment_records\?organization_id=eq/);
  assert.match(payments, /payment_plans\?organization_id=eq/);
});

test("installment reminder runtime is tenant independent and has no hardcoded Limitless organization id", () => {
  assert.doesNotMatch(cron, /b15f21b4-5697-4d21-9421-8a34eae3476d/);
  assert.doesNotMatch(cron, /LIMITLESS_REALTY_ORG/);
  assert.match(cron, /organization_id/);
  assert.match(cron, /installment_payment_reminder/);
  assert.match(cron, /reminders_enabled/);
  assert.match(cron, /status.*active/);
  assert.match(cron, /payment_type.*installment/);
});

test("reminder cadence is 7, 14 or 30 days and stops at zero balance", () => {
  assert.match(cron, /return 7/);
  assert.match(cron, /return 30/);
  assert.match(cron, /return 14/);
  assert.match(cron, /outstanding <= 0/);
  assert.match(cron, /next_reminder_at/);
});

test("approved Meta template variables are mapped in numbered order through whatsapp template config", () => {
  assert.match(migration, /installment_payment_reminder/);
  assert.match(migration, /client_name/);
  assert.match(migration, /property_name/);
  assert.match(migration, /amount_paid/);
  assert.match(migration, /outstanding_balance/);
  assert.match(migration, /handover_agent_name/);
  assert.match(migration, /handover_agent_phone/);
  assert.match(migration, /company_name/);
});

test("payment sync completes plans and disables reminders when the balance reaches zero", () => {
  assert.match(migration, /status = case/);
  assert.match(migration, /then 'completed'/);
  assert.match(migration, /reminders_enabled = case/);
  assert.match(migration, /then false/);
  assert.match(migration, /next_reminder_at = case/);
});

test("daily Vercel cron runs the cadence-aware reminder sweep", () => {
  assert.match(vercel, /\/api\/cron\/limitless-installment-reminders/);
  assert.match(vercel, /"0 9 \* \* \*"/);
});


test("outright property payments have a dedicated dashboard action and become completed non-reminding records", () => {
  const dashboard = readFileSync("app/dashboard/limitless/payments/page.tsx", "utf8");
  assert.match(dashboard, /\+ Add outright payment/);
  assert.match(dashboard, /Record outright property payment/);
  assert.match(dashboard, /createOutrightPaymentAction/);
  assert.match(actions, /createOutrightPaymentAction/);
  assert.match(actions, /payment_type: "outright"/);
  assert.match(actions, /status: "completed"/);
  assert.match(actions, /reminders_enabled: false/);
  assert.match(actions, /Outright property payment recorded/);
});

test("payment schema distinguishes outright and installment plans and enforces end-date ordering", () => {
  const schema = readFileSync("supabase/migrations/20261006190000_property_payment_phase1_3.sql", "utf8");
  assert.match(schema, /payment_type text not null default 'installment'/);
  assert.match(schema, /payment_type in \('installment','outright'\)/);
  assert.match(schema, /end_at timestamptz/);
  assert.match(schema, /end_at_after_start/);
  assert.match(schema, /end_at is null or end_at >= start_at/);
});

test("payment lifecycle remains tenant scoped for both payment types", () => {
  assert.match(actions, /resolveAdminOrganizationScope/);
  assert.match(actions, /\.eq\("organization_id", organizationId\)/);
  assert.match(payments, /payment_plans\?organization_id=eq/);
  assert.match(payments, /payment_records\?organization_id=eq/);
});
