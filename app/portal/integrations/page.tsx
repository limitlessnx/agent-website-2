import Link from "next/link";
import { Cable, CheckCircle2, CircleDashed, LockKeyhole, TriangleAlert } from "@/components/admin/ServerIcons";
import { getClientSession } from "@/lib/client-auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const labels: Record<string, string> = {
  whatsapp: "WhatsApp Business",
  email: "Business Email",
  web: "Website Chat",
  telegram: "Telegram",
  voice: "Voice Calling",
  sms: "SMS",
};

function statusIcon(status: string) {
  if (status === "connected") return <CheckCircle2 size={18} />;
  if (status === "error" || status === "degraded") return <TriangleAlert size={18} />;
  return <CircleDashed size={18} />;
}

export default async function PortalIntegrationsPage() {
  const session = await getClientSession();
  if (!session) return null;

  const supabase = await createClient();
  const [{ data: integrations, error: integrationError }, { data: agents, error: agentError }] = await Promise.all([
    supabase.from("organization_integrations").select("id,provider,display_name,status,health,last_connected_at,configuration").eq("organization_id", session.organizationId).order("created_at"),
    supabase.from("agents").select("id,name,status,agent_type,communication_channels").eq("organization_id", session.organizationId).order("created_at"),
  ]);

  if (integrationError) throw integrationError;
  if (agentError) throw agentError;

  const rows = integrations || [];
  const connected = rows.filter((item) => item.status === "connected").length;
  const attention = rows.filter((item) => item.status === "error" || item.status === "degraded").length;

  return (
    <main className="portal-page">
      <header className="portal-section-title">
        <h1>Integration centre</h1>
        <p>Every channel connection belongs to this organisation only. API keys, refresh tokens and webhook secrets remain server-side.</p>
      </header>

      <section className="portal-metrics">
        <article className="portal-card"><small>Required connections</small><strong>{rows.length}</strong><span>Created from provisioned agents</span></article>
        <article className="portal-card"><small>Connected</small><strong>{connected}</strong><span>Provider verification completed</span></article>
        <article className="portal-card"><small>Needs attention</small><strong>{attention}</strong><span>Error or degraded state</span></article>
        <article className="portal-card"><small>Provisioned agents</small><strong>{agents?.length || 0}</strong><span>Draft and testing agents included</span></article>
      </section>

      <section className="portal-card">
        <div className="portal-card-head">
          <div><h2>Organisation connections</h2><p>Clients can see readiness, but never the underlying credentials.</p></div>
          <Link href="/portal/agents/setup">Review agent setup</Link>
        </div>
        <div className="portal-list">
          {rows.length ? rows.map((integration) => (
            <div className="portal-list-row" key={integration.id}>
              <div>
                <strong>{statusIcon(integration.status)} {integration.display_name || labels[integration.provider] || integration.provider}</strong>
                <span>{labels[integration.provider] || integration.provider} · {integration.status.replaceAll("_", " ")}</span>
              </div>
              <em>{integration.last_connected_at ? `Connected ${new Date(integration.last_connected_at).toLocaleDateString("en-NG")}` : "Connection pending"}</em>
            </div>
          )) : (
            <div className="portal-empty"><Cable size={26} /><p>No integration requirements yet. Placeholders appear after a paid agent package is provisioned.</p></div>
          )}
        </div>
      </section>

      <section className="portal-card">
        <div className="portal-card-head"><div><h2>Security boundary</h2><p>What this workspace exposes and what remains locked away.</p></div></div>
        <div className="portal-list">
          <div className="portal-list-row"><div><strong><CheckCircle2 size={15} /> Visible</strong><span>Provider, connection state, health, required agent and setup progress.</span></div><em>client safe</em></div>
          <div className="portal-list-row"><div><strong><LockKeyhole size={15} /> Hidden</strong><span>Access tokens, API keys, webhook secrets, refresh tokens and service-role credentials.</span></div><em>server only</em></div>
          <div className="portal-list-row"><div><strong><CircleDashed size={15} /> Activation</strong><span>A channel activates only after credential validation, routing verification and an approved test.</span></div><em>approval gated</em></div>
        </div>
      </section>
    </main>
  );
}
