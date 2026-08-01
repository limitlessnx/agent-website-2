import Link from "next/link";
import { Bot, Settings2, ShieldCheck } from "lucide-react";
import { getClientSession } from "@/lib/client-auth";
import { getClientPortalSummary } from "@/lib/client-portal-data";

export const dynamic = "force-dynamic";

export default async function PortalAgentsPage() {
  const session = await getClientSession();
  if (!session) return null;
  const summary = await getClientPortalSummary(session.organizationId);

  return (
    <main className="portal-page">
      <header className="portal-section-title"><h1>Agents</h1><p>Review the AI employees created for your organization and configure them before deployment.</p></header>
      <section className="portal-cards">
        {summary.agents.map((agent) => {
          const channels = Array.isArray(agent.configuration?.channels) ? agent.configuration.channels as string[] : [];
          return (
            <article key={agent.id} className="portal-card portal-agent-card">
              <div className="portal-agent-icon"><Bot size={22} /></div>
              <div><h2>{agent.name}</h2><p>{agent.description || "AI employee draft created from your onboarding requirements."}</p></div>
              <div className="portal-tags"><span>{agent.status}</span><span>Version {agent.current_version}</span>{channels.slice(0, 3).map((channel) => <span key={channel}>{channel}</span>)}</div>
              <div className="portal-list-row"><div><strong><ShieldCheck size={14} /> Controlled deployment</strong><span>Prompts, permissions, integrations and handoff rules must pass review before launch.</span></div><em>{agent.status}</em></div>
              <Link href={`/portal/agents/${agent.id}/configure`}><Settings2 size={16} /> Configure and test</Link>
            </article>
          );
        })}
        {!summary.agents.length ? <article className="portal-card"><p className="portal-empty">No agent draft is visible yet. Complete onboarding and provisioning first.</p></article> : null}
      </section>
    </main>
  );
}
