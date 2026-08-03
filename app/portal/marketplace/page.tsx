import Link from "next/link";
import { Boxes, Building2, PlusCircle, Sparkles } from "lucide-react";
import { getClientSession } from "@/lib/client-auth";
import { getMarketplaceSystems, getOrganizationSystems } from "@/lib/client-systems";
import SystemRequestButton from "./SystemRequestButton";

export const dynamic = "force-dynamic";

const categoryLabels = {
  core: { title: "Core Systems", description: "Standalone business systems for a specific operational need.", icon: Boxes },
  addon: { title: "Add-on Systems", description: "Extend an existing organization with extra capabilities.", icon: PlusCircle },
  enterprise: { title: "Enterprise Profiles", description: "Complete multi-system environments for larger operations.", icon: Building2 },
};

export default async function MarketplacePage() {
  const session = await getClientSession();
  if (!session) return null;

  const [systems, installed] = await Promise.all([
    getMarketplaceSystems().catch(() => []),
    getOrganizationSystems(session.organizationId).catch(() => []),
  ]);
  const installedIds = new Set(installed.map((item) => item.system_id));

  return (
    <main className="portal-page">
      <header className="portal-section-title">
        <p className="portal-kicker">Systems marketplace</p>
        <h1>Choose what your organization needs</h1>
        <p>Select business outcomes and capabilities. Fluxknight handles the technical setup behind the scenes.</p>
      </header>

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
            <div className="portal-card-head">
              <div><h2><Icon size={18} /> {meta.title}</h2><p>{meta.description}</p></div>
            </div>
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
