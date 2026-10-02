import Link from "next/link";
import { getPaymentPlans, getPaymentRecords, formatNaira } from "@/lib/limitless-payments";
import { recordPaymentAction, updatePlanStatusAction, updatePlanCadenceAction } from "../actions";
import PaymentSubmitButton from "../PaymentSubmitButton";
import "../payments.css";

export const dynamic = "force-dynamic";

export default async function InstallmentsPage() {
  const [plans, records] = await Promise.all([getPaymentPlans(250), getPaymentRecords(500)]);
  const totalAgreed = plans.reduce((s,p)=>s+Number(p.agreed_price||0),0);
  const totalPaid = plans.reduce((s,p)=>s+Number(p.total_paid||0),0);
  const outstanding = plans.reduce((s,p)=>s+Number(p.outstanding_balance||0),0);

  return <div className="admin-page payment-page">
    <div className="admin-page-header">
      <div><p className="admin-kicker">Limitless Realty</p><h1>Installment Client Management</h1><p>Manage every installment client, record payments, update status, and control reminder cadence.</p></div>
      <Link href="/dashboard/limitless/payments" className="admin-button secondary">← Payments overview</Link>
    </div>

    <div className="admin-metric-grid">
      <article className="admin-metric-card"><p>Clients</p><strong>{plans.length}</strong><span>Installment plans</span></article>
      <article className="admin-metric-card"><p>Agreed revenue</p><strong>{formatNaira(totalAgreed)}</strong><span>Total contract value</span></article>
      <article className="admin-metric-card"><p>Collected</p><strong>{formatNaira(totalPaid)}</strong><span>Recorded payments</span></article>
      <article className="admin-metric-card"><p>Outstanding</p><strong>{formatNaira(outstanding)}</strong><span>Still collectible</span></article>
    </div>

    <section className="admin-panel">
      <div className="admin-panel-header"><div><h2>Installment clients</h2><p>Reminders stop automatically when a plan is completed, cancelled, or paused.</p></div></div>
      <div className="payment-plan-list">
        {plans.map(plan => <article key={plan.id} className="payment-plan-card">
          <div><strong>{plan.client_name}</strong><span>{plan.client_phone} · {plan.property_title}</span></div>
          <div className="payment-figures"><span>Agreed <b>{formatNaira(plan.agreed_price)}</b></span><span>Paid <b>{formatNaira(plan.total_paid)}</b></span><span>Outstanding <b>{formatNaira(plan.outstanding_balance)}</b></span></div>
          <div className="payment-meta"><span>Next due: {plan.next_due_date || "Not set"}</span><span>Cadence: {plan.frequency || "biweekly"}</span><span>Reminders: {plan.reminders_enabled ? "Active" : "Paused"}</span></div>
          <form action={updatePlanCadenceAction} className="payment-status-form"><input type="hidden" name="payment_plan_id" value={plan.id}/><select name="frequency" defaultValue={plan.frequency || "biweekly"}><option value="weekly">Weekly</option><option value="biweekly">Bi-weekly</option><option value="monthly">Monthly</option></select><PaymentSubmitButton className="payment-status-button">Set cadence</PaymentSubmitButton></form>
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
