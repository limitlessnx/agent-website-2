import MetricCard from "@/components/admin/MetricCard";
import { redirect } from "next/navigation";
import { WalletCards } from "@/components/admin/ServerIcons";
import { getAdminSession } from "@/lib/admin-auth";
import { getFluxInternalUsageSummary } from "@/lib/flux-credits";
import { getFluxCommercialSnapshot } from "@/lib/flux-commercial";
import { createAdminClient } from "@/lib/supabase/admin";
import CreditReservationRecovery from "./CreditReservationRecovery";
import CreditAdjustmentForm from "./CreditAdjustmentForm";

export const dynamic = "force-dynamic";
function formatCredits(value: number) { return new Intl.NumberFormat("en-US").format(value); }
function formatMoney(cents: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100); }
function formatTimestamp(value: string) { return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function transactionLabel(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }

export default async function AdminBillingPage({ searchParams }: { searchParams?: Promise<{ organizationId?: string }> }) {
  const session = await getAdminSession();
  if (!session) redirect("/login");
  const params = await searchParams;
  const admin = createAdminClient();
  const [{ data: organizations, error }, { data: wallets, error: walletError }] = await Promise.all([
    admin.from("organizations").select("id,name,slug,status").order("name", { ascending: true }).limit(200),
    admin.from("flux_credit_wallets").select("organization_id,balance,monthly_allowance,top_up_balance,bonus_balance,status"),
  ]);
  if (error) throw error;
  if (walletError) throw walletError;
  const walletByOrganization = new Map((wallets || []).map((wallet) => [wallet.organization_id, wallet]));
  const selectedOrganizationId = params?.organizationId || organizations?.find((organization) => organization.status === "active")?.id || organizations?.[0]?.id;
  const selectedOrganization = organizations?.find((organization) => organization.id === selectedOrganizationId) || null;
  const [usage, commercial, ledgerResult] = selectedOrganizationId ? await Promise.all([
    getFluxInternalUsageSummary(selectedOrganizationId),
    getFluxCommercialSnapshot(selectedOrganizationId),
    admin.from("flux_credit_ledger")
      .select("id,transaction_type,action_key,credit_delta,balance_after,source,provider,reason,created_by,created_at,metadata")
      .eq("organization_id", selectedOrganizationId)
      .order("created_at", { ascending: false })
      .limit(30),
  ]) : [null, null, { data: [], error: null }];
  if (ledgerResult?.error) throw ledgerResult.error;
  const transactions = ledgerResult?.data || [];
  const recovery = selectedOrganization ? await admin.from("flux_credit_reservations")
    .select("id,status,reserved_credits,action_key,created_at").eq("organization_id", selectedOrganization.id)
    .in("status", ["held", "needs_attention"]).order("created_at", { ascending: true }).limit(20) : null;

  return (
    <main className="admin-page">
      <section className="admin-hero">
        <div><p className="admin-kicker">Super Admin</p><h1>Flux Credits &amp; margins</h1><p>Inspect tenant balances, usage, provider cost, customer value, margin, and the auditable credit ledger.</p></div>
        <div className="admin-hero-icon"><WalletCards size={24} /></div>
      </section>
      <section className="admin-grid two">
        <article className="admin-card">
          <h2>Tenant wallets</h2>
          <p className="admin-note">Showing up to 200 organizations. Select a tenant to inspect its ledger and make an audited adjustment.</p>
          <div className="admin-list">
            {(organizations || []).map((organization) => {
              const wallet = walletByOrganization.get(organization.id);
              return <a className="admin-list-row" aria-current={organization.id === selectedOrganizationId ? "page" : undefined} href={`/dashboard/billing?organizationId=${encodeURIComponent(organization.id)}`} key={organization.id}>
                <div><strong>{organization.name}</strong>
                <span>{organization.slug} · {organization.status}</span></div>
                <span>{wallet ? `${formatCredits(wallet.balance)} / ${formatCredits(wallet.monthly_allowance)} credits · ${formatCredits(wallet.top_up_balance)} top-up` : "Wallet not provisioned"}</span>
              </a>;
            })}
          </div>
        </article>
        {usage && selectedOrganization ? <article className="admin-card">
          <h2>{selectedOrganization.name}</h2>
          <div className="admin-list">
            <div className="admin-list-row"><span>Plan</span><strong>{usage.planName}</strong></div>
            <div className="admin-list-row"><span>Monthly credits</span><strong>{formatCredits(usage.monthlyCredits)}</strong></div>
            <div className="admin-list-row"><span>Balance</span><strong>{formatCredits(usage.balance)}</strong></div>
            <div className="admin-list-row"><span>Reserved credits</span><strong>{usage.capacity.reservedCredits === null ? "Unavailable" : formatCredits(usage.capacity.reservedCredits)}</strong></div>
            <div className="admin-list-row"><span>Available for new work</span><strong>{usage.capacity.availableCredits === null ? "Unavailable" : formatCredits(usage.capacity.availableCredits)}</strong></div>
            <div className="admin-list-row"><span>Used</span><strong>{usage.percentUsed}%</strong></div>
            <div className="admin-list-row"><span>Sampled provider cost</span><strong>{formatMoney(usage.providerCostCents)}</strong></div>
            <div className="admin-list-row"><span>Sampled customer value</span><strong>{formatMoney(usage.customerValueCents)}</strong></div>
            <div className="admin-list-row"><span>Sampled gross margin</span><strong>{formatMoney(usage.grossMarginCents)}</strong></div>
            <div className="admin-list-row"><span>Bonus balance</span><strong>{formatCredits(usage.bonusCredits)}</strong></div>
            <div className="admin-list-row"><span>Top-up balance</span><strong>{formatCredits(usage.topUpCredits)}</strong></div>
            <div className="admin-list-row"><span>Subscription</span><strong>{commercial?.subscription?.status || "None"}</strong></div>
            <div className="admin-list-row"><span>Service package</span><strong>{commercial?.servicePackage?.packageName || "Not assigned"}</strong></div>
            <div className="admin-list-row"><span>Active systems</span><strong>{formatCredits(commercial?.systems.active || 0)}</strong></div>
          </div>
          <p role="status" className="admin-note">{usage.capacity.status === "unavailable" ? "Credit availability could not be verified. Refresh to retry. Your balance is shown separately." : "Reserved credits include running work and unresolved accounting. They become usage only after settlement; do not release unresolved reservations without provider evidence."}</p>
          <p className="admin-note">Commercial policy: Flux Credits are prepaid. At exhaustion, chargeable AI pauses rather than creating an unapproved postpaid overage. 1 Flux Credit = $0.01 customer-facing usage value; minimum customer top-up is $10 = 1,000 credits.</p>
          <h3>Historical sample by action</h3><p className="admin-note">Historical cost and action figures summarize the latest 5,000 ledger rows. Current-period totals below use the complete billing-period ledger.</p>
          <div className="admin-list compact">
            {Object.entries(usage.usageByAction).map(([action, credits]) => <div key={action}><strong>{action.replaceAll("_", " ")}</strong><span>{formatCredits(credits)} credits</span></div>)}
            {!Object.keys(usage.usageByAction).length ? <p>No Flux Credit usage recorded yet.</p> : null}
          </div>
        </article> : null}
      </section>
      {usage ? <section className="admin-card" aria-labelledby="admin-billing-period">
        <h2 id="admin-billing-period">Current billing period</h2>
        {usage.periodUsage ? <>
          <p>{formatTimestamp(usage.periodUsage.periodStart)} – {usage.periodUsage.periodEnd ? formatTimestamp(usage.periodUsage.periodEnd) : "Open period"}</p>
          <div className="admin-metric-grid">
            <MetricCard label="Credits charged" value={formatCredits(usage.periodUsage.usedCredits)} />
            <MetricCard label="Usage events" value={formatCredits(usage.periodUsage.usageEvents)} />
            <MetricCard label="Recorded provider cost" value={usage.periodUsage.providerCostCents === null ? "Unavailable" : formatMoney(usage.periodUsage.providerCostCents)} />
            <MetricCard label="Recorded gross margin" value={usage.periodUsage.grossMarginCents === null ? "Unavailable" : formatMoney(usage.periodUsage.grossMarginCents)} />
          </div>
          <p className="admin-note">Ledger costs include modeled provider amounts and are not verified provider invoices.</p>
        </> : <p role="status">Billing-period usage is unavailable. Refresh to retry.</p>}
      </section> : null}
      {selectedOrganization ? <CreditReservationRecovery organizationId={selectedOrganization.id} reservations={recovery?.data || []} unavailable={Boolean(recovery?.error)} /> : null}
      {selectedOrganizationId ? <CreditAdjustmentForm organizationId={selectedOrganizationId} /> : null}
      <section className="admin-card">
        <h2>Credit ledger</h2>
        <p className="admin-note">Latest 30 transactions for {selectedOrganization?.name || "the selected tenant"}. Every manual change should have a reason and admin attribution.</p>
        {transactions.length ? <div className="admin-list compact">
          {transactions.map((item) => <div key={item.id}>
            <strong>{transactionLabel(item.transaction_type || item.action_key || "credit transaction")} · {item.credit_delta > 0 ? "+" : ""}{formatCredits(item.credit_delta)} credits</strong>
            <span>{item.reason || item.source || "No reason recorded"} · {item.created_by || "System"} · {formatTimestamp(item.created_at)} · balance {formatCredits(item.balance_after)}</span>
          </div>)}
        </div> : <p>No ledger transactions recorded for this tenant.</p>}
      </section>
    </main>
  );
}
