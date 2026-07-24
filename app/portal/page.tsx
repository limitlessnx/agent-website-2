import { redirect } from "next/navigation";
import { Bot, Building2, CheckCircle2, ShieldCheck, Users, Workflow } from "lucide-react";
import { getClientSession } from "@/lib/client-auth";
import { ensureClientOnboardingProfile } from "@/lib/client-workspace-onboarding";
import ClientLogoutButton from "./ClientLogoutButton";

export const metadata = { title: "Client Portal | Fluxknight" };
export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  submitted: "Submitted for configuration",
  configuration: "Configuration in progress",
  testing: "Ready for testing",
  awaiting_approval: "Awaiting your approval",
  live: "Live",
  paused: "Paused",
};

export default async function ClientPortalPage() {
  const session = await getClientSession();
  if (!session) redirect("/account/login");

  const onboarding = await ensureClientOnboardingProfile({
    organizationId: session.organizationId,
    membershipId: session.membershipId,
    userId: session.userId,
    businessName: session.organizationSlug,
    email: session.email,
  });

  if (onboarding.status === "in_progress") redirect("/onboarding");

  return (
    <main className="admin-page" style={{ maxWidth: 1100, margin: "0 auto", padding: "110px 20px 60px" }}>
      <div className="admin-page-header">
        <div>
          <p className="admin-kicker">Client workspace</p>
          <h1>{onboarding.business_name || session.organizationSlug}</h1>
          <p>Signed in as {session.email}</p>
        </div>
        <ClientLogoutButton />
      </div>

      <section className="admin-stat-grid">
        <article className="admin-stat-card"><span><Building2 size={16} /> Organization</span><strong>Active</strong></article>
        <article className="admin-stat-card"><span><Users size={16} /> Membership</span><strong>{session.role}</strong></article>
        <article className="admin-stat-card"><span><Bot size={16} /> First agent</span><strong>Draft created</strong></article>
        <article className="admin-stat-card"><span><ShieldCheck size={16} /> Access</span><strong>Tenant scoped</strong></article>
      </section>

      <div className="admin-grid two">
        <section className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <h2>Workspace status</h2>
              <p>Your onboarding answers have been saved and your first AI employee draft has been generated.</p>
            </div>
            <span className="admin-status live">{statusLabels[onboarding.status] || onboarding.status}</span>
          </div>
          <div className="admin-checklist upgraded">
            <span><CheckCircle2 size={16} /> Business profile captured</span>
            <span><CheckCircle2 size={16} /> Requested agents and goals recorded</span>
            <span><CheckCircle2 size={16} /> Channels and tools mapped</span>
            <span><CheckCircle2 size={16} /> Human escalation contact configured</span>
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <h2>Next deployment stage</h2>
              <p>Fluxknight will review the draft, connect approved integrations, and prepare the system for testing.</p>
            </div>
          </div>
          <div className="admin-list">
            <div className="admin-list-row compact"><div><strong>Agent configuration</strong><span>Prompt, knowledge, channels, and permissions</span></div><em>next</em></div>
            <div className="admin-list-row compact"><div><strong>Workflow connection</strong><span>n8n, Supabase, voice, email, and CRM tools</span></div><em>pending</em></div>
            <div className="admin-list-row compact"><div><strong>Client testing</strong><span>Test conversations and human handoff checks</span></div><em>pending</em></div>
          </div>
        </section>
      </div>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h2><Workflow size={18} /> Selected system scope</h2>
            <p>{onboarding.requested_agents.join(", ").replaceAll("_", " ") || "No modules recorded"}</p>
          </div>
        </div>
      </section>
    </main>
  );
}
