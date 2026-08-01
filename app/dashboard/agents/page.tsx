import { requireTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const { supabase, organizationId } = await requireTenant();
  const { data: agents, error } = await supabase.from("agents").select("id,name,agent_type,status,current_version,communication_channels,updated_at").eq("organization_id", organizationId).order("updated_at", { ascending: false });

  return <main className="admin-page"><header className="admin-page-header"><div><p className="admin-kicker">AI workforce</p><h1>Agents</h1><p>Only agents owned by the authenticated organisation are loaded.</p></div></header>{error ? <section className="admin-panel"><p className="admin-error">{error.message}</p></section> : null}<section className="admin-grid">{agents?.map((agent) => <article className="admin-card" key={agent.id}><h2>{agent.name}</h2><p>{agent.agent_type || "General agent"}</p><div className="admin-list-row"><strong>Version {agent.current_version}</strong><span>{agent.status}</span></div><p>{Array.isArray(agent.communication_channels) ? agent.communication_channels.join(", ") || "No channels assigned" : "No channels assigned"}</p></article>)}{!agents?.length ? <article className="admin-card"><h2>No agents installed</h2><p>Agents created from templates will appear here.</p></article> : null}</section></main>;
}
