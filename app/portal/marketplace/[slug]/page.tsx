import Link from "next/link";
import { ArrowLeft, Bot, CheckCircle2, ClipboardList } from "lucide-react";
import { notFound } from "next/navigation";
import { getClientSession } from "@/lib/client-auth";
import { getMarketplaceSystem, getOrganizationSystems } from "@/lib/client-systems";
import SystemRequestButton from "../SystemRequestButton";

export const dynamic = "force-dynamic";

export default async function MarketplaceSystemPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await getClientSession();
  if (!session) return null;
  const { slug } = await params;
  const [system, installed] = await Promise.all([
    getMarketplaceSystem(slug).catch(() => null),
    getOrganizationSystems(session.organizationId).catch(() => []),
  ]);
  if (!system) notFound();
  const alreadyInstalled = installed.some((item) => item.system_id === system.id);

  return (
    <main className="portal-page">
      <Link className="portal-back-link" href="/portal/marketplace"><ArrowLeft size={16} /> Back to marketplace</Link>
      <section className="portal-hero portal-system-detail-hero">
        <div>
          <p className="portal-kicker">{system.category === "enterprise" ? "Enterprise profile" : system.category === "addon" ? "Add-on system" : "Core system"}</p>
          <h1>{system.name}</h1>
          <p>{system.description || system.summary}</p>
        </div>
        <div className="portal-system-detail-action">
          {alreadyInstalled ? <Link className="portal-button" href="/portal/systems">Open My Systems</Link> : <SystemRequestButton slug={system.slug} disabled={system.status !== "available"} />}
        </div>
      </section>

      <section className="portal-system-detail-grid">
        <article className="portal-card">
          <div className="portal-card-head"><div><h2><CheckCircle2 size={18} /> Included capabilities</h2><p>What this system helps your organization accomplish.</p></div></div>
          <div className="portal-check-list">{system.capabilities.map((item) => <span key={item}><CheckCircle2 size={15} />{item}</span>)}</div>
        </article>
        <article className="portal-card">
          <div className="portal-card-head"><div><h2><Bot size={18} /> Included agents</h2><p>The business-facing AI roles created for this system.</p></div></div>
          <div className="portal-check-list">{system.included_agents.length ? system.included_agents.map((item) => <span key={item}><Bot size={15} />{item}</span>) : <p className="portal-empty">This add-on extends agents already installed in your organization.</p>}</div>
        </article>
        <article className="portal-card portal-system-requirements">
          <div className="portal-card-head"><div><h2><ClipboardList size={18} /> What we will need</h2><p>After selection, you provide business information only. Fluxknight handles backend provisioning.</p></div></div>
          <div className="portal-check-list">{system.setup_requirements.map((item) => <span key={item}><ClipboardList size={15} />{item}</span>)}</div>
        </article>
      </section>
    </main>
  );
}
