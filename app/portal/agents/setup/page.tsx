import Link from "next/link";
import { Bot, CheckCircle2, CircleDashed, Database, PlugZap, ShieldCheck } from "lucide-react";
import { getClientSession } from "@/lib/client-auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function listChannels(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

export default async function AgentSetupPage() {
  const session = await getClientSession();
  if (!session) return null;

  const supabase = await createClient();
  const [{ data: agents, error: agentError }, { data: integrations, error: integrationError }, { data: selections, error: selectionError }] = await Promise.all([
    supabase.from("agents").select("id,name,status,agent_type,configuration,communication_channels,system_prompt").eq("organization_id", session.organizationId).order("created_at"),
    supabase.from("organization_integrations").select("id,provider,status,display_name").eq("organization_id", session.organizationId),
    supabase.from("organization_agent_selections").select("id,agent_key,status,configuration").eq("organization_id", session.organizationId).order("created_at"),
  ]);

  if (agentError) throw agentError;
  if (integrationError) throw integrationError;
  if (selectionError) throw selectionError;

  const integrationMap = new Map((integrations || []).map((item) => [item.provider, item]));

  return (
    <main className="portal-page">
      <header className="portal-section-title">
        <h1>Agent setup workspace</h1>
        <p>Review what has been created, what still needs configuration, and why no agent goes live merely because a database row feels optimistic.</p>
      </header>

      <section className="portal-cards">
        {(agents || []).map((agent) => {
          const channels = listChannels(agent.communication_channels);
          const connectedChannels = channels.filter((channel) => integrationMap.get(channel)?.status === "connected");
          const promptReady = Boolean(agent.system_prompt && agent.system_prompt.trim().length > 30);
          const integrationsReady = channels.length > 0 && connectedChannels.length === channels.length;
          const readyChecks = [promptReady, integrationsReady, agent.status === "testing" || agent.status === "published"];
          const completed = readyChecks.filter(Boolean).length;

          return (
            <article className="portal-card portal-agent-card" key={agent.id}>
              <div className="portal-agent-icon"><Bot size={22} /></div>
              <div>
                <h2>{agent.name}</h2>
                <p>{agent.agent_type || "Standard agent"} · {completed}/3 readiness checks complete</p>
              </div>

              <div className="portal-tags">
                <span>{agent.status}</span>
                {channels.map((channel) => <span key={channel}>{channel}</span>)}
              </div>

              <div className="portal-list">
                <div className="portal-list-row">
                  <div><strong>{promptReady ? <CheckCircle2 size={15} /> : <CircleDashed size={15} />} Prompt and business rules</strong><span>{promptReady ? "Agent prompt is available for testing." : "Prompt configuration is still required."}</span></div>
                  <em>{promptReady ? "ready" : "pending"}</em>
                </div>
                <div className="portal-list-row">
                  <div><strong>{integrationsReady ? <CheckCircle2 size={15} /> : <PlugZap size={15} />} Required channels</strong><span>{channels.length ? `${connectedChannels.length} of ${channels.length} connected.` : "No channels assigned yet."}</span></div>
                  <em>{integrationsReady ? "ready" : "pending"}</em>
                </div>
                <div className="portal-list-row">
                  <div><strong>{agent.status === "testing" || agent.status === "published" ? <CheckCircle2 size={15} /> : <ShieldCheck size={15} />} Test and approval</strong><span>Conversation quality, permissions, routing and human handoff must pass review.</span></div>
                  <em>{agent.status === "published" ? "approved" : agent.status}</em>
                </div>
              </div>
            </article>
          );
        })}

        {!agents?.length ? (
          <article className="portal-card">
            <div className="portal-empty"><Database size={26} /><p>No provisioned agent exists yet. Agent drafts appear after a paid or approved sandbox package is processed.</p></div>
          </article>
        ) : null}
      </section>

      <section className="portal-card">
        <div className="portal-card-head">
          <div><h2>Purchased agent selections</h2><p>The commercial selection and the provisioned agent remain separate records for auditability.</p></div>
          <Link href="/portal/integrations">Open integration centre</Link>
        </div>
        <div className="portal-list">
          {(selections || []).map((selection) => (
            <div className="portal-list-row" key={selection.id}>
              <div><strong>{selection.agent_key.replaceAll("_", " ")}</strong><span>Provisioning lifecycle status</span></div>
              <em>{selection.status}</em>
            </div>
          ))}
          {!selections?.length ? <p className="portal-empty">No standard agent selection is currently attached to this workspace.</p> : null}
        </div>
      </section>
    </main>
  );
}
