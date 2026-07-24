import { CreditCard, BellRing, WalletCards, AlertTriangle } from "lucide-react";
import { getPaymentPlans, getPaymentRecords, getReminderTemplates, formatNaira } from "@/lib/limitless-payments";
import { getProperties } from "@/lib/limitless-data";
import { createPaymentPlanAction, recordPaymentAction, saveReminderTemplateAction, updatePlanStatusAction } from "./actions";
import "./payments.css";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  let plans = [] as Awaited<ReturnType<typeof getPaymentPlans>>;
  let records = [] as Awaited<ReturnType<typeof getPaymentRecords>>;
  let templates = [] as Awaited<ReturnType<typeof getReminderTemplates>>;
  let error = "";
  const properties = await getProperties(200);
  try {
    [plans, records, templates] = await Promise.all([getPaymentPlans(), getPaymentRecords(), getReminderTemplates()]);
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "Payment tables are not ready.";
  }

  const agreed = plans.reduce((sum, plan) => sum + Number(plan.agreed_price || 0), 0);
  const paid = plans.reduce((sum, plan) => sum + Number(plan.total_paid || 0), 0);
  const outstanding = plans.reduce((sum, plan) => sum + Number(plan.outstanding_balance || 0), 0);
  const overdue = plans.filter((plan) => plan.status === "overdue").length;

  return (
    <div className="admin-page payment-page">
      <div className="admin-page-header">
        <div><p className="admin-kicker">Limitless Realty</p><h1>Payments & Installments</h1><p>Record client payments, calculate balances, and configure reminder placeholders.</p></div>
      </div>

      <div className="admin-metric-grid">
        <article className="admin-metric-card"><p><WalletCards size={15}/> Agreed value</p><strong>{formatNaira(agreed)}</strong><span>{plans.length} payment plans</span></article>
        <article className="admin-metric-card"><p><CreditCard size={15}/> Total paid</p><strong>{formatNaira(paid)}</strong><span>Recorded payments</span></article>
        <article className="admin-metric-card"><p><BellRing size={15}/> Outstanding</p><strong>{formatNaira(outstanding)}</strong><span>Pending collection</span></article>
        <article className="admin-metric-card"><p><AlertTriangle size={15}/> Overdue</p><strong>{overdue}</strong><span>Plans needing attention</span></article>
      </div>

      {error ? <section className="admin-panel"><p className="admin-empty">{error} Run migration 005 before using this module.</p></section> : null}

      <div className="payment-grid">
        <section className="admin-panel">
          <div className="admin-panel-header"><div><h2>Create installment plan</h2><p>Add the client, property, pricing, and due dates.</p></div></div>
          <form action={createPaymentPlanAction} className="payment-form">
            <input name="client_name" placeholder="Client name" required />
            <input name="client_phone" placeholder="Phone number" required />
            <input name="client_email" type="email" placeholder="Email (optional)" />
            <select name="property_id"><option value="">Select property</option>{properties.map((property)=><option key={property.id} value={property.id}>{property.title}</option>)}</select>
            <input name="property_title" placeholder="Property title" required />
            <input name="agreed_price" type="number" min="0" placeholder="Agreed price (₦)" required />
            <input name="installment_amount" type="number" min="0" placeholder="Installment amount (₦)" />
            <select name="frequency"><option value="custom">Custom</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option></select>
            <label>Next due date<input name="next_due_date" type="date" /></label>
            <label>Final due date<input name="final_due_date" type="date" /></label>
            <input name="assigned_agent" placeholder="Assigned agent" />
            <textarea name="notes" placeholder="Notes" rows={3} />
            <label className="payment-check"><input name="reminders_enabled" type="checkbox" defaultChecked /> Enable reminders</label>
            <button className="admin-button" type="submit">Create plan</button>
          </form>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-header"><div><h2>Record payment</h2><p>Balance updates automatically after every entry.</p></div></div>
          <form action={recordPaymentAction} className="payment-form">
            <select name="payment_plan_id" required><option value="">Select client plan</option>{plans.map((plan)=><option key={plan.id} value={plan.id}>{plan.client_name} · {plan.property_title}</option>)}</select>
            <input name="amount" type="number" min="1" placeholder="Amount paid (₦)" required />
            <input name="payment_date" type="date" defaultValue={new Date().toISOString().slice(0,10)} required />
            <select name="payment_method"><option value="bank_transfer">Bank transfer</option><option value="cash">Cash</option><option value="card">Card</option><option value="other">Other</option></select>
            <input name="payment_reference" placeholder="Payment reference" />
            <textarea name="notes" placeholder="Payment notes" rows={3} />
            <button className="admin-button" type="submit">Record payment</button>
          </form>
        </section>
      </div>

      <section className="admin-panel">
        <div className="admin-panel-header"><div><h2>Payment plans</h2><p>Outstanding balance equals agreed price minus all recorded payments.</p></div></div>
        <div className="payment-plan-list">
          {plans.map((plan)=><article key={plan.id} className="payment-plan-card">
            <div><strong>{plan.client_name}</strong><span>{plan.client_phone} · {plan.property_title}</span></div>
            <div className="payment-figures"><span>Agreed <b>{formatNaira(plan.agreed_price)}</b></span><span>Paid <b>{formatNaira(plan.total_paid)}</b></span><span>Outstanding <b>{formatNaira(plan.outstanding_balance)}</b></span></div>
            <div className="payment-meta"><span>Next due: {plan.next_due_date || "Not set"}</span><span>Reminders: {plan.reminders_enabled ? "Enabled" : "Paused"}</span></div>
            <form action={updatePlanStatusAction} className="payment-status-form"><input type="hidden" name="payment_plan_id" value={plan.id}/><select name="status" defaultValue={plan.status}><option value="active">Active</option><option value="due_soon">Due soon</option><option value="overdue">Overdue</option><option value="completed">Completed</option><option value="paused">Paused</option><option value="cancelled">Cancelled</option></select><button type="submit">Update</button></form>
          </article>)}
          {!plans.length && !error ? <p className="admin-empty">No payment plans created yet.</p> : null}
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header"><div><h2>Reminder sequence placeholders</h2><p>Configure timing, channel, copy, and escalation later. Nothing is hard-coded.</p></div></div>
        <div className="reminder-grid">
          {templates.map((template)=><form key={template.id} action={saveReminderTemplateAction} className="reminder-card">
            <input type="hidden" name="template_id" value={template.id}/><input name="name" defaultValue={template.name}/><input name="position" type="number" min="1" defaultValue={template.position}/>
            <select name="timing_direction" defaultValue={template.timing_direction}><option value="before">Before due date</option><option value="on">On due date</option><option value="after">After due date</option></select>
            <input name="timing_days" type="number" min="0" defaultValue={template.timing_days}/><select name="channel" defaultValue={template.channel}><option value="placeholder">Placeholder</option><option value="whatsapp">WhatsApp</option><option value="email">Email</option><option value="sms">SMS</option></select>
            <textarea name="message_template" rows={4} defaultValue={template.message_template}/><input name="escalation_action" defaultValue={template.escalation_action}/><label className="payment-check"><input name="enabled" type="checkbox" defaultChecked={template.enabled}/> Enabled</label><button className="admin-button secondary" type="submit">Save placeholder</button>
          </form>)}
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header"><div><h2>Recent payment records</h2><p>Latest entries across all plans.</p></div></div>
        <div className="admin-list">{records.slice(0,20).map((record)=><div key={record.id} className="admin-list-row compact"><div><strong>{formatNaira(record.amount)}</strong><span>{record.payment_date} · {record.payment_method || "Method not set"} · {record.payment_reference || "No reference"}</span></div></div>)}{!records.length && !error ? <p className="admin-empty">No payments recorded yet.</p> : null}</div>
      </section>
    </div>
  );
}
