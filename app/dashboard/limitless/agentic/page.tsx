export const dynamic = "force-dynamic";

import Link from "next/link";
import { Activity, ChevronDown, MessageCircle, ShieldCheck, Target, Zap } from "@/components/admin/ServerIcons";
import { createAdminClient } from "@/lib/supabase/admin";
import styles from "./MaiaAgentic.module.css";

const ORG_SLUG = "limitless-realty";

export default async function LimitlessAgenticPage() {
  const admin = createAdminClient();
  const { data: organization } = await admin.from("organizations").select("id,name,status").eq("slug", ORG_SLUG).maybeSingle();
  if (!organization) return <main className={styles.page}><section className={styles.analytics}><h1>Maia Overview</h1><p>Limitless Realty is not provisioned yet.</p></section></main>;

  const { data: maia } = await admin.from("agents").select("id,name,slug,status").eq("organization_id", organization.id).eq("slug", "maia").maybeSingle();
  if (!maia) return <main className={styles.page}><section className={styles.analytics}><h1>Maia Overview</h1><p>The canonical Maia agent is missing.</p></section></main>;

  const [profileResult, readinessResult, sessionsResult, toolRunsResult, goalsResult, followupsResult] = await Promise.all([
    admin.from("agent_runtime_profiles").select("enabled,autonomy_mode,max_steps,model_strategy,memory_enabled").eq("organization_id", organization.id).eq("agent_id", maia.id).maybeSingle(),
    admin.from("agent_runtime_readiness").select("readiness_score,blockers,integrations_ready,workflow_ready").eq("organization_id", organization.id).eq("agent_id", maia.id).maybeSingle(),
    admin.from("agent_runtime_sessions").select("id,status,updated_at").eq("organization_id", organization.id).eq("agent_id", maia.id).order("updated_at", { ascending: false }).limit(50),
    admin.from("agent_runtime_tool_runs").select("id,tool_name,status,started_at").eq("organization_id", organization.id).eq("agent_id", maia.id).order("started_at", { ascending: false }).limit(50),
    admin.from("agent_runtime_goals").select("id,title,status,goal_type,next_run_at,updated_at").eq("organization_id", organization.id).eq("agent_id", maia.id).order("updated_at", { ascending: false }).limit(50),
    admin.from("follow_ups").select("id,status,stage,scheduled_at").eq("organization_id", organization.id).order("scheduled_at", { ascending: false }).limit(50),
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
  const toolFailures = tools.filter((t) => ["failed", "error", "timeout"].includes(String(t.status))).length;
  const successRate = tools.length ? Math.max(0, Math.round(((tools.length - toolFailures) / tools.length) * 100)) : 100;
  const recentTools = tools.slice(0, 3);
  const total = goals.length;
  const pct = (n: number) => total ? Math.round((n / total) * 100) : 0;
  const lastRun = tools[0]?.started_at ? new Date(tools[0].started_at).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" }) : "No runs";

  return <main className={styles.page}>
    <section className={styles.hero}>
      <div className={styles.portrait}><img src="/maia-portrait.svg" alt="Maia AI" /></div>
      <div className={styles.copy}>
        <div className={styles.eyebrow}>Limitless Realty · Maia <span className={styles.badge}><i className={styles.dot}/>Autonomous</span></div>
        <h1>Agentic Intelligence</h1>
        <p>Maia's operating brain, tools, memory, autonomous goals, property reasoning and WhatsApp route in one control surface.</p>
      </div>
      <div className={styles.heroStatus}>
        <span>MAIA STATUS</span><strong><i className={styles.dot}/>Online</strong><small>Last runtime: {lastRun}</small>
      </div>
    </section>

    <section className={styles.stats}>
      <article className={`${styles.card} ${styles.stat}`}><div className={styles.statTop}><span>Autonomy</span><Zap size={17}/></div><strong className={styles.green}>{profile?.autonomy_mode === "autonomous" ? "ON" : "OFF"}</strong><small>{profile?.max_steps || 0} max steps</small></article>
      <article className={`${styles.card} ${styles.stat}`}><div className={styles.statTop}><span>Readiness</span><ShieldCheck size={17}/></div><strong>{readinessScore}%</strong><small>{readinessScore >= 90 ? "Fully operational" : "Needs attention"}</small></article>
      <article className={`${styles.card} ${styles.stat}`}><div className={styles.statTop}><span>Runtime Sessions</span><MessageCircle size={17}/></div><strong>{sessions.length}</strong><small>Recent sessions</small></article>
      <article className={`${styles.card} ${styles.stat}`}><div className={styles.statTop}><span>Active Goals</span><Target size={17}/></div><strong>{activeGoals}</strong><small className={styles.green}>Running</small></article>
    </section>

    <section className={styles.health}><div className={styles.healthHeader}><div className={styles.healthTitle}><Activity size={17}/>System Health</div><div className={styles.healthy}>All systems operational <i className={styles.dot}/></div></div><div className={styles.healthItems}><div className={styles.healthItem}><i className={styles.check}>✓</i><span><b>Scheduler</b><small>Every 5 min</small></span></div><div className={styles.healthItem}><i className={styles.check}>✓</i><span><b>Maia Gateway</b><small>Online</small></span></div><div className={styles.healthItem}><i className={styles.check}>✓</i><span><b>Autonomous</b><small>Online</small></span></div><div className={styles.healthItem}><i className={styles.check}>✓</i><span><b>Follow-ups</b><small>{followups.length ? "Online" : "Ready"}</small></span></div></div></section>

    <section className={styles.analyticsGrid}>
      <article className={styles.analytics}><header className={styles.analyticsHeader}><span>Goal Execution</span><button>7 days <ChevronDown size={11}/></button></header><div className={styles.goal}><div className={styles.ring}><div className={styles.ringInner}><strong>{total}</strong><small>Total</small></div></div><div className={styles.legend}><div className={styles.legendRow}><i className={styles.legendDot} style={{background:"#7c3aed"}}/><span>Completed</span><b>{completedGoals} ({pct(completedGoals)}%)</b></div><div className={styles.legendRow}><i className={styles.legendDot} style={{background:"#35d46f"}}/><span>Running</span><b>{activeGoals} ({pct(activeGoals)}%)</b></div><div className={styles.legendRow}><i className={styles.legendDot} style={{background:"#eab308"}}/><span>Failed</span><b>{failedGoals} ({pct(failedGoals)}%)</b></div></div></div></article>
      <article className={styles.analytics}><header className={styles.analyticsHeader}><span>Recent Activity</span><Link href="/dashboard/limitless/followups">View all</Link></header><div className={styles.activity}>{recentTools.length ? recentTools.map((run)=><div className={styles.activityRow} key={run.id}><span className={styles.activityIcon}><Activity size={13}/></span><span className={styles.activityText}><b>{run.tool_name}</b><small>{run.status === "completed" ? "Autonomous goal completed" : String(run.status)}</small></span><time>{run.started_at ? new Date(run.started_at).toLocaleTimeString("en-NG",{hour:"2-digit",minute:"2-digit"}) : ""}</time></div>) : <div className={styles.empty}>No recent activity yet.</div>}</div><Link className={styles.view} href="/dashboard/limitless/followups">View all activity →</Link></article>
      <article className={styles.analytics}><header className={styles.analyticsHeader}><span>Automation Usage</span><button>7 days <ChevronDown size={11}/></button></header><div className={styles.usage}><strong>{successRate}%</strong><small>Success rate</small><div className={styles.chart}/></div></article>
      <article className={styles.analytics}><header className={styles.analyticsHeader}><span>Maia Status</span><em className={styles.online}>Online</em></header><div className={styles.statusGrid}><div className={styles.statusCell}><small>Last run</small><b>{lastRun}</b></div><div className={styles.statusCell}><small>Next run</small><b>Scheduled</b></div><div className={styles.statusCell}><small>Environment</small><b>Production</b></div><div className={styles.statusCell}><small>Memory</small><b>{profile?.memory_enabled ? "Enabled" : "Ready"}</b></div></div></article>
    </section>
  </main>;
}
