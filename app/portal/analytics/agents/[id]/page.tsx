import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getClientSession } from "@/lib/client-auth";
import { requirePortalPermission } from "@/lib/portal-access";
import { getTenantAnalyticsDrilldown } from "@/lib/tenant-analytics-drilldown";

export const dynamic="force-dynamic";

function number(value:number|null|undefined){
  return new Intl.NumberFormat("en-NG").format(value||0);
}
function rate(value:number|null){
  return value==null?"—":value.toFixed(1)+"%";
}

export default async function AgentAnalyticsPage({
  params,searchParams,
}:{
  params:Promise<{id:string}>;
  searchParams:Promise<{period?:string}>;
}){
  const session=await getClientSession();
  if(!session) redirect("/account/login");
  try{await requirePortalPermission(session,["analytics.view"]);}catch{redirect("/portal");}
  const [{id},query]=await Promise.all([params,searchParams]);
  const requested=Number(query.period||30);
  const periodDays=[7,30,90].includes(requested)?requested:30;
  const analytics=await getTenantAnalyticsDrilldown(session.organizationId,periodDays);
  const agent=analytics.agents.find((item)=>item.agentId===id);
  if(!agent) notFound();

  return <main className="portal-page">
    <section className="portal-command-hero">
      <div><p className="portal-kicker">Agent analytics</p><h1>{agent.name}</h1><p>{agent.model||"Model not recorded"} · {agent.status} · last {periodDays} days</p></div>
      <Link href={"/portal/analytics?period="+periodDays}>Back to analytics</Link>
    </section>

    <section className="portal-business-metrics">
      <article className="portal-business-metric"><span>Conversations</span><strong>{number(agent.conversations)}</strong><small>{rate(agent.aiHandledRate)} AI-handled</small></article>
      <article className="portal-business-metric"><span>Messages</span><strong>{number(agent.messages)}</strong><small>canonical messages attributed to agent</small></article>
      <article className="portal-business-metric"><span>Executions</span><strong>{number(agent.runtimeExecutions)}</strong><small>{number(agent.runtimeFailed)} failed</small></article>
      <article className="portal-business-metric"><span>Runtime success</span><strong>{rate(agent.runtimeSuccessRate)}</strong><small>{agent.avgLatencyMs==null?"Latency unavailable":number(agent.avgLatencyMs)+" ms avg latency"}</small></article>
      <article className="portal-business-metric"><span>Human handoffs</span><strong>{number(agent.handoffs)}</strong><small>agent-linked handoffs</small></article>
    </section>

    <section className="portal-card">
      <div className="portal-card-head"><div><h2>Attribution rules</h2><p>Only canonical records directly linked to this agent are counted.</p></div></div>
      <p className="portal-empty">
        Conversations and messages use agent_id, runtime health uses runtime_executions.agent_id, and handoffs use human_handoffs.source_agent_id.
        This avoids guessing attribution from agent names or prompts.
      </p>
    </section>
  </main>;
}
