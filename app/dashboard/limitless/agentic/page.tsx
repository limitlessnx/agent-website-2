export const dynamic = "force-dynamic";

import { Activity, BrainCircuit, Clock3, Database, MessageCircle, ShieldCheck, Zap } from "@/components/admin/ServerIcons";
import { createAdminClient } from "@/lib/supabase/admin";

const ORG_SLUG = "limitless-realty";
const CANONICAL_ROUTE = "existing-limitless-realty-maia-n8n";

export default async function LimitlessAgenticPage() {
  const admin = createAdminClient();
  const { data: organization } = await admin.from("organizations").select("id,name,status").eq("slug", ORG_SLUG).maybeSingle();
  if (!organization) return <div className="admin-page"><section className="maia-empty"><h1>Maia Agentic Intelligence</h1><p>Limitless Realty is not provisioned yet.</p></section></div>;
  const { data: maia } = await admin.from("agents").select("id,name,slug,status").eq("organization_id", organization.id).eq("slug", "maia").maybeSingle();
  if (!maia) return <div className="admin-page"><section className="maia-empty"><h1>Maia Agentic Intelligence</h1><p>The canonical Maia agent is missing.</p></section></div>;

  const [profileResult, readinessResult, sessionsResult, toolRunsResult, goalsResult, followupsResult] = await Promise.all([
    admin.from("agent_runtime_profiles").select("enabled,autonomy_mode,max_steps,model_strategy,memory_enabled").eq("organization_id", organization.id).eq("agent_id", maia.id).maybeSingle(),
    admin.from("agent_runtime_readiness").select("readiness_score,blockers,integrations_ready,workflow_ready").eq("organization_id", organization.id).eq("agent_id", maia.id).maybeSingle(),
    admin.from("agent_runtime_sessions").select("id,status,updated_at").eq("organization_id", organization.id).eq("agent_id", maia.id).order("updated_at", { ascending: false }).limit(20),
    admin.from("agent_runtime_tool_runs").select("id,tool_name,status,started_at").eq("organization_id", organization.id).eq("agent_id", maia.id).order("started_at", { ascending: false }).limit(20),
    admin.from("agent_runtime_goals").select("id,title,status,goal_type,next_run_at").eq("organization_id", organization.id).eq("agent_id", maia.id).order("updated_at", { ascending: false }).limit(20),
    admin.from("follow_ups").select("id,status,stage,scheduled_at").eq("organization_id", organization.id).order("scheduled_at", { ascending: false }).limit(20),
  ]);

  const profile = profileResult.data;
  const readiness = readinessResult.data;
  const sessions = sessionsResult.data || [];
  const tools = toolRunsResult.data || [];
  const goals = goalsResult.data || [];
  const followups = followupsResult.data || [];
  const activeGoals = goals.filter((g) => ["queued", "running", "active"].includes(String(g.status))).length;
  const completedGoals = goals.filter((g) => ["completed", "done", "success"].includes(String(g.status))).length;
  const failedGoals = goals.filter((g) => ["failed", "error", "timeout"].includes(String(g.status))).length;
  const readinessScore = Number(readiness?.readiness_score || 0);
  const online = Boolean(profile?.enabled && maia.status && maia.status !== "inactive");

  return <div className="admin-page maia-command">
    <section className="maia-hero">
      <div className="maia-hero-copy">
        <div className="maia-eyebrow"><span className="maia-dot"/> Limitless Realty · Maia <b>ONLINE</b></div>
        <h1>Meet Maia <span>✦</span></h1><h2>Agentic Intelligence</h2>
        <p>Your autonomous real estate assistant. Finding leads, answering inquiries, scheduling viewings and coordinating follow-ups around the clock.</p>
        <div className="maia-hero-actions"><a href="/dashboard/limitless/leads">Chat with Maia</a><a className="secondary" href="/dashboard/limitless/followups">View activity</a></div>
        <div className="maia-live"><span className="maia-dot"/> Live · {online ? "Processing requests and monitoring workflows" : "Agent offline"}</div>
      </div>
      <div className="maia-robot-wrap"><div className="maia-orbit orbit-a"/><div className="maia-orbit orbit-b"/><img src="/maia-robot.svg" alt="Maia robotic AI assistant" /></div>
    </section>

    <nav className="maia-module-nav" aria-label="Limitless Realty modules">
      <a className="active" href="/dashboard/limitless/agentic"><BrainCircuit/><span>Maia</span></a><a href="/dashboard/limitless/leads"><MessageCircle/><span>Leads</span></a><a href="/dashboard/limitless/properties"><Database/><span>Properties</span></a><a href="/dashboard/limitless/followups"><Clock3/><span>Follow-ups</span></a><a href="/dashboard/workflows"><Zap/><span>Workflows</span></a><a href="/dashboard/limitless/payments"><ShieldCheck/><span>Payments</span></a>
    </nav>

    <div className="maia-stat-grid">
      <article><span><BrainCircuit/> Autonomy</span><strong>{profile?.autonomy_mode === "autonomous" ? "ON" : "OFF"}</strong><small>{profile?.max_steps || 0} max reasoning steps</small></article>
      <article><span><ShieldCheck/> Readiness</span><strong>{readinessScore}%</strong><small>{readinessScore >= 90 ? "Fully operational" : "Needs attention"}</small></article>
      <article><span><MessageCircle/> Active chats</span><strong>{sessions.length}</strong><small>Recent Maia sessions</small></article>
      <article><span><Zap/> Active goals</span><strong>{activeGoals}</strong><small>{completedGoals} completed · {failedGoals} failed</small></article>
    </div>

    <section className="maia-system"><header><div><Activity/><strong>System health</strong></div><span><i/> All systems operational</span></header><div className="maia-health-grid"><div><b>◷</b><span>Scheduler<small>Every 5 min</small></span><i/></div><div><b>◈</b><span>Maia Gateway<small>Online</small></span><i/></div><div><b>◉</b><span>WhatsApp<small>Connected</small></span><i/></div><div><b>◎</b><span>CRM<small>Syncing</small></span><i/></div></div></section>

    <div className="maia-content-grid">
      <section className="maia-panel"><header><div><h2>Goal execution</h2><p>Current autonomous workload</p></div><span>Live</span></header><div className="goal-ring"><div><strong>{goals.length}</strong><small>Total goals</small></div></div><div className="goal-legend"><span><i className="done"/> Completed <b>{completedGoals}</b></span><span><i className="run"/> Running <b>{activeGoals}</b></span><span><i className="fail"/> Failed <b>{failedGoals}</b></span></div></section>
      <section className="maia-panel"><header><div><h2>Recent activity</h2><p>Latest agent operations</p></div><span>View all</span></header><div className="activity-list">{tools.slice(0,4).map((run)=><div key={run.id}><b>✓</b><span><strong>{run.tool_name}</strong><small>{run.status}</small></span><em>{run.started_at ? new Date(run.started_at).toLocaleTimeString("en-NG",{hour:"2-digit",minute:"2-digit"}) : ""}</em></div>)}{!tools.length&&<div className="maia-empty-inline">No tool activity yet.</div>}</div></section>
      <section className="maia-panel wide"><header><div><h2>Automation usage</h2><p>Agent reliability and execution signals</p></div><span>7 days</span></header><div className="usage-number">{tools.length ? Math.max(0, Math.round(((tools.length-tools.filter(t=>["failed","error","timeout"].includes(String(t.status))).length)/tools.length)*100)) : 100}<small>% success rate</small></div><div className="usage-line"><span/><span/><span/><span/><span/><span/></div></section>
      <section className="maia-panel"><header><div><h2>Maia status</h2><p>Runtime configuration</p></div><span className="online-pill"><i/> Online</span></header><div className="status-grid"><div>Sessions<strong>{sessions.length}</strong></div><div>Pending goals<strong>{activeGoals}</strong></div><div>Memory<strong>{profile?.memory_enabled ? "Enabled" : "Off"}</strong></div><div>Workflow<strong>{readiness?.workflow_ready ? "Ready" : "Blocked"}</strong></div></div></section>
      <section className="maia-panel"><header><div><h2>Follow-up engine</h2><p>Scheduled client sequences</p></div><span>{followups.length} active</span></header><div className="followup-stages"><b>1</b><b>3</b><b>7</b><b>14</b><b>21</b><b>30</b></div><small>Automated property-interest cadence</small></section>
    </div>
  </div>;
}
