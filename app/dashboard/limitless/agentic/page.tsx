import { Activity, BrainCircuit, CheckCircle2, Clock3, Database, MessageCircle, ShieldCheck, Zap } from "@/components/admin/ServerIcons";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const ORG_SLUG = "limitless-realty";
const CANONICAL_ROUTE = "existing-limitless-realty-maia-n8n";

function statusLabel(value: boolean) {
  return value ? "Ready" : "Needs attention";
}

export default async function LimitlessAgenticPage() {
  const admin = createAdminClient();
  const { data: organization } = await admin.from("organizations").select("id,name,status").eq("slug", ORG_SLUG).maybeSingle();

  if (!organization) {
    return <div className="admin-page"><section className="admin-panel"><h1>Maia Agentic Intelligence</h1><p>Limitless Realty is not provisioned yet.</p></section></div>;
  }

  const { data: maia } = await admin.from("agents").select("id,name,slug,status,configuration,communication_channels").eq("organization_id", organization.id).eq("slug", "maia").maybeSingle();
  if (!maia) {
    return <div className="admin-page"><section className="admin-panel"><h1>Maia Agentic Intelligence</h1><p>The canonical Maia agent is missing. The dashboard will not create a secondary agent.</p></section></div>;
  }

  const [profileResult, readinessResult, modelResult, sessionsResult, messagesResult, toolRunsResult, goalsResult, failedGoalsResult, followupsResult, propertiesResult] = await Promise.all([
    admin.from("agent_runtime_profiles").select("enabled,autonomy_mode,max_steps,model_strategy,memory_enabled,tool_policy").eq("organization_id", organization.id).eq("agent_id", maia.id).maybeSingle(),
    admin.from("agent_runtime_readiness").select("business_profile_ready,prompt_ready,knowledge_ready,integrations_ready,test_ready,approval_ready,workflow_ready,readiness_score,blockers,refreshed_at").eq("organization_id", organization.id).eq("agent_id", maia.id).maybeSingle(),
    admin.from("organization_ai_model_assignments").select("model_id,settings,ai_model_catalog:ai_model_catalog(provider,model_key,display_name,status)").eq("organization_id", organization.id),
    admin.from("agent_runtime_sessions").select("id,status,channel,step_count,updated_at,last_model_id").eq("organization_id", organization.id).eq("agent_id", maia.id).order("updated_at", { ascending: false }).limit(8),
    admin.from("agent_runtime_messages").select("id,role,tool_name,created_at").eq("organization_id", organization.id).eq("agent_id", maia.id).order("created_at", { ascending: false }).limit(8),
    admin.from("agent_runtime_tool_runs").select("id,tool_name,status,started_at,finished_at").eq("organization_id", organization.id).eq("agent_id", maia.id).order("started_at", { ascending: false }).limit(8),
    admin.from("agent_runtime_goals").select("id,title,status,goal_type,next_run_at,updated_at").eq("organization_id", organization.id).eq("agent_id", maia.id).order("updated_at", { ascending: false }).limit(12),
    admin.from("agent_runtime_goals").select("id,status").eq("organization_id", organization.id).eq("agent_id", maia.id).eq("status", "failed").limit(50),
    admin.from("follow_ups").select("id,status,stage,scheduled_at,sent_at,lead_id").eq("organization_id", organization.id).order("scheduled_at", { ascending: false }).limit(12),
    admin.from("properties").select("id,status").limit(1),
  ]);

  const profile = profileResult.data;
  const readiness = readinessResult.data;
  const models = modelResult.data || [];
  const sessions = sessionsResult.data || [];
  const messages = messagesResult.data || [];
  const toolRuns = toolRunsResult.data || [];
  const goals = goalsResult.data || [];
  const failedGoals = failedGoalsResult.data || [];
  const followups = followupsResult.data || [];
  const readinessScore = Number(readiness?.readiness_score || 0);
  const blockers = Array.isArray(readiness?.blockers) ? readiness?.blockers : [];
  const modelNames = models.map((row: any) => row.ai_model_catalog?.display_name || row.ai_model_catalog?.model_key).filter(Boolean);
  const configured = Boolean(profile?.enabled && profile?.autonomy_mode === "autonomous");

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <p className="admin-kicker">Limitless Realty · Maia</p>
          <h1>Agentic Intelligence</h1>
          <p>Maia's operating brain, tools, memory, autonomous goals, property reasoning and WhatsApp route in one control surface.</p>
        </div>
      </div>

      <div className="admin-metric-grid">
        <article className="admin-metric-card"><p><BrainCircuit size={15}/> Autonomy</p><strong>{configured ? "ON" : "OFF"}</strong><span>{profile?.max_steps || 0} max reasoning steps</span></article>
        <article className="admin-metric-card"><p><ShieldCheck size={15}/> Readiness</p><strong>{readinessScore}%</strong><span>{statusLabel(readinessScore >= 90)}</span></article>
        <article className="admin-metric-card"><p><MessageCircle size={15}/> Runtime sessions</p><strong>{sessions.length}</strong><span>Recent Maia sessions</span></article>
        <article className="admin-metric-card"><p><Zap size={15}/> Tool runs</p><strong>{toolRuns.length}</strong><span>{failedGoals.length} failed autonomous goals</span></article>
      </div>

      <section className="admin-panel">
        <div className="admin-panel-header"><div><h2>Operating state</h2><p>These are the controls and routes Maia is actually using.</p></div></div>
        <div className="admin-list">
          <div className="admin-list-row"><strong>Canonical WhatsApp transport</strong><span>{CANONICAL_ROUTE}</span></div>
          <div className="admin-list-row"><strong>Agent status</strong><span>{maia.status}</span></div>
          <div className="admin-list-row"><strong>Autonomy mode</strong><span>{profile?.autonomy_mode || "not configured"}</span></div>
          <div className="admin-list-row"><strong>Model strategy</strong><span>{profile?.model_strategy || "not configured"}</span></div>
          <div className="admin-list-row"><strong>Memory</strong><span>{profile?.memory_enabled ? "Enabled" : "Disabled"}</span></div>
          <div className="admin-list-row"><strong>Assigned models</strong><span>{modelNames.length ? modelNames.join(" · ") : "No assigned model"}</span></div>
          <div className="admin-list-row"><strong>Property catalogue</strong><span>{propertiesResult.data?.length ? "Connected" : "No catalogue records"}</span></div>
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header"><div><h2>Readiness gates</h2><p>Maia should not silently operate when a required foundation is missing.</p></div></div>
        <div className="admin-list">
          {[
            ["Business profile", readiness?.business_profile_ready],
            ["Prompt", readiness?.prompt_ready],
            ["Knowledge", readiness?.knowledge_ready],
            ["Integrations", readiness?.integrations_ready],
            ["Testing", readiness?.test_ready],
            ["Approval", readiness?.approval_ready],
            ["Workflow", readiness?.workflow_ready],
          ].map(([label, value]) => <div key={String(label)} className="admin-list-row"><strong>{label}</strong><span>{value ? "✓ Ready" : "• Needs attention"}</span></div>)}
          {blockers.length ? <div className="admin-list-row"><strong>Blockers</strong><span>{blockers.map(String).join(" · ")}</span></div> : null}
        </div>
      </section>

      <div className="payment-grid">
        <section className="admin-panel">
          <div className="admin-panel-header"><div><h2><Activity size={17}/> Autonomous goals</h2><p>Queued work that Maia can execute without a human sitting there clicking buttons.</p></div></div>
          <div className="admin-list">
            {goals.map((goal) => <div key={goal.id} className="admin-list-row"><div><strong>{goal.title}</strong><small>{goal.goal_type} · {goal.next_run_at ? `next ${new Date(goal.next_run_at).toLocaleString("en-NG")}` : "no scheduled run"}</small></div><span>{goal.status}</span></div>)}
            {!goals.length ? <p className="admin-empty">No autonomous goals have executed yet. The runtime is configured, but it has not received a live event or queued goal.</p> : null}
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-header"><div><h2><Clock3 size={17}/> Follow-up engine</h2><p>Property-interest sequences use 1, 3, 7, 14, 21 and 30 day stages.</p></div></div>
          <div className="admin-list">
            {followups.map((row) => <div key={row.id} className="admin-list-row"><div><strong>Stage {row.stage || "-"}</strong><small>{row.scheduled_at ? new Date(row.scheduled_at).toLocaleString("en-NG") : "not scheduled"}</small></div><span>{row.status}</span></div>)}
            {!followups.length ? <p className="admin-empty">No follow-ups are currently recorded.</p> : null}
          </div>
        </section>
      </div>

      <section className="admin-panel">
        <div className="admin-panel-header"><div><h2><Database size={17}/> Runtime observability</h2><p>Sessions, messages and tool execution become visible here once Maia starts receiving production traffic.</p></div></div>
        <div className="admin-list">
          {toolRuns.map((run) => <div key={run.id} className="admin-list-row"><div><strong>{run.tool_name}</strong><small>{run.started_at ? new Date(run.started_at).toLocaleString("en-NG") : ""}</small></div><span>{run.status}</span></div>)}
          {!toolRuns.length ? <p className="admin-empty">No tool runs yet. This is consistent with the current database state: the agentic runtime tables exist, but no Maia runtime session has been recorded.</p> : null}
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header"><div><h2><CheckCircle2 size={17}/> What is live now</h2><p>Production behaviour this control surface is enforcing.</p></div></div>
        <div className="admin-list">
          <div className="admin-list-row"><strong>Property reasoning</strong><span>Budget ≤ client amount, plus clearly labelled alternatives ≤ 20% above</span></div>
          <div className="admin-list-row"><strong>Human handover</strong><span>Canonical Maia route → 2348127753308 with conversation summary</span></div>
          <div className="admin-list-row"><strong>Follow-up interruption</strong><span>New inbound client replies cancel pending follow-ups before Maia reassesses</span></div>
          <div className="admin-list-row"><strong>Autonomous cadence</strong><span>1 → 3 → 7 → 14 → 21 → 30 days for qualified property interest</span></div>
          <div className="admin-list-row"><strong>Autonomous worker</strong><span>Scheduled every 5 minutes by the existing Vercel cron route</span></div>
        </div>
      </section>
    </div>
  );
}
