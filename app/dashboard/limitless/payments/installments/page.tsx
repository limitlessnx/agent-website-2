import Link from "next/link";
import { resolveAdminOrganizationScope } from "@/lib/admin-organization-scope";
import {
  getPaymentPlans,
  getPaymentRecords,
  getReminderTemplates,
  formatMoney,
} from "@/lib/limitless-payments";
import { getProperties } from "@/lib/limitless-data";
import { getCampaignAudienceLeads } from "@/lib/lead-profile-service";
import {
  createPaymentPlanAction,
  recordPaymentAction,
  updatePlanStatusAction,
  saveReminderTemplateAction,
} from "../actions";
import ContactPicker from "@/components/admin/ContactPicker";
import PaymentSubmitButton from "../PaymentSubmitButton";
import "../payments.css";

export const dynamic = "force-dynamic";

const DEFAULT_TEMPLATE = `Hello {{client_name}} 👋

Just a quick update regarding your installment payment for {{property_name}}.

You have currently paid {{amount_paid}}, with {{outstanding_balance}} remaining.

Your installment plan is still active, so we're reaching out with a friendly reminder regarding your payment.

If you need any information or assistance with your payment, please contact {{handover_agent_name}} on WhatsApp: {{handover_agent_phone}}.

We're happy to assist.

Thank you for choosing {{company_name}}.`;

function dateLabel(value: string | null | undefined) {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeZone: "Africa/Lagos",
  }).format(new Date(value));
}

