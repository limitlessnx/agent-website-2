import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminSession } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
const limit = 500;
function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function metric(rows: unknown[], key: string, nested = false) {
  const values = rows.map(row => {
    const metadata = obj(row);
    return (nested ? obj(metadata.timing) : metadata)[key];
  }).filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0).sort((a,b)=>a-b);
  return { count: values.length, average: values.length ? values.reduce((a,b)=>a+b,0)/values.length : null, p95: values.length ? values[Math.ceil(values.length*.95)-1] : null };
}
const seconds = (v: number | null) => v === null ? "—" : (v/1000).toFixed(2)+"s";

export default async function MaiaHealthPage() {
  if (!(await getAdminSession())) redirect("/dashboard");
  const admin = createAdminClient();
  const since = new Date(Date.now()-24*60*60*1000).toISOString();
  const agents = await admin.from("agents").select("id,organization_id,name,slug").or("slug.eq.maia,slug.like.maia-%").limit(limit);
  if (agents.error) return <main className="admin-page"><h1>Maia Performance & Health</h1><p role="alert">Agent evidence unavailable.</p></main>;
  const ids = (agents.data || []).map(a=>a.id);
  const orgIds = [...new Set((agents.data || []).map(a=>a.organization_id))];
  const [messages, events, organizations] = ids.length ? await Promise.all([
    admin.from("agent_runtime_messages").select("organization_id,agent_id,metadata,created_at").in("agent_id",ids).eq("role","assistant").gte("created_at",since).order("created_at",{ascending:false}).limit(limit),
    admin.from("maia_inbound_events").select("organization_id,agent_id,status,attempts,updated_at").in("agent_id",ids).gte("updated_at",since).order("updated_at",{ascending:false}).limit(limit),
    admin.from("organizations").select("id,name").in("id",orgIds),
  ]) : [{data:[],error:null},{data:[],error:null},{data:[],error:null}];
  const replies = messages.error ? [] : messages.data || [];
  const inbound = events.error ? [] : events.data || [];
  const total = metric(replies.map(r=>r.metadata),"latencyMs");
  const model = metric(replies.map(r=>r.metadata),"modelMs",true);
  const prep = metric(replies.map(r=>r.metadata),"preparationMs",true);
  const truncated = [agents.data?.length,replies.length,inbound.length].some(n=>n===limit);
  return <main className="admin-page">
    <header className="admin-page-header"><div><p className="admin-kicker">Operations · Maia</p><h1>Maia Performance &amp; Health</h1><p>Last 24 hours · read-only production evidence · up to {limit} latest records per source. Runtime latency excludes WhatsApp delivery time.</p></div><Link href="/dashboard/health" className="admin-button secondary">Customer health</Link></header>
    {messages.error || events.error || organizations.error ? <p role="alert">Some evidence is unavailable. Missing data is not a healthy status.</p> : null}
    {truncated ? <p role="alert">Sample limit reached; counts are not complete platform totals.</p> : null}
    <div className="admin-metric-grid">
      <article className="admin-metric-card"><p>Average runtime</p><strong>{seconds(total.average)}</strong><span>{total.count} measured replies</span></article>
      <article className="admin-metric-card"><p>95th percentile</p><strong>{seconds(total.p95)}</strong><span>Observed sample only</span></article>
      <article className="admin-metric-card"><p>AI processing</p><strong>{seconds(model.average)}</strong><span>{model.count} measured replies</span></article>
      <article className="admin-metric-card"><p>Context preparation</p><strong>{seconds(prep.average)}</strong><span>{prep.count} measured replies</span></article>
    </div>
    <section className="admin-panel"><div className="admin-panel-header"><div><h2>Tenant runtime evidence</h2><p>Failed inbound events and retry attempts are not verified outages or duplicate deliveries.</p></div></div>
      <div className="admin-list">{orgIds.map(id=>{
        const rows = replies.filter(r=>r.organization_id===id && (agents.data||[]).some(a=>a.id===r.agent_id && a.organization_id===id));
        const ev = inbound.filter(r=>r.organization_id===id && (agents.data||[]).some(a=>a.id===r.agent_id && a.organization_id===id));
        const m = metric(rows.map(r=>r.metadata),"latencyMs");
        return <div className="admin-list-row" key={id}><div><strong>{organizations.data?.find(o=>o.id===id)?.name || "Organization"}</strong><span>{m.count} measured replies · average {seconds(m.average)} · p95 {seconds(m.p95)}</span><span>{events.error ? "Inbound evidence unavailable" : ev.length ? ev.filter(e=>e.status==="failed").length+" failed · "+ev.filter(e=>Number(e.attempts)>1).length+" retried · "+ev.length+" sampled events" : "No recent inbound evidence"}</span></div></div>;
      })}{!orgIds.length ? <p className="admin-empty">No Maia agents discovered.</p> : null}</div>
    </section>
    <section className="admin-panel"><div className="admin-panel-header"><div><h2>Vendor status and delivery verification</h2><p>Official vendor incidents, duplicate media, reminder and follow-up delivery are not verified by this runtime sample.</p></div></div><div className="admin-list"><div className="admin-list-row"><a href="https://metastatus.com/whatsapp-business-api">Meta WhatsApp status</a><a href="https://status.trigger.dev/">Trigger.dev status</a></div></div></section>
  </main>;
}
