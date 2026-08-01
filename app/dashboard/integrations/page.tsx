import { Cable, ShieldCheck } from "lucide-react";
import { requireTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const { supabase, organizationId } = await requireTenant();
  const [{ data: integrations, error }, { data: bindings }] = await Promise.all([
    supabase.from("organization_integrations").select("id,provider,display_name,status,health,last_checked_at,last_connected_at").eq("organization_id", organizationId).order("display_name"),
    supabase.from("channel_bindings").select("id,integration_id,channel,external_identifier,status,agent_id").eq("organization_id", organizationId),
  ]);

  return <main className="admin-page"><header className="admin-page-header"><div><p className="admin-kicker">Connections</p><h1>Integrations</h1><p>Provider credentials remain server-side. This page exposes health and routing metadata only.</p></div></header>{error ? <section className="admin-panel"><p className="admin-error">{error.message}</p></section> : null}<section className="admin-grid">{integrations?.map((integration) => { const routes = bindings?.filter((binding) => binding.integration_id === integration.id) ?? []; return <article className="admin-card" key={integration.id}><Cable size={18}/><h2>{integration.display_name}</h2><p>{integration.provider}</p><div className="admin-list-row"><strong>{routes.length} channel binding{routes.length === 1 ? "" : "s"}</strong><span>{integration.status}</span></div>{routes.map((route) => <div className="admin-list-row" key={route.id}><strong>{route.channel}</strong><span>{route.external_identifier} · {route.status}</span></div>)}</article>; })}{!integrations?.length ? <article className="admin-card"><ShieldCheck size={18}/><h2>No integrations connected</h2><p>WhatsApp, email, voice and other providers will appear here after secure onboarding.</p></article> : null}</section></main>;
}
