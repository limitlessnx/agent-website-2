import { resolveAdminOrganizationScope } from "@/lib/admin-organization-scope";
import Link from "next/link";
import { CreditCard, BellRing, WalletCards } from "@/components/admin/ServerIcons";
import { getPaymentPlans, getPaymentRecords, formatMoney } from "@/lib/limitless-payments";
import { getProperties } from "@/lib/limitless-data";
import { getCampaignAudienceLeads } from "@/lib/lead-profile-service";
import { createOutrightPaymentAction, recordPaymentAction } from "./actions";
import PaymentRecordActions from "./PaymentRecordActions";
import PaymentSubmitButton from "./PaymentSubmitButton";
import ContactPicker from "@/components/admin/ContactPicker";
import "./payments.css";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const { organizationId, name } = await resolveAdminOrganizationScope();
  let plans = [] as Awaited<ReturnType<typeof getPaymentPlans>>;
  let records = [] as Awaited<ReturnType<typeof getPaymentRecords>>;
  let error = "";
  const [properties, contacts] = await Promise.all([
    getProperties(200),
    getCampaignAudienceLeads(organizationId, 1000),
  ]);

  try {
    [plans, records] = await Promise.all([
      getPaymentPlans(organizationId, 250),
      getPaymentRecords(organizationId, 500),
    ]);
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "Payment tables are not ready.";
  }

  const agreed = plans.reduce((sum, plan) => sum + Number(plan.agreed_price || 0), 0);
  const paid = plans.reduce((sum, plan) => sum + Number(plan.total_paid || 0), 0);
  const outstanding = plans.reduce((sum, plan) => sum + Number(plan.outstanding_balance || 0), 0);
  const active = plans.filter((plan) => plan.status === "active").length;
  const planById = new Map(plans.map((plan) => [plan.id, plan]));

  return (
    <div className="admin-page payment-page">
      <div className="admin-page-header">
        <div>
          <p className="admin-kicker">{name}</p>
          <h1>Payments & Installments</h1>
          <p>Track variable client payments, outstanding balances, and recurring reminder plans.</p>
        </div>
        <div className="admin-page-actions">
          <a href="#add-outright-payment" className="admin-button secondary">+ Add outright payment</a>
          <Link href="/dashboard/limitless/payments/installments" className="admin-button">Open installment management →</Link>
        </div>
      </div>

      <div className="admin-metric-grid">
        <article className="admin-metric-card"><p><WalletCards size={15}/> Active plans</p><strong>{active}</strong><span>Currently running</span></article>
        <article className="admin-metric-card"><p><WalletCards size={15}/> Agreed</p><strong>{formatMoney(agreed, plans[0]?.currency || "NGN")}</strong><span>Total agreed value</span></article>
        <article className="admin-metric-card"><p><CreditCard size={15}/> Paid</p><strong>{formatMoney(paid, plans[0]?.currency || "NGN")}</strong><span>Recorded payments</span></article>
        <article className="admin-metric-card"><p><BellRing size={15}/> Outstanding</p><strong>{formatMoney(outstanding, plans[0]?.currency || "NGN")}</strong><span>Remaining balance</span></article>
      </div>

      {error ? <section className="admin-panel"><p className="admin-empty">{error}</p></section> : null}

      <section className="admin-panel outright-payment-panel" id="add-outright-payment">
        <div className="admin-panel-header">
          <div>
            <h2>Record outright property payment</h2>
            <p>Use this for a property that has already been paid in full. It creates a completed payment record without starting an installment reminder plan.</p>
          </div>
        </div>
        <form action={createOutrightPaymentAction} className="payment-form">
          <ContactPicker contacts={contacts} />
          <label>
            Property
            <select name="property_id">
              <option value="">Select property</option>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>{property.title}</option>
              ))}
            </select>
          </label>
          <input name="property_title" placeholder="Property title" required />
          <label>
            Amount paid in full
            <input name="amount" type="number" min="0.01" step="0.01" placeholder="Full property price" required />
          </label>
          <label>
            Currency
            <select name="currency" defaultValue="NGN">
              <option value="NGN">NGN · Nigerian Naira</option>
              <option value="USD">USD · US Dollar</option>
              <option value="GBP">GBP · British Pound</option>
              <option value="EUR">EUR · Euro</option>
              <option value="GHS">GHS · Ghanaian Cedi</option>
              <option value="KES">KES · Kenyan Shilling</option>
            </select>
          </label>
          <label>
            Payment date
            <input name="payment_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
          </label>
          <select name="payment_method"><option value="bank_transfer">Bank transfer</option><option value="cash">Cash</option><option value="card">Card</option><option value="other">Other</option></select>
          <input name="payment_reference" placeholder="Payment reference" />
          <textarea name="notes" placeholder="Notes" rows={3} />
          <PaymentSubmitButton>Save outright payment</PaymentSubmitButton>
        </form>
      </section>

      <div className="payment-grid">
        <section className="admin-panel">
          <div className="admin-panel-header"><div><h2>Record payment</h2><p>Every payment updates the plan total and outstanding balance automatically.</p></div></div>
          <form action={recordPaymentAction} className="payment-form">
            <select name="payment_plan_id" required>
              <option value="">Select client plan</option>
              {plans.filter((plan) => Number(plan.outstanding_balance || 0) > 0).map((plan) => (
                <option key={plan.id} value={plan.id}>{plan.client_name} · {plan.property_title}</option>
              ))}
            </select>
            <input name="amount" type="number" min="0.01" step="0.01" placeholder="Amount paid" required />
            <input name="payment_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
            <select name="payment_method"><option value="bank_transfer">Bank transfer</option><option value="cash">Cash</option><option value="card">Card</option><option value="other">Other</option></select>
            <input name="payment_reference" placeholder="Payment reference" />
            <textarea name="notes" placeholder="Payment notes" rows={3} />
            <PaymentSubmitButton>Record payment</PaymentSubmitButton>
          </form>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-header"><div><h2>Installment model</h2><p>No fixed periodic payment amount. Clients can make variable payments until the agreed amount is fully paid.</p></div></div>
          <div className="payment-inline-note"><strong>Reminder cadence</strong><span>Weekly, bi-weekly, or monthly. Plans now have a defined end date, while overdue balances remain eligible for follow-up. Reminders stop automatically at zero balance or when the plan is paused/cancelled.</span></div>
          <Link href="/dashboard/limitless/payments/installments" className="admin-button secondary">Manage plans & template</Link>
        </section>
      </div>

      <section className="admin-panel">
        <div className="admin-panel-header"><div><h2>Payment plans</h2><p>Outstanding balance equals agreed amount minus all recorded payments.</p></div></div>
        <div className="payment-plan-list">
          {plans.map((plan) => (
            <article key={plan.id} className="payment-plan-card">
              <div><strong>{plan.client_name}</strong><span>{plan.client_phone} · {plan.property_title}</span></div>
              <div className="payment-figures"><span>Agreed <b>{formatMoney(plan.agreed_price, plan.currency)}</b></span><span>Paid <b>{formatMoney(plan.total_paid, plan.currency)}</b></span><span>Outstanding <b>{formatMoney(plan.outstanding_balance, plan.currency)}</b></span></div>
              <div className="payment-meta"><span>Type: {plan.payment_type === "outright" ? "Outright" : "Installment"}</span><span>Status: {plan.status}</span><span>End date: {plan.end_at ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeZone: "Africa/Lagos" }).format(new Date(plan.end_at)) : "Not set"}</span><span>Reminders: {plan.reminders_enabled ? "Active" : "Stopped"}</span></div>
            </article>
          ))}
          {!plans.length && !error ? <p className="admin-empty">No installment plans created yet.</p> : null}
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header"><div><h2>Recent payment records</h2><p>Edit or delete an entry when a payment was recorded incorrectly.</p></div></div>
        <div className="admin-list">
          {records.slice(0, 20).map((record) => {
            const plan = planById.get(record.payment_plan_id);
            return <div key={record.id} className="admin-list-row compact payment-record-row"><PaymentRecordActions record={record} />{plan ? <span className="payment-record-client">{plan.client_name} · {plan.property_title}</span> : null}</div>;
          })}
          {!records.length && !error ? <p className="admin-empty">No payments recorded yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
