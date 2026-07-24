import { Cable, Database, Mail, MessageSquare, Mic, Workflow } from "lucide-react";
import { getClientSession } from "@/lib/client-auth";
import { getClientPortalSummary } from "@/lib/client-portal-data";

export const dynamic = "force-dynamic";

const integrations = [
  { key: "supabase", label: "Supabase", icon: Database },
  { key: "n8n", label: "n8n", icon: Workflow },
  { key: "whatsapp", label: "WhatsApp", icon: MessageSquare },
  { key: "email", label: "Email", icon: Mail },
  { key: "elevenlabs", label: "ElevenLabs", icon: Mic },
  { key: "vapi", label: "Vapi", icon: Mic },
];

export default async function PortalIntegrationsPage() {
  const session = await getClientSession();
  if (!session) return null;
  const summary = await getClientPortalSummary(session.organizationId);
  const selected = new Set((summary.onboarding?.existing_tools || []).map((tool) => tool.toLowerCase()));
  const channels = new Set((summary.onboarding?.channels || []).map((channel) => channel.toLowerCase()));

  return (
    <main className="portal-page">
      <header className="portal-section-title"><h1>Integrations</h1><p>Your selected tools and channels. Credentials are connected securely during configuration, never dumped into a cheerful little text box.</p></header>
      <section className="portal-integration-grid">
        {integrations.map((item) => {
          const Icon = item.icon;
          const requested = selected.has(item.key) || channels.has(item.key);
          return (
            <article className="portal-card portal-integration" key={item.key}>
              <span><Icon size={20} /></span>
              <div><strong>{item.label}</strong><small>{requested ? "Requested for setup" : "Not selected"}</small></div>
            </article>
          );
        })}
        <article className="portal-card portal-integration"><span><Cable size={20} /></span><div><strong>Custom integration</strong><small>{summary.onboarding?.notes ? "Requirements recorded" : "Available during configuration"}</small></div></article>
      </section>
      <section className="portal-card">
        <div className="portal-card-head"><div><h2>Connection process</h2><p>How integrations move from requested to live.</p></div></div>
        <div className="portal-list">
          <div className="portal-list-row"><div><strong>1. Requirements review</strong><span>Fluxknight confirms the account, channel, and permission scope.</span></div><em>review</em></div>
          <div className="portal-list-row"><div><strong>2. Secure connection</strong><span>OAuth, encrypted environment variables, or approved provider credentials are used.</span></div><em>secure</em></div>
          <div className="portal-list-row"><div><strong>3. Test and approve</strong><span>Messages, calls, workflow events, and human handoff are tested before launch.</span></div><em>test</em></div>
        </div>
      </section>
    </main>
  );
}
