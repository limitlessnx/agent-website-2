import Link from "next/link";
import { Activity, ArrowUpRight, Bot, CircleAlert, Gauge, Network, Play, ShieldCheck, Target } from "@/components/admin/ServerIcons";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const ORG = "b15f21b4-5697-4d21-9421-8a34eae3476d";

async function getOperations() {
  const admin = createAdminClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [events, goals, tools, sessions, readiness] = await Promise.all([
    admin.from("agent_runtime_events").select("id,agent_id,event_type,status,payload,created_at").eq("organization_id", ORG).gte("created_at", since).order("created_at", { ascending: false }).limit(100),
    admin.from("agent_runtime_goals").select("id,agent_id,title,goal_type,priority,status,input,output,next_run_at,created_at,updated_at").eq("organization_id", ORG).order("updated_at", { ascending: false }).limit(100),
    admin.from("agent_runtime_tool_runs").select("id,agent_id,session_id,tool_name,status,approval_required,started_at,finished_at").eq("organization_id", ORG).gte("started_at", since).order("started_at", { ascending: false }).limit(100),
    admin.from("agent_runtime_sessions").select("id,agent_id,channel,status,step_count,updated_at").eq("organization_id", ORG).order("updated_at", { ascending: false }).limit(50),
    admin.from("agent_runtime_readiness").select("agent_id,business_profile_ready,prompt_ready,knowledge_ready,integrations_ready,test_ready,approval_ready,workflow_ready,readiness_score,blockers,refreshed_at").eq("organization_id", ORG),
  ]);
  return { events: events.data || [], goals: goals.data || [], tools: tools.data || [], sessions: sessions.data || [], readiness: readiness.data || [] };
}

export default async function AgentOperationsPage() {
  const data = await getOperations();
  const runs = data.tools.length;
  const failures = data.tools.filter((x) => ["error", "failed", "timeout"].includes(String(x.status).toLowerCase())).length;
  const activeGoals = data.goals.filter((x) => ["queued", "running", "active"].includes(String(x.status).toLowerCase())).length;
  const completedGoals = data.goals.filter((x) => ["completed", "done", "success"].includes(String(x.status).toLowerCase())).length;
  const successRate = runs ? Math.round(((runs - failures) / runs) * 100) : 100;
  const averageSteps = data.sessions.length ? Math.round(data.sessions.reduce((sum, x) => sum + Number(x.step_count || 0), 0) / data.sessions.length) : 0;

  return <main className="admin-page">
    <div className="admin-page-header">
      <div><p className="admin-kicker">Fluxknight Intelligence</p><h1>Agent Operations</h1><p>Observe agent runs, failures, decisions, tools and autonomous goals without exposing tenant data across organizations.</p></div>
      <Link className="admin-button" href="/dashboard/clients"><ShieldCheck size={15}/> Tenant controls</Link>
    </div>

    <div className="admin-metric-grid">
      <article className="admin-metric-card"><p>Runtime runs · 24h</p><strong>{runs}</strong><span>Tool executions recorded</span></article>
      <article className="admin-metric-card"><p>Success rate</p><strong>{successRate}%</strong><span>{failures} failed or timed out</span></article>
      <article className="admin-metric-card"><p>Autonomous goals</p><strong>{activeGoals}</strong><span>Queued or currently running</span></article>
      <article className="admin-metric-card"><p>Completed goals</p><strong>{completedGoals}</strong><span>Successful autonomous outcomes</span></article>
      <article className="admin-metric-card"><p>Active sessions</p><strong>{data.sessions.length}</strong><span>Recent agent conversations</span></article>
      <article className="admin-metric-card"><p>Avg. steps/session</p><strong>{averageSteps}</strong><span>Reasoning depth signal</span></article>
    </div>

    <div className="admin-grid-2">
      <section className="admin-panel"><header className="admin-panel-header"><div><h2>Autonomous operation</h2><p>Goals Maia can execute without a human manually starting each action.</p></div><Target size={18}/></header>
        <div className="admin-list">{data.goals.slice(0, 10).map((goal) => <article className="admin-list-row" key={goal.id}><span className="admin-list-icon"><Play size={13}/></span><div><strong>{goal.title}</strong><small>{goal.goal_type} · priority {goal.priority} · {goal.status}</small></div><em>{goal.next_run_at ? new Date(goal.next_run_at).toLocaleString() : "No next run"}</em></article>)}{!data.goals.length && <p className="admin-empty">No autonomous goals have been recorded yet.</p>}</div>
      </section>

      <section className="admin-panel"><header className="admin-panel-header"><div><h2>Failures & alerts</h2><p>Runtime errors and failed tool executions from the last 24 hours.</p></div><CircleAlert size={18}/></header>
        <div className="admin-list">{data.tools.filter((x) => ["error", "failed", "timeout"].includes(String(x.status).toLowerCase())).slice(0, 10).map((run) => <article className="admin-list-row" key={run.id}><span className="admin-list-icon"><CircleAlert size={13}/></span><div><strong>{run.tool_name}</strong><small>{run.status} · session {String(run.session_id).slice(0, 8)}</small></div><em>{run.started_at ? new Date(run.started_at).toLocaleString() : ""}</em></article>)}{!failures && <p className="admin-empty">No runtime failures recorded in the last 24 hours.</p>}</div>
      </section>
    </div>

    <div className="admin-grid-2">
      <section className="admin-panel"><header className="admin-panel-header"><div><h2>Runtime activity</h2><p>Recent events generated by agentic execution.</p></div><Activity size={18}/></header><div className="admin-list">{data.events.slice(0, 12).map((event) => <article className="admin-list-row" key={event.id}><span className="admin-list-icon"><Network size={13}/></span><div><strong>{event.event_type}</strong><small>{event.status || "recorded"} · agent {String(event.agent_id).slice(0, 8)}</small></div><em>{new Date(event.created_at).toLocaleString()}</em></article>)}{!data.events.length && <p className="admin-empty">No runtime events recorded in the last 24 hours.</p>}</div></section>
      <section className="admin-panel"><header className="admin-panel-header"><div><h2>Agent readiness</h2><p>Operational blockers before autonomous agents are allowed to run.</p></div><Gauge size={18}/></header><div className="admin-list">{data.readiness.map((item) => <article className="admin-list-row" key={item.agent_id}><span className="admin-list-icon"><Bot size={13}/></span><div><strong>Agent {String(item.agent_id).slice(0, 8)}</strong><small>{item.readiness_score}% ready · integrations {item.integrations_ready ? "ready" : "blocked"} · workflow {item.workflow_ready ? "ready" : "blocked"}</small></div><em>{item.blockers && Object.keys(item.blockers as object).length ? "Needs attention" : "Ready"}</em></article>)}{!data.readiness.length && <p className="admin-empty">No readiness record exists yet.</p>}</div></section>
    </div>

    <section className="admin-panel"><header className="admin-panel-header"><div><h2>Operations controls</h2><p>Jump directly into the systems that create autonomous outcomes.</p></div><ArrowUpRight size={18}/></header><div className="admin-action-grid"><Link href="/dashboard/limitless/followups"><Target size={15}/><span>Follow-up engine<small>Sequences and scheduled client actions</small></span></Link><Link href="/dashboard/clients"><Bot size={15}/><span>Agent assignments<small>Control which agents belong to each tenant</small></span></Link><Link href="/dashboard/workflows"><Network size={15}/><span>Workflow orchestration<small>Connect actions and automation routes</small></span></Link></div></section>
  </main>;
}
