import { getLeads, getN8nStatus, getSupabaseReadiness } from "@/lib/limitless-data";
import { listClientOnboardingProfiles } from "@/lib/client-workspace-onboarding";
import { resolveLeoIdentity } from "@/lib/leo-core";
import { buildLeoBusinessCommandCenter, compactLeoBusinessCommandCenter } from "@/lib/leo-business-command-center";
import DashboardHomeExperience from "@/components/admin/DashboardHomeExperience";

export const dynamic = "force-dynamic";

function normalized(value?: string) {
  return String(value || "").trim().toLowerCase();
}

export default async function DashboardPage() {
  const [leads, clients, automationStatus, supabase, identity] = await Promise.all([
    getLeads(500).catch(() => []),
    listClientOnboardingProfiles(100).catch(() => []),
    getN8nStatus().catch(() => ({ error: "Unavailable" })),
    getSupabaseReadiness().catch(() => ({ ready: false })),
    resolveLeoIdentity({ channel: "chat", allowPublic: false }).catch(() => null),
  ]);

  const commandCenter = identity?.scope === "super_admin"
    ? await buildLeoBusinessCommandCenter({ identity }).then(compactLeoBusinessCommandCenter).catch(() => null)
    : null;

  const newLeads = leads.filter((lead) => normalized(lead.status) === "new");
  const engagedLeads = leads.filter((lead) =>
    Boolean(lead.last_contacted_at) ||
    ["in_conversation", "contacted", "engaged", "qualified", "follow_up", "follow-up"].includes(normalized(lead.status))
  );
  const qualifiedLeads = leads.filter((lead) => {
    const score = normalized(lead.score);
    const status = normalized(lead.status);
    return ["hot", "high", "qualified", "ready"].includes(score) || status.includes("qualified");
  });
  const followUpLeads = leads.filter((lead) =>
    Boolean(lead.last_follow_up_at) ||
    Number(lead.follow_up_stage || 0) > 0 ||
    normalized(lead.status).includes("follow")
  );
  const inspectionLeads = leads.filter((lead) => {
    const status = normalized(lead.status);
    return status.includes("inspection") || status.includes("viewing") || status.includes("scheduled");
  });
  const handoffLeads = leads.filter((lead) => {
    const status = normalized(lead.status);
    return status.includes("handoff") || status.includes("human") || status.includes("escalat");
  });

  const pendingClients = clients.filter((client) => !["live", "paused"].includes(client.status));
  const liveClients = clients.filter((client) => client.status === "live");
  const systemHealth: "Operational" | "Attention" | "Critical" = commandCenter
    ? (commandCenter.status === "healthy" ? "Operational" : commandCenter.status === "critical" ? "Critical" : "Attention")
    : supabase.ready && !automationStatus.error ? "Operational" : "Attention";

  const operationalNotices = (commandCenter?.priorityRisks || []).slice(0, 4).map((risk) => ({
    title: risk.title,
    detail: risk.detail,
    href: "/dashboard/activity",
    type: risk.severity,
  }));

  const notifications = [
    ...operationalNotices,
    ...newLeads.slice(0, 2).map((lead) => ({
      title: "New Limitless Realty lead",
      detail: lead.name || lead.phone || "A new lead entered the CRM",
      href: "/dashboard/limitless/leads",
      type: "organization",
    })),
    ...pendingClients.slice(0, 2).map((client) => ({
      title: "Client workspace needs attention",
      detail: client.business_name || client.business_email || "Client organization requires review",
      href: "/dashboard/clients",
      type: "attention",
    })),
  ].slice(0, 5);

  return (
    <main className="admin-page dashboard-v3-home">
      <DashboardHomeExperience
        name="Limitless"
        health={systemHealth}
        metrics={[
          { label: "New leads", value: newLeads.length, detail: "Entered the CRM", icon: "leads" },
          { label: "Conversations", value: engagedLeads.length, detail: "Leads currently engaged", icon: "conversations" },
          { label: "Follow-ups", value: followUpLeads.length, detail: "Leads in follow-up", icon: "followups" },
          { label: "Qualified leads", value: qualifiedLeads.length, detail: "Ready for the next sales step", icon: "qualified" },
        ]}
        notices={notifications}
        agents={[
          {
            name: "Maia",
            role: "WhatsApp Sales Agent",
            channel: "WhatsApp · Limitless Realty",
            status: automationStatus.error ? ("attention" as const) : ("live" as const),
            href: "/dashboard/agents",
            note: handoffLeads.length + " human handoff" + (handoffLeads.length === 1 ? "" : "s") + " recorded in the current lead state.",
            metrics: [
              { label: "Conversations", value: engagedLeads.length },
              { label: "Qualified", value: qualifiedLeads.length },
              { label: "Follow-ups", value: followUpLeads.length },
              { label: "Inspections", value: inspectionLeads.length },
            ],
          },
          {
            name: "Leo",
            role: "Operations Intelligence",
            channel: "Platform operations",
            status: systemHealth === "Operational" ? ("live" as const) : ("attention" as const),
            href: "/dashboard/activity",
            note: commandCenter?.headline || "Monitoring connected operational evidence.",
            metrics: [
              { label: "Signals", value: commandCenter?.priorityRisks.length || 0 },
              { label: "Recommendations", value: commandCenter?.recommendations.length || 0 },
              { label: "Live clients", value: liveClients.length },
              { label: "Pending", value: pendingClients.length },
            ],
          },
        ]}
      />
    </main>
  );
}
