import BusinessCommandCenterPanel from "@/components/admin/BusinessCommandCenterPanel";

export const dynamic = "force-static";

const snapshot = {
  generatedAt: new Date().toISOString(),
  status: "attention" as const,
  headline: "2 items need attention across your active workspaces.",
  metrics: {
    workspaces: 5,
    activeWorkspaces: 4,
    kpis: { total: 12, healthy: 8, attention: 3, critical: 1, insufficientData: 0 },
    risks: { matchedRules: 3, blockedRecommendations: 0, overdue: 1, dueSoon: 2, criticalEvents: 0, highEvents: 2 },
    optimizations: 3,
    businessModels: 3,
  },
  priorityRisks: [
    { key: "lead-response", severity: "high", title: "Lead response delay", detail: "Two new enquiries have been waiting longer than the target response window.", source: "crm" },
    { key: "whatsapp", severity: "medium", title: "WhatsApp delivery drift", detail: "Delivery reliability is below the recent baseline and should be reviewed.", source: "messaging" },
  ],
  upcoming: [
    { id: "1", title: "Review new property leads", type: "sales_follow_up", priority: "high", dueAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), timing: "1h", workspace: "Limitless Realty", organizationId: "limitless" },
    { id: "2", title: "Client onboarding review", type: "workspace_setup", priority: "medium", dueAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), timing: "4h", workspace: "Fluxknight", organizationId: "fluxknight" },
  ],
  recentEvents: [
    { id: "e1", type: "new_lead", severity: "info", occurredAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(), workspace: "Limitless Realty", organizationId: "limitless" },
    { id: "e2", type: "campaign_completed", severity: "low", occurredAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), workspace: "Gencouv", organizationId: "gencouv" },
  ],
  recommendations: [
    { title: "Prioritize the newest hot leads", detail: "Move the highest-intent leads to Maia's first follow-up queue.", source: "crm", requiresApproval: false },
    { title: "Review messaging delivery", detail: "Inspect recent failed WhatsApp delivery attempts before sending the next campaign.", source: "messaging", requiresApproval: true },
  ],
};

export default function DashboardPreviewPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#080b10", color: "#eef0f6", padding: "24px" }}>
      <div style={{ maxWidth: 1440, margin: "0 auto" }}>
        <div style={{ marginBottom: 16, color: "#8f97a5", fontSize: 12, fontWeight: 800, letterSpacing: ".12em" }}>DASHBOARD UI PREVIEW · MOCK DATA · NO LOGIN REQUIRED</div>
        <BusinessCommandCenterPanel snapshot={snapshot} />
      </div>
    </main>
  );
}
