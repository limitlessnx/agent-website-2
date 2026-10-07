import { resolveAdminOrganizationScope } from "@/lib/admin-organization-scope";
import Link from "next/link";
import { getPaymentPlans, getPaymentRecords, formatNaira } from "@/lib/limitless-payments";
import { getProperties } from "@/lib/limitless-data";
import { getCampaignAudienceLeads } from "@/lib/lead-profile-service";
import { createPaymentPlanAction, recordPaymentAction, updatePlanStatusAction } from "../actions";
import ContactPicker from "@/components/admin/ContactPicker";
import PaymentSubmitButton from "../PaymentSubmitButton";
import "../payments.css";

export const dynamic = "force-dynamic";

export default async function InstallmentsPage() {
  const { organizationId } = await resolveAdminOrganizationScope();
  const [plans, records, properties, contacts] = await Promise.all([getPaymentPlans(organizationId, 250), getPaymentRecords(organizationId, 500), getProperties(200), getCampaignAudienceLeads(organizationId, 1000)]);
  const totalAgreed = plans.reduce((s,p)=>s+Number(p.agreed_price||0),0);
  const totalPaid = plans.reduce((s,p)=>s+Number(p.total_paid||0),0);
  const outstanding = plans.reduce((s,p)=>s+Number(p.outstanding_balance||0),0);

  return <div className="admin-page payment-page">
    <div className="admin-page-header">
      <div><p className="admin-kicker">Limitless Realty</p><h1>Installment Client Management</h1><p>Manage every installment client, record payments, update status, and control reminder cadence.</p></div>
      <div className="admin-page-actions"><a href="#add-installment-client" className="admin-button">+ Add new installment client</a><Link href="/dashboard/limitless/payments" className="admin-button secondary">← Payments overview</Link></div>
    </div>

    <section className="admin-panel installment-create-panel" id="add-installment-client">
      <div className="admin-panel-header">
        <div><h2>Add new installment client</h2><p>Select an existing Lead/contact to avoid re-entering their details, or create a new contact from the Leads directory first.</p></div>
      </div>
      <form action={createPaymentPlanAction} className="payment-form">
        <ContactPicker contacts={contacts} />
        <select name="property_id"><option value="">Select property</option>{properties.map((property)=><option key={property.id} value={property.id}>{property.title}</option>)}</select>
        <input name="property_title" placeholder="Property title" required />
        <input name="agreed_price" type="number" min="0" placeholder="Agreed price (₦)" required />
        <label>Amount paid so far<input name="amount_paid" type="number" min="0" step="0.01" placeholder="0" defaultValue="0" /></label>
        <select name="frequency"><option value="biweekly">Bi-weekly</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select>
        <label>Start date<input name="start_date" type="date" defaultValue={new Date().toISOString().slice(0,10)} required /></label>
        <label>End date<input name="end_date" type="date" /></label>
        <input type="hidden" name="handover_agent_name" value="Limitless Realty Handover" />
        <input type="hidden" name="handover_agent_phone" value="2348127753308" />
        <div className="payment-handover-card"><strong>Assigned agent</strong><span>Limitless Realty Handover</span><small>WhatsApp: 2348127753308</small></div>
        <textarea name="notes" placeholder="Notes" rows={3} />
        <label className="payment-check"><input name="reminders_enabled" type="checkbox" defaultChecked /> Enable reminders</label>
        <PaymentSubmitButton>Create installment plan</PaymentSubmitButton>
      </form>
    </section>

    <div className="admin-metric-grid">
      <article className="admin-metric-card"><p>Clients</p><strong>{plans.length}</strong><span>Installment plans</span></article>
      <article className="admin-metric-card"><p>Agreed revenue</p><strong>{formatNaira(totalAgreed)}</strong><span>Total contract value</span></article>
      <article className="admin-metric-card"><p>Collected</p><strong>{formatNaira(totalPaid)}</strong><span>Recorded payments</span></article>
      <article className="admin-metric-card"><p>Outstanding</p><strong>{formatNaira(outstanding)}</strong><span>Still collectible</span></article>
    </div>

    <section className="admin-panel">
      <div className="admin-panel-header"><div><h2>Installment clients</h2><p>Variable payments update the outstanding balance automatically. The end date is the expected completion date, while overdue balances remain eligible for follow-up.</p></div></div>
      <div className="payment-plan-list">
        {plans.map(plan => <article key={plan.id} className="payment-plan-card">
          <div><strong>{plan.client_name}</strong><span>{plan.client_phone} · {plan.property_title}</span></div>
          <div className="payment-figures"><span>Agreed <b>{formatNaira(plan.agreed_price)}</b></span><span>Paid <b>{formatNaira(plan.total_paid)}</b></span><span>Outstanding <b>{formatNaira(plan.outstanding_balance)}</b></span></div>
          <div className="payment-meta"><span>Type: {plan.payment_type === "outright" ? "Outright" : "Installment"}</span><span>Cadence: {plan.frequency || "biweekly"}</span><span>End date: {plan.end_at ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeZone: "Africa/Lagos" }).format(new Date(plan.end_at)) : "Not set"}</span><span>Reminders: {plan.reminders_enabled ? "Active" : "Stopped"}</span></div>
          <form action={updatePlanStatusAction} className="payment-status-form"><input type="hidden" name="payment_plan_id" value={plan.id}/><input type="hidden" name="status" value={plan.status}/><select name="frequency" defaultValue={plan.frequency || "biweekly"}><option value="weekly">Weekly</option><option value="biweekly">Bi-weekly</option><option value="monthly">Monthly</option></select><PaymentSubmitButton className="payment-status-button">Set cadence</PaymentSubmitButton></form>
          <form action={updatePlanStatusAction} className="payment-status-form">
            <input type="hidden" name="payment_plan_id" value={plan.id}/>
            <select name="status" defaultValue={plan.status}><option value="active">Active</option><option value="due_soon">Due soon</option><option value="overdue">Overdue</option><option value="completed">Completed</option><option value="paused">Paused</option><option value="cancelled">Cancelled</option></select>
            <PaymentSubmitButton className="payment-status-button">Update</PaymentSubmitButton>
          </form>
          <details><summary>Record payment</summary><form action={recordPaymentAction} className="payment-form">
            <input type="hidden" name="payment_plan_id" value={plan.id}/>
            <input name="amount" type="number" min="1" placeholder="Amount paid (₦)" required/>
            <input name="payment_date" type="date" defaultValue={new Date().toISOString().slice(0,10)} required/>
            <select name="payment_method"><option value="bank_transfer">Bank transfer</option><option value="cash">Cash</option><option value="card">Card</option><option value="other">Other</option></select>
            <input name="payment_reference" placeholder="Payment reference"/>
            <textarea name="notes" rows={2} placeholder="Payment notes"/>
            <PaymentSubmitButton>Save payment</PaymentSubmitButton>
          </form></details>
        </article>)}
        {!plans.length ? <p className="admin-empty">No installment clients found.</p> : null}
      </div>
    </section>

    <section className="admin-panel">
      <div className="admin-panel-header"><div><h2>Reminder cadence</h2><p>Each active plan can use Weekly, Bi-weekly, or Monthly cadence. The default is Bi-weekly.</p></div></div>
      <div className="reminder-grid">
        <div className="reminder-card"><strong>Weekly</strong><p>Send the installment check-in every 7 days while the balance remains outstanding.</p></div>
        <div className="reminder-card"><strong>Bi-weekly</strong><p>Send every 14 days. This is the default cadence.</p></div>
        <div className="reminder-card"><strong>Monthly</strong><p>Send every 30 days while the plan remains active.</p></div>
      </div>
    </section>

    <section className="admin-panel">
      <div className="admin-panel-header"><div><h2>Recent payments</h2><p>{records.length} payment records available.</p></div></div>
      <div className="admin-list">{records.slice(0,30).map(r=><div key={r.id} className="admin-list-row compact"><strong>{formatNaira(r.amount)}</strong><span>{r.payment_date} · {r.payment_method || "Other"}</span></div>)}</div>
    </section>
  </div>;
}
