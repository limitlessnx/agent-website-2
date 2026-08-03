import { AlertTriangle, CheckCircle2, Clock3, CreditCard, Library, PauseCircle, Workflow } from "lucide-react";
import { getClientSession } from "@/lib/client-auth";
import { getClientAutomations } from "@/lib/automation-provisioning";

export const dynamic = "force-dynamic";

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(value || 0));
}

function statusCopy(status: string) {
  if (status === "active") return { label: "Active", icon: CheckCircle2 };
  if (status === "provisioning" || status === "queued") return { label: "Setting up", icon: Clock3 };
  if (status === "paused") return { label: "Paused", icon: PauseCircle };
  if (status === "failed" || status === "needs_attention") return { label: "Needs attention", icon: AlertTriangle };
  return { label: "Payment required", icon: CreditCard };
}

export default async function PortalAutomationsPage() {
  const session = await getClientSession();
  if (!session) return null;
  const { installed, library } = await getClientAutomations(session.organizationId);

  return (
    <main className="portal-page">
      <header className="portal-section-title">
        <h1>Automations</h1>
        <p>Activate ready-made business workflows after payment and track their setup without backend workflow details.</p>
      </header>

      <section className="portal-metrics">
        <article className="portal-metric"><span><Workflow size={16} /> My automations</span><strong>{installed.length}</strong><small>{installed.filter((item) => item.status === "active").length} active</small></article>
        <article className="portal-metric"><span><Clock3 size={16} /> Setting up</span><strong>{installed.filter((item) => ["queued", "provisioning"].includes(item.status)).length}</strong><small>Provisioning after payment</small></article>
        <article className="portal-metric"><span><AlertTriangle size={16} /> Needs attention</span><strong>{installed.filter((item) => ["failed", "needs_attention"].includes(item.status)).length}</strong><small>Fluxknight will review</small></article>
        <article className="portal-metric"><span><Library size={16} /> Library</span><strong>{library.length}</strong><small>Available to unlock</small></article>
      </section>

      <section className="portal-card">
        <div className="portal-card-head">
          <div>
            <h2>My Automations</h2>
            <p>Business-level status for automations already selected or purchased.</p>
          </div>
        </div>
        <div className="portal-list">
          {installed.map((automation) => {
            const copy = statusCopy(automation.status);
            const Icon = copy.icon;
            const template = automation.template;
            return (
              <div className="portal-list-row" key={automation.id}>
                <div>
                  <strong>{automation.display_name}</strong>
                  <span>{template?.category || "operations"} &middot; v{automation.provisioned_version} &middot; {(template?.channels || []).join(", ") || "managed channels"}</span>
                  {automation.last_error && ["failed", "needs_attention"].includes(automation.status) ? <span>Fluxknight has been notified and will review setup.</span> : null}
                </div>
                <em><Icon size={13} /> {copy.label}</em>
              </div>
            );
          })}
          {!installed.length ? <p className="portal-empty">No automations have been purchased yet.</p> : null}
        </div>
      </section>

      <section className="portal-card">
        <div className="portal-card-head">
          <div>
            <h2>Automation Library</h2>
            <p>Prebuilt automations available for your organization.</p>
          </div>
        </div>
        <div className="portal-list">
          {library.map((template) => (
            <div className="portal-list-row" key={template.id}>
              <div>
                <strong>{template.name}</strong>
                <span>{template.description || template.category}</span>
                <span>{template.channels.join(", ") || "managed channels"} &middot; {template.required_plan || "eligible plan"} &middot; {money(template.setup_price, template.currency)} setup</span>
              </div>
              <em><CreditCard size={13} /> Unlock after payment</em>
            </div>
          ))}
          {!library.length ? <p className="portal-empty">No additional automations are available right now.</p> : null}
        </div>
      </section>
    </main>
  );
}
