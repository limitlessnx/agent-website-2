import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ShieldCheck,
  Workflow,
} from "@/components/admin/ServerIcons";
import PlanEntitlementsPanel from "@/components/portal/PlanEntitlementsPanel";
import { getClientSession } from "@/lib/client-auth";
import { getClientPortalSummary } from "@/lib/client-portal-data";
import { getFluxWalletSummary } from "@/lib/flux-credits";

export const metadata = { title: "Client Portal | Fluxknight" };
export const dynamic = "force-dynamic";

function formatDate(value?: string | null) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function trialDaysRemaining(trialEndsAt: string | null) {
  if (!trialEndsAt) return null;
  return Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86_400_000));
}

function friendlyWorkflowName(value: string) {
  return String(value || "")
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function ClientPortalPage() {
  const session = await getClientSession();
  if (!session) return null;

  const [summary, wallet] = await Promise.all([
    getClientPortalSummary(session.organizationId),
    getFluxWalletSummary(session.organizationId),
  ]);

  const activeAgents = summary.agents.filter((agent) => ["published", "testing"].includes(agent.status)).length;
  const activeWorkflows = summary.workflows.filter((workflow) => workflow.status === "active").length;
  const successfulRuns = summary.runs.filter((run) => run.status === "succeeded").length;
  const failedRuns = summary.runs.filter((run) => !["succeeded", "completed", "success"].includes(run.status.toLowerCase()));
  const attentionAgents = summary.agents.filter((agent) => !["published", "testing", "active"].includes(agent.status.toLowerCase()));
  const trialDays = trialDaysRemaining(wallet.trialEndsAt);
  const isTrial = wallet.trialEndsAt !== null || wallet.trialCreditLimit !== null;
  const businessName = summary.onboarding?.business_name || session.organizationSlug;
  const systemHealthy = failedRuns.length === 0 && attentionAgents.length === 0;
  const recentActivity = summary.runs.slice(0, 6);

  return (
    <main className="portal-page portal-command-center">
      <section className="portal-command-hero">
        <div>
          <p className="portal-kicker">Business command center</p>
          <h1>Welcome back, {businessName}.</h1>
          <p>See what your AI team is handling, what needs your attention, and how your business systems are performing.</p>
        </div>
        <div className={`portal-health-pill ${systemHealthy ? "healthy" : "attention"}`}>
          <span />
          <div>
            <small>System status</small>
            <strong>{systemHealthy ? "Everything is running normally" : "A few items need attention"}</strong>
          </div>
        </div>
      </section>

      {isTrial ? (
        <section className="portal-trial-banner" aria-label="Free trial status">
          <div>
            <p className="portal-kicker">Basic free trial</p>
            <strong>{wallet.chargeableAiPaused ? "Trial ended" : `${trialDays ?? 0} day${trialDays === 1 ? "" : "s"} remaining`}</strong>
            <small>WhatsApp AI + Web AI are included during your trial.</small>
          </div>
          <div>
            <span>Flux Credits</span>
            <strong>{wallet.balance.toLocaleString("en-NG")} / {(wallet.trialCreditLimit || wallet.monthlyCredits).toLocaleString("en-NG")}</strong>
            <small>Trial ends when time expires or credits reach zero.</small>
          </div>
          <Link className="portal-button" href="/pricing">Upgrade plan</Link>
        </section>
      ) : null}

      <section className="portal-business-metrics" aria-label="Business system overview">
        <article className="portal-business-metric">
          <span><Bot size={17} /> AI team</span>
          <strong>{activeAgents}</strong>
          <small>{summary.agents.length} total agent{summary.agents.length === 1 ? "" : "s"}</small>
        </article>
        <article className="portal-business-metric">
          <span><Workflow size={17} /> Automations</span>
          <strong>{activeWorkflows}</strong>
          <small>{summary.workflows.length} configured</small>
        </article>
        <article className="portal-business-metric">
          <span><Activity size={17} /> Recent activity</span>
          <strong>{summary.runs.length}</strong>
          <small>{successfulRuns} completed successfully</small>
        </article>
        <article className="portal-business-metric">
          <span><Clock3 size={17} /> Flux Credits</span>
          <strong>{wallet.balance.toLocaleString("en-NG")}</strong>
          <small>{wallet.percentUsed}% used this cycle</small>
        </article>
      </section>

      <section className="portal-command-grid">
        <article className="portal-card portal-attention-card">
          <div className="portal-card-head">
            <div>
              <p className="portal-kicker">Needs your attention</p>
              <h2>{systemHealthy ? "Nothing urgent right now" : "Review these items"}</h2>
              <p>Important items that could affect your AI team or customer experience.</p>
            </div>
            {systemHealthy ? <CheckCircle2 size={19} /> : <AlertTriangle size={19} />}
          </div>

          <div className="portal-list">
            {failedRuns.slice(0, 3).map((run) => (
              <Link className="portal-list-row portal-list-link" href="/portal/systems" key={run.id}>
                <div>
                  <strong>{friendlyWorkflowName(run.workflow_key)}</strong>
                  <span>An automation needs review · {formatDate(run.created_at)}</span>
                </div>
                <em>Review</em>
              </Link>
            ))}
            {attentionAgents.slice(0, 2).map((agent) => (
              <Link className="portal-list-row portal-list-link" href="/portal/agents" key={agent.id}>
                <div>
                  <strong>{agent.name}</strong>
                  <span>This AI agent is currently {agent.status.replaceAll("_", " ")}.</span>
                </div>
                <em>Open</em>
              </Link>
            ))}
            {systemHealthy ? (
              <div className="portal-clear-state">
                <span><ShieldCheck size={19} /></span>
                <div>
                  <strong>Your systems look healthy</strong>
                  <p>No recent failures or agent setup issues need your attention.</p>
                </div>
              </div>
            ) : null}
          </div>
        </article>

        <article className="portal-card portal-quick-actions">
          <div className="portal-card-head">
            <div><p className="portal-kicker">Quick actions</p><h2>Manage your business systems</h2></div>
          </div>
          <div className="portal-action-list">
            <Link href="/portal/agents"><span><Bot size={17} /></span><div><strong>Open AI Team</strong><small>See your agents and what they are configured to handle.</small></div><ChevronRight size={16} /></Link>
            <Link href="/portal/systems"><span><Workflow size={17} /></span><div><strong>View Automations</strong><small>Review the systems working in the background.</small></div><ChevronRight size={16} /></Link>
            <Link href="/portal/integrations"><span><Activity size={17} /></span><div><strong>Check Connections</strong><small>See whether your business channels are connected.</small></div><ChevronRight size={16} /></Link>
            <Link href="/portal/billing"><span><Clock3 size={17} /></span><div><strong>Plan & Usage</strong><small>Review credits, plan access and usage.</small></div><ChevronRight size={16} /></Link>
          </div>
        </article>
      </section>

      <section className="portal-card portal-ai-team-preview">
        <div className="portal-card-head">
          <div>
            <p className="portal-kicker">AI workforce</p>
            <h2>Your AI Team</h2>
            <p>See the systems working for your business and their current status.</p>
          </div>
          <Link href="/portal/agents">View all agents <ChevronRight size={14} /></Link>
        </div>
        <div className="portal-ai-team-grid">
          {summary.agents.slice(0, 3).map((agent) => (
            <Link href="/portal/agents" className="portal-ai-team-card" key={agent.id}>
              <span className="portal-agent-icon"><Bot size={20} /></span>
              <div>
                <div className="portal-ai-team-title">
                  <strong>{agent.name}</strong>
                  <em className={["published", "testing", "active"].includes(agent.status.toLowerCase()) ? "live" : "attention"}><i />{agent.status.replaceAll("_", " ")}</em>
                </div>
                <p>{agent.description || "AI agent configured for your business."}</p>
              </div>
              <ChevronRight size={17} />
            </Link>
          ))}
          {!summary.agents.length ? <p className="portal-empty">Your AI agents will appear here once provisioning begins.</p> : null}
        </div>
      </section>

      <section className="portal-card">
        <div className="portal-card-head">
          <div>
            <p className="portal-kicker">Business activity</p>
            <h2>What your systems have been doing</h2>
            <p>A simple view of recent automation activity in your workspace.</p>
          </div>
          <Link href="/portal/systems">View automations <ChevronRight size={14} /></Link>
        </div>
        <div className="portal-list">
          {recentActivity.map((run) => (
            <div className="portal-list-row" key={run.id}>
              <div>
                <strong>{friendlyWorkflowName(run.workflow_key)}</strong>
                <span>{formatDate(run.created_at)}{run.duration_ms ? ` · ${run.duration_ms} ms` : ""}</span>
              </div>
              <em>{run.status.replaceAll("_", " ")}</em>
            </div>
          ))}
          {!recentActivity.length ? <p className="portal-empty">No recent business-system activity has been recorded yet.</p> : null}
        </div>
      </section>

      <PlanEntitlementsPanel planCode={wallet.planCode} />
    </main>
  );
}
