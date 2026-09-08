import { redirect } from "next/navigation";
import { WalletCards } from "@/components/admin/ServerIcons";
import { getAdminSession } from "@/lib/admin-auth";
import { getFluxInternalUsageSummary } from "@/lib/flux-credits";
import { createAdminClient } from "@/lib/supabase/admin";
import CreditAdjustmentForm from "./CreditAdjustmentForm";

export const dynamic = "force-dynamic";

function formatCredits(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export default async function AdminBillingPage({ searchParams }: { searchParams?: Promise<{ organizationId?: string }> }) {
  const session = await getAdminSession();
  if (!session) redirect("/login");

  const params = await searchParams;
  const admin = createAdminClient();
  const { data: organizations, error } = await admin
    .from("organizations")
    .select("id,name,slug,status")
    .order("name", { ascending: true })
    .limit(200);
  if (error) throw error;

  const selectedOrganizationId = params?.organizationId || organizations?.find((organization) => organization.status === "active")?.id || organizations?.[0]?.id;
  const selectedOrganization = organizations?.find((organization) => organization.id === selectedOrganizationId) || null;
  const usage = selectedOrganizationId ? await getFluxInternalUsageSummary(selectedOrganizationId) : null;

  return (
    <main className="admin-page">
      <section className="admin-hero">
        <div>
          <p className="admin-kicker">Super Admin</p>
          <h1>Flux Credits &amp; margins</h1>
          <p>Inspect tenant credit usage, provider cost, customer value, and margin without exposing this detail to clients.</p>
        </div>
        <div className="admin-hero-icon"><WalletCards size={24} /></div>
      </section>

      <section className="admin-grid two">
        <article className="admin-card">
          <h2>Tenants</h2>
          <div className="admin-list">
            {(organizations || []).map((organization) => (
              <a className={organization.id === selectedOrganizationId ? "active" : ""} href={`/dashboard/billing?organizationId=${encodeURIComponent(organization.id)}`} key={organization.id}>
                <strong>{organization.name}</strong><span>{organization.slug} · {organization.status}</span>
              </a>
            ))}
          </div>
        </article>

        {usage && selectedOrganization ? (
          <article className="admin-card">
            <h2>{selectedOrganization.name}</h2>
            <div className="admin-metrics">
              <div><span>Plan</span><strong>{usage.planName}</strong></div>
              <div><span>Monthly credits</span><strong>{formatCredits(usage.monthlyCredits)}</strong></div>
              <div><span>Remaining</span><strong>{formatCredits(usage.balance)}</strong></div>
              <div><span>Used</span><strong>{usage.percentUsed}%</strong></div>
              <div><span>Provider cost</span><strong>{formatMoney(usage.providerCostCents)}</strong></div>
              <div><span>Customer value</span><strong>{formatMoney(usage.customerValueCents)}</strong></div>
              <div><span>Gross margin</span><strong>{formatMoney(usage.grossMarginCents)}</strong></div>
              <div><span>Top-up balance</span><strong>{formatCredits(usage.topUpCredits)}</strong></div>
            </div>
            <h3>Usage by action</h3>
            <div className="admin-list compact">
              {Object.entries(usage.usageByAction).map(([action, credits]) => <div key={action}><strong>{action.replaceAll("_", " ")}</strong><span>{formatCredits(credits)} credits</span></div>)}
              {!Object.keys(usage.usageByAction).length ? <p>No Flux Credit usage recorded yet.</p> : null}
            </div>
          </article>
        ) : null}
      </section>

      {selectedOrganizationId ? <CreditAdjustmentForm organizationId={selectedOrganizationId} /> : null}
    </main>
  );
}
