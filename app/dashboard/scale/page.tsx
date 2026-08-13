import { Building2, CreditCard, Gauge, Layers3 } from "@/components/admin/ServerIcons";
import { getPhase14Summary } from "@/lib/phase-14";
import SubscriptionControl from "./SubscriptionControl";

export const dynamic = "force-dynamic";

const money = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });

export default async function ScaleCenterPage() {
  const data = await getPhase14Summary();

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div><p className="admin-kicker">Phase 14</p><h1>Templates, plans and scale</h1><p>Manage reusable business systems, commercial plans, tenant subscriptions and platform usage from one control center.</p></div>
      </div>

      <div className="admin-metric-grid">
        <article className="admin-metric-card"><p><CreditCard size={15} /> Active subscriptions</p><strong>{data.metrics.activeSubscriptions}</strong><span>Manual and provider-backed plans</span></article>
        <article className="admin-metric-card"><p><Layers3 size={15} /> Active templates</p><strong>{data.metrics.templates}</strong><span>Reusable tenant systems</span></article>
        <article className="admin-metric-card"><p><Gauge size={15} /> Usage events</p><strong>{data.metrics.usageEvents}</strong><span>Latest 500 ledger entries</span></article>
        <article className="admin-metric-card"><p><Building2 size={15} /> Usage cost</p><strong>{money.format(data.metrics.usageCostMinor / 100)}</strong><span>Recorded platform cost</span></article>
      </div>

      <section className="admin-panel">
        <div className="admin-panel-header"><div><h2>Assign tenant plan</h2><p>Activate a plan manually while Paystack remains optional.</p></div></div>
        <SubscriptionControl organizations={data.organizations.map((item: any) => ({ id: item.id, name: item.name }))} plans={data.plans.filter((item) => item.status === "active").map((item) => ({ id: item.id, name: item.name }))} />
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header"><div><h2>Billing plans</h2><p>Plan prices and entitlements are stored in Supabase as the commercial source of truth.</p></div><span className="admin-status live">{data.plans.length} plans</span></div>
        <div className="admin-list">
          {data.plans.map((plan) => (
            <div className="admin-list-row" key={plan.id}>
              <div style={{ flex: 1 }}><strong>{plan.name}</strong><span>{money.format(Number(plan.installation_fee))} installation · {money.format(Number(plan.recurring_fee))}/{plan.billing_interval}</span><span>{plan.entitlements.filter((item) => item.enabled).map((item) => `${item.feature_key.replaceAll("_", " ")}${item.limit_value === null ? " unlimited" : ` ${item.limit_value}`}`).join(" · ")}</span></div>
              <span className={`admin-status ${plan.status === "active" ? "live" : "warning"}`}>{plan.status}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header"><div><h2>Industry templates</h2><p>Reusable organization systems available for one-click tenant provisioning.</p></div></div>
        <div className="admin-list">
          {data.templates.map((template: any) => <div className="admin-list-row" key={template.id}><div style={{ flex: 1 }}><strong>{template.name}</strong><span>{template.industry} · {(template.agents || []).length} agents · {(template.modules || []).length} modules · {(template.workflows || []).length} workflows</span></div><span className={`admin-status ${template.status === "active" ? "live" : "warning"}`}>{template.status}</span></div>)}
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header"><div><h2>Tenant subscriptions</h2><p>Current plan assignments and activation state.</p></div></div>
        <div className="admin-list">
          {data.subscriptions.map((subscription: any) => <div className="admin-list-row" key={subscription.id}><div style={{ flex: 1 }}><strong>{subscription.organizations?.name || subscription.organization_id}</strong><span>{subscription.billing_plans?.name || "Unknown plan"} · {subscription.provider || "manual"}</span></div><span className={`admin-status ${subscription.status === "active" ? "live" : "warning"}`}>{subscription.status}</span></div>)}
          {!data.subscriptions.length ? <p className="admin-empty">No tenant subscriptions assigned yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
