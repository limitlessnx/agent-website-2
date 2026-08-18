import Link from "next/link";
import { Boxes, Building2, PlusCircle, Sparkles } from "@/components/admin/ServerIcons";
import { getClientSession } from "@/lib/client-auth";
import { getMarketplaceSystems, getOrganizationSystems } from "@/lib/client-systems";
import { getPublicCatalog } from "@/lib/payments/catalog";
import { getRequestBillingRegion } from "@/lib/payments/region";
import SystemRequestButton from "./SystemRequestButton";

export const dynamic = "force-dynamic";

const categoryLabels = {
  core: { title: "Core Systems", description: "Standalone business systems for a specific operational need.", icon: Boxes },
  addon: { title: "Add-on Systems", description: "Extend an existing organization with extra capabilities.", icon: PlusCircle },
  enterprise: { title: "Enterprise Profiles", description: "Complete multi-system environments for larger operations.", icon: Building2 },
};

function money(value: number, currency: "NGN" | "USD") {
  return new Intl.NumberFormat(currency === "NGN" ? "en-NG" : "en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

export default async function MarketplacePage() {
  const session = await getClientSession();
  if (!session) return null;

  const [{ region }, systems, installed] = await Promise.all([
    getRequestBillingRegion(),
    getMarketplaceSystems().catch(() => []),
    getOrganizationSystems(session.organizationId).catch(() => []),
  ]);
  const plans = await getPublicCatalog(region);
  const installedIds = new Set(installed.map((item) => item.system_id));

  return (
    <main className="portal-page">
      <header className="portal-section-title">
        <p className="portal-kicker">AI Agents Systems</p>
        <h1>Choose the AI system your organization needs</h1>
        <p>Select business outcomes and capabilities. Fluxknight handles the technical setup behind the scenes.</p>
      </header>

      <section className="portal-marketplace-featured">
        <div><Sparkles size={20} /><span>AI Agents Systems pricing</span></div>
        <p>Pricing is locked to your detected billing region. There is no manual currency switch.</p>
        <div className="portal-system-grid" style={{ marginTop: 18 }}>
          {plans.filter((plan) => !plan.custom).map((plan) => (
            <article className="portal-system-card" key={plan.slug}>
              <div className="portal-system-card-head"><div><small>AI agent system</small><h3>{plan.name}</h3></div><span>{plan.currency}</span></div>
              <p>{plan.description}</p>
              <div style={{ display: "grid", gap: 4, margin: "14px 0" }}>
                <strong>{money(plan.installationFee, plan.currency)} setup</strong>
                <span>{money(plan.recurringFee, plan.currency)} / month from month 2</span>
              </div>
              <Link className="portal-button" href={`/pricing?plan=${encodeURIComponent(plan.slug)}`}>View plan</Link>
            </article>
          ))}
        </div>
      </section>

      <section className="portal-marketplace-featured">
        <div><Sparkles size={20} /><span>Featured enterprise environments</span></div>
        <p>Enterprise System and Enterprise System 2 combine several agents and channels into one isolated organization.</p>
      </section>

      {(["core", "addon", "enterprise"] as const).map((category) => {
        const group = systems.filter((system) => system.category === category);
        const meta = categoryLabels[category];
        const Icon = meta.icon;
        if (!group.length) return null;
        return (
          <section className="portal-marketplace-section" key={category}>
            <div className="portal-card-head"><div><h2><Icon size={18} /> {meta.title}</h2><p>{meta.description}</p></div></div>
            <div className="portal-system-grid">
              {group.map((system) => {
                const alreadyInstalled = installedIds.has(system.id);
                return (
                  <article className={`portal-system-card ${system.featured ? "featured" : ""}`} key={system.id}>
                    <div className="portal-system-card-head">
                      <div><small>{category === "enterprise" ? "Enterprise profile" : category === "addon" ? "Add-on" : "Core system"}</small><h3>{system.name}</h3></div>
                      <span>{alreadyInstalled ? "Added" : system.status === "coming_soon" ? "Coming soon" : "Available"}</span>
                    </div>
                    <p>{system.summary}</p>
                    <div className="portal-tags">{system.capabilities.slice(0, 4).map((item) => <span key={item}>{item}</span>)}</div>
                    <div className="portal-system-card-actions">
                      <Link className="portal-button secondary" href={`/portal/marketplace/${system.slug}`}>View details</Link>
                      {alreadyInstalled ? <Link className="portal-button" href="/portal/systems">Open My Systems</Link> : <SystemRequestButton slug={system.slug} disabled={system.status !== "available"} />}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </main>
  );
}
