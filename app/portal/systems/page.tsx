import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock3, PauseCircle, Settings2 } from "@/components/admin/ServerIcons";
import { getClientSession } from "@/lib/client-auth";
import { getOrganizationSystems, type SystemCatalogItem } from "@/lib/client-systems";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  setup_required: "Setup required",
  awaiting_approval: "Awaiting approval",
  provisioning: "Provisioning",
  testing: "Testing",
  active: "Active",
  paused: "Paused",
  needs_attention: "Needs attention",
};

function StatusIcon({ status }: { status: string }) {
  if (status === "active") return <CheckCircle2 size={16} />;
  if (status === "paused") return <PauseCircle size={16} />;
  if (status === "needs_attention") return <AlertTriangle size={16} />;
  return <Clock3 size={16} />;
}

export default async function MySystemsPage() {
  const session = await getClientSession();
  if (!session) return null;
  const systems = await getOrganizationSystems(session.organizationId).catch(() => []);

  return (
    <main className="portal-page">
      <header className="portal-section-title">
        <p className="portal-kicker">Organization systems</p>
        <h1>My Systems</h1>
        <p>Manage the business systems selected for your organization. Technical workflow details stay behind the scenes.</p>
      </header>

      {!systems.length ? (
        <section className="portal-card portal-empty-state">
          <Settings2 size={28} />
          <h2>No systems selected yet</h2>
          <p>Browse the marketplace and choose the capabilities your organization needs.</p>
          <Link className="portal-button" href="/portal/marketplace">Browse Marketplace</Link>
        </section>
      ) : (
        <section className="portal-system-list">
          {systems.map((installation) => {
            const system = installation.system_catalog as SystemCatalogItem | null;
            if (!system) return null;
            return (
              <details className="portal-system-installation" key={installation.id}>
                <summary>
                  <div><strong>{system.name}</strong><span>{system.summary}</span></div>
                  <em className={`status-${installation.status}`}><StatusIcon status={installation.status} />{statusLabels[installation.status] || installation.status}</em>
                </summary>
                <div className="portal-system-installation-body">
                  <div><small>Requested</small><strong>{new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(installation.requested_at))}</strong></div>
                  <div><small>Next step</small><strong>{installation.status === "setup_required" ? "Complete organization setup" : installation.status === "awaiting_approval" ? "Fluxknight review" : installation.status === "active" ? "System operational" : "Provisioning review"}</strong></div>
                  <div className="portal-tags">{system.capabilities.slice(0, 5).map((item) => <span key={item}>{item}</span>)}</div>
                  <div className="portal-actions">
                    <Link className="portal-button secondary" href={`/portal/marketplace/${system.slug}`}>View system</Link>
                    {installation.status === "setup_required" ? <Link className="portal-button" href="/portal/agents/setup">Complete setup</Link> : null}
                  </div>
                  {installation.last_error ? <p className="portal-system-error">{installation.last_error}</p> : null}
                </div>
              </details>
            );
          })}
        </section>
      )}
    </main>
  );
}
