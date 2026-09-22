import { getLeads, getN8nStatus, getSupabaseReadiness } from "@/lib/limitless-data";
import { listClientOnboardingProfiles } from "@/lib/client-workspace-onboarding";
import { resolveLeoIdentity } from "@/lib/leo-core";
import { buildLeoBusinessCommandCenter, compactLeoBusinessCommandCenter } from "@/lib/leo-business-command-center";
import LeoOverview from "@/components/admin/LeoOverview";
import BusinessCommandCenterPanel from "@/components/admin/BusinessCommandCenterPanel";
import CommandCenterExpansion from "@/components/admin/CommandCenterExpansion";
import DashboardReferenceOverview from "@/components/admin/DashboardReferenceOverview";
import { getAgentManagementSummary } from "@/lib/agent-management";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [leads, clients, automationStatus, supabase, identity, agentSummary] = await Promise.all([
    getLeads(500).catch(() => []),
    listClientOnboardingProfiles(100).catch(() => []),
    getN8nStatus().catch(() => ({ error: "Unavailable" })),
    getSupabaseReadiness().catch(() => ({ ready: false })),
    resolveLeoIdentity({ channel: "chat", allowPublic: false }).catch(() => null),
    getAgentManagementSummary().catch(() => ({ configured: false, agents: [], projects: [], workflows: [], links: [] })),
  ]);

  const commandCenter = identity?.scope === "super_admin"
    ? await buildLeoBusinessCommandCenter({ identity }).then(compactLeoBusinessCommandCenter).catch(() => null)
    : null;
  const newLeads = leads.filter((lead) => String(lead.status || "").toLowerCase() === "new");
  const pendingClients = clients.filter((client) => !["live", "paused"].includes(client.status));
  const liveClients = clients.filter((client) => client.status === "live");
  const systemHealth = commandCenter ? (commandCenter.status === "healthy" ? "Operational" : commandCenter.status === "critical" ? "Critical" : "Attention") : supabase.ready && !automationStatus.error ? "Operational" : "Attention";
  const operationalNotices = (commandCenter?.priorityRisks || []).slice(0, 4).map((risk) => ({ title: risk.title, detail: risk.detail, href: "/dashboard/activity", type: risk.severity }));
  const notifications = [
    ...operationalNotices,
    ...newLeads.slice(0, 3).map((lead) => ({ title: "New Limitless Realty lead", detail: lead.name || lead.phone || "A new lead entered the CRM", href: "/dashboard/limitless/leads", type: "organization" })),
    ...pendingClients.slice(0, 3).map((client) => ({ title: "Client workspace needs attention", detail: client.business_name || client.business_email || "Client organization requires review", href: "/dashboard/clients", type: "platform" })),
  ].slice(0, 6);

  const topRecommendation = commandCenter?.recommendations?.[0];
  const leoSummary = commandCenter
    ? commandCenter.status === "healthy"
      ? "Leo sees no critical operating issue in the current evidence."
      : `${commandCenter.priorityRisks.length} operating signal${commandCenter.priorityRisks.length === 1 ? "" : "s"} currently need attention.`
    : "Leo does not have enough connected evidence to produce a complete operating brief.";

  const overviewAgents = agentSummary.agents.slice(0, 6).map((agent) => {
    const project = agentSummary.projects.find((item) => item.id === agent.project_id);
    const workflowCount = agentSummary.links.filter((link) => link.agent_id === agent.id).length;
    return {
      id: agent.id,
      name: agent.name,
      role: agent.description || agent.agent_type || "AI agent",
      status: agent.status || "draft",
      note: `${project?.name || "Workspace"} · ${workflowCount} workflow${workflowCount === 1 ? "" : "s"}`,
    };
  });

  return (
    <main className="admin-page dashboard-v3-home">
      <DashboardReferenceOverview
        totalLeads={leads.length}
        newLeads={newLeads.length}
        liveClients={liveClients.length}
        attentionCount={commandCenter ? commandCenter.priorityRisks.length : notifications.length}
        systemHealth={systemHealth}
        notifications={notifications}
        agents={overviewAgents}
      />
      <BusinessCommandCenterPanel snapshot={commandCenter} variant="dashboard" />
      <CommandCenterExpansion compact
        pulse={{
          leads: leads.length,
          conversations: null,
          conversions: null,
          activeClients: liveClients.length,
          aiResolutions: null,
          valueGenerated: null,
          creditsUsed: null,
        }}
        workforce={[
          {
            name: "Leo",
            role: "Operations intelligence",
            state: systemHealth === "Critical" || systemHealth === "Attention" ? "attention" : "active",
            note: identity ? "context connected" : "limited context",
          },
        ]}
        health={[
          { name: "Supabase", state: supabase.ready ? "operational" : "attention", note: supabase.ready ? "connected" : "readiness issue" },
          { name: "n8n", state: automationStatus.error ? "attention" : "operational", note: automationStatus.error ? "status unavailable" : "connected" },
          { name: "WhatsApp", state: "unknown", note: "not summarized on this view" },
          { name: "Email", state: "unknown", note: "not summarized on this view" },
          { name: "Voice", state: "unknown", note: "not summarized on this view" },
          { name: "Trigger.dev", state: "unknown", note: "not summarized on this view" },
          { name: "Payments", state: "unknown", note: "not summarized on this view" },
        ]}
        leo={{
          summary: leoSummary,
          recommendation: topRecommendation?.title || "Review the operating signals before taking action.",
          requiresApproval: topRecommendation?.requiresApproval ?? false,
        }}
      />
      <LeoOverview
        newLeads={newLeads.length}
        clients={clients.map((client) => ({ id: client.id, business_name: client.business_name, business_email: client.business_email, status: client.status }))}
        liveClients={liveClients.length}
        pendingClients={pendingClients.length}
        attentionCount={commandCenter ? commandCenter.priorityRisks.length : notifications.length}
        systemHealth={systemHealth}
        notifications={notifications}
      />
    </main>
  );
}
