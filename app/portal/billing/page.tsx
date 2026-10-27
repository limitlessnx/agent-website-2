import Link from "next/link";
import { redirect } from "next/navigation";
import { CreditCard, WalletCards } from "@/components/admin/ServerIcons";
import { getClientSession } from "@/lib/client-auth";
import { getFluxWalletSummary } from "@/lib/flux-credits";
import { getFluxCommercialSnapshot } from "@/lib/flux-commercial";
import { getTenantBusinessValueAnalytics } from "@/lib/analytics-phase-e";
import { getOrganizationAccessContext } from "@/lib/organization-membership";
import { createAdminClient } from "@/lib/supabase/admin";
import FluxCreditTopUpForm from "./FluxCreditTopUpForm";

export const metadata = { title: "Billing | Fluxknight" };
export const dynamic = "force-dynamic";

function formatDate(value: string | null) {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(new Date(value));
}
function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
function formatNumber(value: number) {
  return new Intl.NumberFormat("en-NG").format(value);
}
function transactionLabel(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function PortalBillingPage() {
  const session = await getClientSession();
  if (!session) return null;
  const access = session.isAdminPreview ? null : await getOrganizationAccessContext(session.organizationId, session.userId).catch(() => null);
  if (!session.isAdminPreview && (!access || !["billing.view", "billing.manage"].some((permission) => access.permissions.has(permission)))) redirect("/portal");
  const canManageBilling = Boolean(access?.permissions.has("billing.manage"));
  const admin = createAdminClient();
  const [wallet, commercial, ledgerResult, businessValue] = await Promise.all([
    getFluxWalletSummary(session.organizationId),
    getFluxCommercialSnapshot(session.organizationId),
    admin.from("flux_credit_ledger")
      .select("id,transaction_type,action_key,credit_delta,balance_after,source,reason,created_at")
      .eq("organization_id", session.organizationId)
      .order("created_at", { ascending: false })
      .limit(12),
    getTenantBusinessValueAnalytics(session.organizationId, 30).catch(() => null),
  ]);
  if (ledgerResult.error) console.error("[portal/billing] Unable to load tenant credit history", ledgerResult.error);
  const transactions = ledgerResult.data || [];

  return (
    <main className="portal-page">
      <section className="portal-hero">
        <div>
          <p className="portal-kicker">Billing</p>
          <h1>Flux Credits</h1>
          <p>Track your credit balance, renewal date, usage, and credit transactions.</p>
        </div>
        <div className="portal-status-badge"><span>Plan</span><strong>{wallet.planName}</strong></div>
      </section>
      {wallet.customerMessage ? (
        <section className="portal-card" style={{ borderColor: wallet.chargeableAiPaused ? "#ef4444" : "#f59e0b" }}>
          <div className="portal-card-head"><div><h2>{wallet.chargeableAiPaused ? "AI paused" : "Credit warning"}</h2><p>{wallet.customerMessage}</p></div></div>
        </section>
      ) : null}
      <section className="portal-metrics">
        <article className="portal-metric"><span><WalletCards size={16} /> Monthly credits</span><strong>{formatNumber(wallet.monthlyCredits)}</strong><small>Total cycle allowance</small></article>
        <article className="portal-metric"><span><CreditCard size={16} /> Remaining</span><strong>{formatNumber(wallet.balance)}</strong><small>{formatNumber(wallet.used)} used</small></article>
        <article className="portal-metric"><span>Usage</span><strong>{wallet.percentUsed}%</strong><small>{wallet.threshold ? `${wallet.threshold}% threshold reached` : "Within normal range"}</small></article>
        <article className="portal-metric"><span>Renewal</span><strong>{formatDate(wallet.renewalDate)}</strong><small>{wallet.trialEndsAt ? `Trial ends ${formatDate(wallet.trialEndsAt)}` : "Monthly reset"}</small></article>
      </section>
      <section className="portal-grid">
        <article className="portal-card">
          <div className="portal-card-head"><div><h2>Subscription</h2><p>Your commercial access state and current billing period.</p></div></div>
          <div className="portal-list">
            <div className="portal-list-row"><div><strong>Status</strong><span>{commercial.subscription?.provider||"No provider"}</span></div><em>{commercial.subscription?.status||"No subscription"}</em></div>
            <div className="portal-list-row"><div><strong>Billing plan</strong><span>{commercial.subscription?.billingInterval||"—"}</span></div><em>{commercial.subscription?.planName||wallet.planName}</em></div>
            <div className="portal-list-row"><div><strong>Service package</strong><span>Systems and operational entitlement package</span></div><em>{commercial.servicePackage?.packageName||"Not assigned"}</em></div>
            <div className="portal-list-row"><div><strong>Active systems</strong><span>{commercial.systems.needsAttention} need attention</span></div><em>{commercial.systems.active}</em></div>
          </div>
        </article>
        <article className="portal-card">
          <div className="portal-card-head"><div><h2>Usage policy</h2><p>Flux Credits are the uniform usage unit across chargeable tenant AI actions.</p></div></div>
          <div className="portal-list">
            <div className="portal-list-row"><div><strong>At 70%</strong><span>Usage warning</span></div><em>Heads-up</em></div>
            <div className="portal-list-row"><div><strong>At 90%</strong><span>Near exhaustion warning</span></div><em>Action recommended</em></div>
            <div className="portal-list-row"><div><strong>At 100%</strong><span>Chargeable AI pauses; dashboard and human operations stay available</span></div><em>Paused</em></div>
          </div>
          <p className="portal-empty">Fluxknight does not silently create postpaid overages. Add credits, renew, or upgrade to restore chargeable AI.</p>
        </article>
      </section>
      <section className="portal-grid">
        <article className="portal-card">
          <div className="portal-card-head"><div><h2>Credit status</h2><p>{wallet.percentUsed}% of this cycle has been used.</p></div></div>
          <div className="portal-progress">
            <div className="portal-progress-row"><span>Current cycle</span><div><i style={{ width: `${wallet.percentUsed}%` }} /></div><strong>{wallet.percentUsed}%</strong></div>
            <div className="portal-progress-row"><span>Available</span><div><i style={{ width: `${Math.max(0, 100 - wallet.percentUsed)}%` }} /></div><strong>{formatNumber(wallet.balance)}</strong></div>
          </div>
        </article>
        <article className="portal-card">
          <div className="portal-card-head"><div><h2>Top up Flux Credits</h2><p>1 Flux Credit = $0.01 of customer-facing usage value. Minimum top-up: $10 = 1,000 credits.</p></div></div>
          {canManageBilling && wallet.canTopUp ? <FluxCreditTopUpForm /> : canManageBilling ? <p className="portal-empty">Top-ups become available after the Basic trial converts.</p> : <p className="portal-empty">You have read-only billing access. Ask an organization owner or billing manager to purchase credits.</p> }
          <div className="portal-actions" style={{marginTop:20}}><Link className="portal-button secondary" href="/pricing#plan-details">Upgrade plan</Link></div>
          <p className="portal-empty">Top-ups increase usage capacity only. They do not unlock higher-plan features.</p>
        </article>
      </section>
      <section className="portal-card">
        <div className="portal-card-head"><div><h2>Business value & ROI</h2><p>Measured activity and estimated time/value based on your organization’s configured assumptions. These estimates are not guaranteed revenue.</p></div></div>
        {businessValue?.configured ? <>
          <div className="portal-metrics">
            <article className="portal-metric"><span>AI-handled conversations</span><strong>{formatNumber(businessValue.automationVolume.aiHandledConversations)}</strong><small>Last 30 days</small></article>
            <article className="portal-metric"><span>Completed follow-ups</span><strong>{formatNumber(businessValue.automationVolume.completedFollowUps)}</strong><small>Last 30 days</small></article>
            <article className="portal-metric"><span>Confirmed appointments</span><strong>{formatNumber(businessValue.automationVolume.confirmedAppointments)}</strong><small>Last 30 days</small></article>
            <article className="portal-metric"><span>Estimated time saved</span><strong>{businessValue.estimatedHoursSaved == null ? "—" : businessValue.estimatedHoursSaved.toLocaleString("en-NG", { maximumFractionDigits: 1 }) + " hr"}</strong><small>Based on configured time assumptions</small></article>
          </div>
          <div className="portal-list" style={{marginTop:16}}>
            <div className="portal-list-row"><div><strong>Estimated value of time saved</strong><span>Uses the configured hourly value and measured activity volume</span></div><em>{businessValue.estimatedValue == null ? "Not available" : new Intl.NumberFormat("en-NG", {style:"currency",currency:businessValue.currency || "USD",maximumFractionDigits:2}).format(businessValue.estimatedValue)}</em></div>
          </div>
        </> : <p className="portal-empty">ROI estimates are not configured for this workspace yet. Usage and credit records remain available above; business-value estimates will appear once the organization’s assumptions are configured.</p>}
        <div className="portal-actions" style={{marginTop:16}}><Link className="portal-button secondary" href="/portal/analytics">View operational analytics</Link></div>
      </section>

      <section className="portal-card">
        <div className="portal-card-head"><div><h2>Recent credit transactions</h2><p>Credits added, used, or adjusted for this workspace. Only your organization’s records are shown.</p></div></div>
        {transactions.length ? <div className="portal-list">
          {transactions.map((item) => <div className="portal-list-row" key={item.id}>
            <div><strong>{transactionLabel(item.transaction_type || item.action_key || "credit transaction")}</strong><span>{item.reason || item.source || "Flux Credit ledger"} · {formatTimestamp(item.created_at)}</span></div>
            <em>{item.credit_delta > 0 ? "+" : ""}{formatNumber(item.credit_delta)} · balance {formatNumber(item.balance_after)}</em>
          </div>)}
        </div> : <p className="portal-empty">No credit transactions have been recorded yet.</p>}
      </section>
    </main>
  );
}
