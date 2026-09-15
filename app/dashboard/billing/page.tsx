import { redirect } from "next/navigation";
import { WalletCards } from "@/components/admin/ServerIcons";
import { getAdminSession } from "@/lib/admin-auth";
import { getFluxInternalUsageSummary } from "@/lib/flux-credits";
import { createAdminClient } from "@/lib/supabase/admin";
import CreditAdjustmentForm from "./CreditAdjustmentForm";
import styles from "./BillingOperations.module.css";

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
  const remainingTone = usage && usage.percentUsed >= 85 ? styles.remainingWarn : styles.remainingGood;

  return (
    <main className={`admin-page ${styles.page}`}>
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <p className="admin-kicker">Platform control</p>
          <h1>Billing &amp; Credits</h1>
          <p>Inspect tenant allocation, consumption, provider cost and margin from one internal control plane. Commercial detail stays hidden from client-facing workspaces.</p>
        </div>
        <span className={styles.statusPill}><WalletCards size={15} /> Internal finance view</span>
      </header>

      <section className={styles.layout}>
        <article className={styles.tenantPanel}>
          <div className={styles.panelHeader}>
            <div><h2>Organizations</h2><p>Select a workspace to inspect usage and credit state.</p></div>
          </div>
          <div className={styles.tenantList}>
            {(organizations || []).map((organization) => (
              <a
                className={`${styles.tenantItem} ${organization.id === selectedOrganizationId ? styles.tenantItemActive : ""}`}
                href={`/dashboard/billing?organizationId=${encodeURIComponent(organization.id)}`}
                key={organization.id}
              >
                <span><strong>{organization.name}</strong><span>{organization.slug}</span></span>
                <em className={styles.tenantState}>{organization.status}</em>
              </a>
            ))}
            {!organizations?.length ? <p className={styles.empty}>No organizations are available.</p> : null}
          </div>
        </article>

        {usage && selectedOrganization ? (
          <article className={styles.usagePanel}>
            <div className={styles.panelHeader}>
              <div><h2>{selectedOrganization.name}</h2><p>{usage.planName} plan · current credit and margin position.</p></div>
              <span className={usage.percentUsed >= 85 ? "admin-status warning" : "admin-status live"}>{usage.percentUsed}% used</span>
            </div>

            <div className={styles.usageBody}>
              <div className={styles.creditStrip}>
                <div className={styles.creditCell}><span>Monthly credits</span><strong>{formatCredits(usage.monthlyCredits)}</strong></div>
                <div className={styles.creditCell}><span>Remaining</span><strong className={remainingTone}>{formatCredits(usage.balance)}</strong></div>
                <div className={styles.creditCell}><span>Used</span><strong>{usage.percentUsed}%</strong></div>
                <div className={styles.creditCell}><span>Top-up balance</span><strong>{formatCredits(usage.topUpCredits)}</strong></div>
              </div>

              <div className={styles.financialGrid}>
                <div className={styles.financialCell}><span>Provider cost</span><strong>{formatMoney(usage.providerCostCents)}</strong></div>
                <div className={styles.financialCell}><span>Customer value</span><strong>{formatMoney(usage.customerValueCents)}</strong></div>
                <div className={styles.financialCell}><span>Gross margin</span><strong>{formatMoney(usage.grossMarginCents)}</strong></div>
              </div>

              <div className={styles.usageSection}>
                <h3>Usage by action</h3>
                <div className={styles.usageRows}>
                  {Object.entries(usage.usageByAction).map(([action, credits]) => (
                    <div className={styles.usageRow} key={action}>
                      <strong>{action.replaceAll("_", " ")}</strong>
                      <span>{formatCredits(credits)} credits</span>
                    </div>
                  ))}
                  {!Object.keys(usage.usageByAction).length ? <p className={styles.empty}>No Flux Credit usage recorded yet.</p> : null}
                </div>
              </div>
            </div>
          </article>
        ) : (
          <article className={styles.usagePanel}><div className={styles.usageBody}><p className={styles.empty}>Select an organization to inspect billing and credit usage.</p></div></article>
        )}
      </section>

      {selectedOrganizationId ? <CreditAdjustmentForm organizationId={selectedOrganizationId} /> : null}
    </main>
  );
}
