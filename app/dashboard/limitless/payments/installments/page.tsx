import { resolveAdminOrganizationScope } from "@/lib/admin-organization-scope";
import Link from "next/link";
import { getPaymentPlans, formatNaira } from "@/lib/limitless-payments";
import { getProperties } from "@/lib/limitless-data";
import { getCampaignAudienceLeads } from "@/lib/lead-profile-service";
import { createPaymentPlanAction, recordPaymentAction, updatePlanStatusAction } from "../actions";
import ContactPicker from "@/components/admin/ContactPicker";
import PaymentSubmitButton from "../PaymentSubmitButton";
import "../payments.css";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

export default async function InstallmentsPage({ searchParams }: { searchParams?: Promise<{ success?: string; page?: string }> }) {
  const { organizationId } = await resolveAdminOrganizationScope();
  const params = searchParams ? await searchParams : {};
  const [plans, properties, contacts] = await Promise.all([
    getPaymentPlans(organizationId, 250),
    getProperties(200),
    getCampaignAudienceLeads(organizationId, 1000),
  ]);

  const totalAgreed = plans.reduce((s, p) => s + Number(p.agreed_price || 0), 0);
  const totalPaid = plans.reduce((s, p) => s + Number(p.total_paid || 0), 0);
  const outstanding = plans.reduce((s, p) => s + Number(p.outstanding_balance || 0), 0);

  const pageCount = Math.max(1, Math.ceil(plans.length / PAGE_SIZE));
  const requestedPage = Number.parseInt(params.page || "1", 10);
  const currentPage = Number.isFinite(requestedPage)
    ? Math.min(pageCount, Math.max(1, requestedPage))
    : 1;
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const visiblePlans = plans.slice(pageStart, pageStart + PAGE_SIZE);
  const firstVisible = plans.length ? pageStart + 1 : 0;
  const lastVisible = Math.min(pageStart + PAGE_SIZE, plans.length);

  return <div className="admin-page payment-page">
    <div className="admin-page-header">
      <div><p className="admin-kicker">Limitless Realty</p><h1>Installment Client Management</h1><p>Manage every installment client, record payments, update status, and control reminder cadence.</p></div>
      <div className="admin-page-actions"><a href="#add-installment-client" className="admin-button">+ Add new installment client</a><Link href="/dashboard/limitless/payments" className="admin-button secondary">← Payments overview</Link></div>
    </div>

    {params.success === "installment-created" && (
      <div className="payment-success-banner" role="status" aria-live="polite">
        <span className="payment-success-icon" aria-hidden="true">✓</span>
        <div><strong>Installment created successfully</strong><span>The installment plan has been saved and is now visible in the Installment clients list below.</span></div>
      </div>
    )}

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
      <div className="admin-panel-header">
        <div>
          <h2>Installment clients <span className="payment-count-badge">{plans.length}</span></h2>
          <p>Each client stays compact until you open their details. Select a client to manage cadence, status, or payments.</p>
        </div>
        {plans.length > 0 && <span className="payment-list-range">Showing {firstVisible}–{lastVisible} of {plans.length}</span>}
      </div>

      <div className="payment-plan-list">
        {visiblePlans.map((plan, index) => {
          const isNewest = currentPage === 1 && index === 0;
          return <details key={plan.id} className={"payment-plan-card" + (isNewest ? " payment-plan-card-new" : "")}>
            <summary className="payment-plan-summary">
              <div className="payment-plan-summary-main">
                <strong>{plan.client_name}</strong>
                <span>{plan.property_title} · {plan.client_phone}</span>
              </div>
              <div className="payment-plan-summary-amount">
                <span>Outstanding</span>
                <b>{formatNaira(plan.outstanding_balance)}</b>
              </div>
              {isNewest && <span className="payment-new-badge">New</span>}
              <span className="payment-plan-chevron" aria-hidden="true">⌄</span>
            </summary>

            <div className="payment-plan-details">
              <div className="payment-figures">
                <span>Agreed <b>{formatNaira(plan.agreed_price)}</b></span>
                <span>Paid <b>{formatNaira(plan.total_paid)}</b></span>
                <span>Outstanding <b>{formatNaira(plan.outstanding_balance)}</b></span>
              </div>

              <div className="payment-meta">
                <span>Type: {plan.payment_type === "outright" ? "Outright" : "Installment"}</span>
                <span>Cadence: {plan.frequency || "biweekly"}</span>
                <span>Start date: {plan.start_at ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeZone: "Africa/Lagos" }).format(new Date(plan.start_at)) : "Not set"}</span>
                <span>End date: {plan.end_at ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeZone: "Africa/Lagos" }).format(new Date(plan.end_at)) : "Not set"}</span>
                <span>Reminders: {plan.reminders_enabled ? "Active" : "Stopped"}</span>
                {plan.notes ? <span>Notes: {plan.notes}</span> : null}
              </div>

              <div className="payment-plan-actions">
                <form action={updatePlanStatusAction} className="payment-status-form">
                  <input type="hidden" name="payment_plan_id" value={plan.id}/>
                  <input type="hidden" name="status" value={plan.status}/>
                  <select name="frequency" defaultValue={plan.frequency || "biweekly"}><option value="weekly">Weekly</option><option value="biweekly">Bi-weekly</option><option value="monthly">Monthly</option></select>
                  <PaymentSubmitButton className="payment-status-button">Set cadence</PaymentSubmitButton>
                </form>

                <form action={updatePlanStatusAction} className="payment-status-form">
                  <input type="hidden" name="payment_plan_id" value={plan.id}/>
                  <select name="status" defaultValue={plan.status}><option value="active">Active</option><option value="due_soon">Due soon</option><option value="overdue">Overdue</option><option value="completed">Completed</option><option value="paused">Paused</option><option value="cancelled">Cancelled</option></select>
                  <PaymentSubmitButton className="payment-status-button">Update</PaymentSubmitButton>
                </form>
              </div>

              <details className="payment-record-details">
                <summary>Record payment</summary>
                <form action={recordPaymentAction} className="payment-form">
                  <input type="hidden" name="payment_plan_id" value={plan.id}/>
                  <input name="amount" type="number" min="1" placeholder="Amount paid (₦)" required/>
                  <input name="payment_date" type="date" defaultValue={new Date().toISOString().slice(0,10)} required/>
                  <select name="payment_method"><option value="bank_transfer">Bank transfer</option><option value="cash">Cash</option><option value="card">Card</option><option value="other">Other</option></select>
                  <input name="payment_reference" placeholder="Payment reference"/>
                  <textarea name="notes" rows={2} placeholder="Payment notes"/>
                  <PaymentSubmitButton>Save payment</PaymentSubmitButton>
                </form>
              </details>
            </div>
          </details>
        })}
        {!plans.length ? <p className="admin-empty">No installment clients found.</p> : null}
      </div>

      {plans.length > PAGE_SIZE && (
        <nav className="payment-pagination" aria-label="Installment client pages">
          {currentPage > 1 ? <Link href={"?page=" + (currentPage - 1)} className="payment-pagination-button">← Previous</Link> : <span className="payment-pagination-button disabled">← Previous</span>}
          <span className="payment-pagination-current">Page {currentPage} of {pageCount}</span>
          {currentPage < pageCount ? <Link href={"?page=" + (currentPage + 1)} className="payment-pagination-button">Next →</Link> : <span className="payment-pagination-button disabled">Next →</span>}
        </nav>
      )}
    </section>
  </div>;
}
