import Link from "next/link";
import { CreditCard, WalletCards } from "@/components/admin/ServerIcons";
import { getClientSession } from "@/lib/client-auth";
import { getFluxWalletSummary } from "@/lib/flux-credits";
import { getFluxCommercialSnapshot } from "@/lib/flux-commercial";
import FluxCreditTopUpForm from "./FluxCreditTopUpForm";

export const metadata = { title: "Billing | Fluxknight" };
export const dynamic = "force-dynamic";

function formatDate(value: string | null) {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(new Date(value));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-NG").format(value);
}

export default async function PortalBillingPage() {
  const session = await getClientSession();
  if (!session) return null;
  const [wallet,commercial] = await Promise.all([
    getFluxWalletSummary(session.organizationId),
    getFluxCommercialSnapshot(session.organizationId),
  ]);

  return (
    <main className="portal-page">
      <section className="portal-hero">
        <div>
          <p className="portal-kicker">Billing</p>
          <h1>Flux Credits</h1>
          <p>Track your current credit balance, renewal date, and usage warnings without exposing internal feature consumption.</p>
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
          <div className="portal-card-head"><div>
            <h2>Top up Flux Credits</h2>
            <p>1 Flux Credit = $0.01 of customer-facing usage value. Minimum top-up: $10 = 1,000 credits.</p>
          </div></div>
          {wallet.canTopUp ? <FluxCreditTopUpForm /> : <p className="portal-empty">Top-ups become available after the Basic trial converts.</p>}
          <div className="portal-actions" style={{marginTop:20}}>
            <Link className="portal-button secondary" href="/pricing#plan-details">Upgrade plan</Link>
          </div>
          <p className="portal-empty">Top-ups increase usage capacity only. They do not unlock higher-plan features.</p>
        </article>
      </section>
    </main>
  );
}