export default async function InstallmentsPage() {
  const scope = await resolveAdminOrganizationScope();
  const { organizationId } = scope;

  const [plans, records, properties, contacts, templates] = await Promise.all([
    getPaymentPlans(organizationId, 250),
    getPaymentRecords(organizationId, 500),
    getProperties(200),
    getCampaignAudienceLeads(organizationId, 1000),
    getReminderTemplates(organizationId),
  ]);

  const totalAgreed = plans.reduce((sum, plan) => sum + Number(plan.agreed_price || 0), 0);
  const totalPaid = plans.reduce((sum, plan) => sum + Number(plan.total_paid || 0), 0);
  const outstanding = plans.reduce((sum, plan) => sum + Number(plan.outstanding_balance || 0), 0);
  const activePlans = plans.filter((plan) => plan.status === "active");
  const template = templates.find((item) => item.name === "Installment Payment Reminder") || templates[0];
  const templateText = template?.message_template || DEFAULT_TEMPLATE;

  return (
    <div className="admin-page payment-page">
      <div className="admin-page-header">
        <div>
          <p className="admin-kicker">{scope.name}</p>
          <h1>Installment Client Management</h1>
          <p>
            Track the agreed amount, payments received, outstanding balance, and friendly recurring WhatsApp check-ins.
          </p>
        </div>
        <div className="admin-page-actions">
          <a href="#add-installment-client" className="admin-button">+ Add installment client</a>
          <Link href="/dashboard/limitless/payments" className="admin-button secondary">← Payments overview</Link>
        </div>
      </div>

      <section className="admin-panel installment-create-panel" id="add-installment-client">
        <div className="admin-panel-header">
          <div>
            <h2>New installment plan</h2>
            <p>There is no fixed periodic payment and no end date. The client can pay variable amounts until the outstanding balance reaches zero.</p>
          </div>
        </div>

        <form action={createPaymentPlanAction} className="payment-form">
          <ContactPicker contacts={contacts} />

          <label>
            Property / service context
            <select name="property_id">
              <option value="">Select from properties</option>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>{property.title}</option>
              ))}
            </select>
          </label>

          <input name="property_title" placeholder="Property or service name" required />
          <label>
            Agreed amount
            <input name="agreed_price" type="number" min="1" step="0.01" placeholder="Total agreed amount" required />
          </label>

          <label>
            Amount paid so far
            <input name="amount_paid" type="number" min="0" step="0.01" placeholder="0" defaultValue="0" />
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
            Reminder cadence
            <select name="frequency" defaultValue="biweekly">
              <option value="weekly">Weekly</option>
              <option value="biweekly">Bi-weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>

          <label>
            Start date
            <input name="start_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
          </label>

          <div className="payment-inline-note">
            <strong>No end date</strong>
            <span>Reminders continue until payment is complete or the plan is manually paused/cancelled.</span>
          </div>

          <label>
            Handover agent name
            <input name="handover_agent_name" placeholder="Who should the client contact?" required />
          </label>

          <label>
            Handover WhatsApp
            <input name="handover_agent_phone" placeholder="+234..." inputMode="tel" required />
          </label>

          <input name="notes" placeholder="Internal notes (optional)" />

          <label className="payment-check">
            <input name="reminders_enabled" type="checkbox" defaultChecked />
            Enable recurring reminders
          </label>

          <PaymentSubmitButton>Create installment plan</PaymentSubmitButton>
        </form>
      </section>

      <div className="admin-metric-grid">
        <article className="admin-metric-card"><p>Active plans</p><strong>{activePlans.length}</strong><span>Currently reminding</span></article>
        <article className="admin-metric-card"><p>Agreed</p><strong>{formatMoney(totalAgreed, plans[0]?.currency || "NGN")}</strong><span>Total agreed value</span></article>
        <article className="admin-metric-card"><p>Paid</p><strong>{formatMoney(totalPaid, plans[0]?.currency || "NGN")}</strong><span>Recorded payments</span></article>
        <article className="admin-metric-card"><p>Outstanding</p><strong>{formatMoney(outstanding, plans[0]?.currency || "NGN")}</strong><span>Remaining balance</span></article>
      </div>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h2>Installment clients</h2>
            <p>Payments recalculate the balance automatically. When it reaches zero, the plan is completed and reminders stop.</p>
          </div>
        </div>

        <div className="payment-plan-list">
          {plans.map((plan) => (
            <article key={plan.id} className="payment-plan-card">
              <div>
                <strong>{plan.client_name}</strong>
                <span>{plan.client_phone} · {plan.property_title}</span>
              </div>

              <div className="payment-figures">
                <span>Agreed <b>{formatMoney(plan.agreed_price, plan.currency)}</b></span>
                <span>Paid <b>{formatMoney(plan.total_paid, plan.currency)}</b></span>
                <span>Outstanding <b>{formatMoney(plan.outstanding_balance, plan.currency)}</b></span>
              </div>

              <div className="payment-meta">
                <span>Status: {plan.status}</span>
                <span>Cadence: {plan.frequency}</span>
                <span>Next reminder: {dateLabel(plan.next_reminder_at)}</span>
                <span>Reminders: {plan.reminders_enabled ? "Active" : "Stopped"}</span>
              </div>

              <div className="payment-meta">
                <span>Handover: {plan.handover_agent_name || "Not set"}</span>
                <span>{plan.handover_agent_phone || ""}</span>
              </div>

              <form action={updatePlanStatusAction} className="payment-status-form">
                <input type="hidden" name="payment_plan_id" value={plan.id} />
                <select name="frequency" defaultValue={plan.frequency || "biweekly"}>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
                <PaymentSubmitButton className="payment-status-button">Set cadence</PaymentSubmitButton>
              </form>

              <form action={updatePlanStatusAction} className="payment-status-form">
                <input type="hidden" name="payment_plan_id" value={plan.id} />
                <select name="status" defaultValue={plan.status}>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <PaymentSubmitButton className="payment-status-button">Update status</PaymentSubmitButton>
              </form>

              <details>
                <summary>Record payment</summary>
                <form action={recordPaymentAction} className="payment-form">
                  <input type="hidden" name="payment_plan_id" value={plan.id} />
                  <input name="amount" type="number" min="0.01" max={Number(plan.outstanding_balance || 0)} step="0.01" placeholder="Amount received" required />
                  <input name="payment_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
                  <select name="payment_method">
                    <option value="bank_transfer">Bank transfer</option>
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="other">Other</option>
                  </select>
                  <input name="payment_reference" placeholder="Payment reference" />
                  <textarea name="notes" rows={2} placeholder="Payment notes" />
                  <PaymentSubmitButton>Save payment</PaymentSubmitButton>
                </form>
              </details>
            </article>
          ))}

          {!plans.length ? <p className="admin-empty">No installment clients found.</p> : null}
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h2>Reminder template</h2>
            <p>
              This is the editable Fluxknight copy used for preview/configuration. Actual WhatsApp delivery uses the tenant's approved Meta template configuration.
            </p>
          </div>
        </div>

        <form action={saveReminderTemplateAction} className="payment-form">
          <input type="hidden" name="template_id" value={template?.id || ""} />
          <input name="name" defaultValue={template?.name || "Installment Payment Reminder"} placeholder="Template name" required />
          <textarea name="message_template" defaultValue={templateText} rows={12} required />
          <div className="payment-inline-note">
            <strong>Available variables</strong>
            <span>
              {"{{client_name}} · {{property_name}} · {{amount_paid}} · {{outstanding_balance}} · {{handover_agent_name}} · {{handover_agent_phone}} · {{company_name}}"}
            </span>
          </div>
          <label className="payment-check">
            <input name="enabled" type="checkbox" defaultChecked={template?.enabled ?? true} />
            Enable template
          </label>
          <PaymentSubmitButton>Save reminder template</PaymentSubmitButton>
        </form>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h2>Recent payments</h2>
            <p>{records.length} payment records available.</p>
          </div>
        </div>
        <div className="admin-list">
          {records.slice(0, 30).map((record) => (
            <div key={record.id} className="admin-list-row compact">
              <strong>{formatMoney(record.amount, plans.find((p) => p.id === record.payment_plan_id)?.currency || "NGN")}</strong>
              <span>{record.payment_date} · {record.payment_method || "Other"}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
