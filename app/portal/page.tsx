import Link from "next/link";
import { Activity, Bot, CheckCircle2, Clock3, Workflow } from "@/components/admin/ServerIcons";
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
  const successRate = summary.runs.length ? Math.round((successfulRuns / summary.runs.length) * 100) : 0;
  const trialDays = trialDaysRemaining(wallet.trialEndsAt);
  const isTrial = wallet.trialEndsAt !== null || wallet.trialCreditLimit !== null;

  return (
    <main className="portal-page">
      <section className="portal-hero">
        <div>
          <p className="portal-kicker">AI operations workspace</p>
          <h1>Your business system is taking shape.</h1>
          <p>Track agent setup, workflows, integrations, launch readiness and plan access from one tenant-secured workspace.</p>
        </div>
        <div className="portal-status-badge"><span>Current stage</span><strong>{summary.onboarding?.status.replaceAll("_", " ") || "setup"}</strong></div>
      </section>

      {isTrial ? (
        <section
          aria-label="Free trial status"
          style={{
            margin: "0 0 22px",
            padding: "20px 22px",
            border: "1px solid rgba(168,85,247,.34)",
            borderRadius: 18,
            background: "linear-gradient(135deg, rgba(126,34,206,.16), rgba(255,255,255,.025))",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
            gap: 18,
            alignItems: "center",
          }}
        >
          <div>
            <p className="portal-kicker" style={{ marginBottom: 6 }}>Basic free trial</p>
            <strong style={{ display: "block", fontSize: 20 }}>
              {wallet.chargeableAiPaused ? "Trial ended" : `${trialDays ?? 0} day${trialDays === 1 ? "" : "s"} remaining`}
            </strong>
            <small style={{ display: "block", marginTop: 7, opacity: .72 }}>
              WhatsApp AI + Web AI only. Voice, calls, follow-ups and paid-plan features stay locked during trial.
            </small>
          </div>
          <div>
            <span style={{ display: "block", fontSize: 12, opacity: .68 }}>Flux Credits</span>
            <strong style={{ display: "block", marginTop: 4, fontSize: 22 }}>
              {wallet.balance.toLocaleString("en-NG")} / {(wallet.trialCreditLimit || wallet.monthlyCredits).toLocaleString("en-NG")}
            </strong>
            <small style={{ display: "block", marginTop: 7, opacity: .72 }}>
              Trial ends when time expires or credits reach zero, whichever happens first.
            </small>
          </div>
          <div style={{ justifySelf: "end" }}>
            <Link className="portal-button" href="/pricing">Upgrade plan</Link>
          </div>
        </section>
      ) : null}

      <section className="portal-metrics">
        <article className="portal-metric"><span><Bot size={16} /> Agents</span><strong>{summary.agents.length}</strong><small>{activeAgents} active or testing</small></article>
        <article className="portal-metric"><span><Workflow size={16} /> Workflows</span><strong>{summary.workflows.length}</strong><small>{activeWorkflows} active</small></article>
        <article className="portal-metric"><span><CheckCircle2 size={16} /> Success rate</span><strong>{successRate}%</strong><small>{summary.runs.length} recent runs</small></article>
        <article className="portal-metric"><span><Clock3 size={16} /> Credits</span><strong>{wallet.percentUsed}%</strong><small>{wallet.balance.toLocaleString("en-NG")} remaining</small></article>
      </section>

      <section className="portal-grid">
        <article className="portal-card">
          <div className="portal-card-head"><div><h2>Recent workflow activity</h2><p>Latest execution records visible to your organization.</p></div><Activity size={18} /></div>
          <div className="portal-list">
            {summary.runs.slice(0, 6).map((run) => (
              <div className="portal-list-row" key={run.id}>
                <div><strong>{run.workflow_key}</strong><span>{formatDate(run.created_at)} · {run.duration_ms ? `${run.duration_ms} ms` : "duration pending"}</span></div>
                <em>{run.status}</em>
              </div>
            ))}
            {!summary.runs.length ? <p className="portal-empty">No workflow executions have been recorded yet.</p> : null}
          </div>
        </article>

        <article className="portal-card">
          <div className="portal-card-head"><div><h2>Launch readiness</h2><p>Your current configuration path.</p></div></div>
          <div className="portal-progress">
            <div className="portal-progress-row"><span>Business profile</span><div><i style={{ width: "100%" }} /></div><strong>100%</strong></div>
            <div className="portal-progress-row"><span>Agent draft</span><div><i style={{ width: summary.agents.length ? "100%" : "20%" }} /></div><strong>{summary.agents.length ? "100%" : "20%"}</strong></div>
            <div className="portal-progress-row"><span>Integrations</span><div><i style={{ width: summary.onboarding?.existing_tools.length ? "55%" : "10%" }} /></div><strong>{summary.onboarding?.existing_tools.length ? "55%" : "10%"}</strong></div>
            <div className="portal-progress-row"><span>Testing</span><div><i style={{ width: summary.onboarding?.status === "testing" ? "65%" : summary.onboarding?.status === "live" ? "100%" : "10%" }} /></div><strong>{summary.onboarding?.status === "live" ? "100%" : summary.onboarding?.status === "testing" ? "65%" : "10%"}</strong></div>
          </div>
          <div className="portal-actions" style={{ marginTop: 20 }}><Link className="portal-button" href="/portal/agents">Review agents</Link><Link className="portal-button secondary" href="/portal/integrations">View integrations</Link></div>
        </article>
      </section>

      <PlanEntitlementsPanel planCode={wallet.planCode} />
    </main>
  );
}
