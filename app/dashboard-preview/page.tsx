import BusinessCommandCenterPanel from "@/components/admin/BusinessCommandCenterPanel";
import styles from "./preview.module.css";

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

const navGroups = [
  { label: "Overview", items: ["Command Center"] },
  { label: "Operations", items: ["Lifecycle Control", "Customer Lifecycle", "Automations", "Agents", "Social", "Activity"] },
  { label: "Customers", items: ["Customer Health", "Retention", "Growth", "Usage & Value", "Evaluation Leads"] },
  { label: "Workspaces", items: ["Limitless Realty", "Gencouv", "Client Workspaces", "Add Workspace"] },
  { label: "Platform", items: ["Billing & Credits", "Knowledge", "AI Models", "Memory", "Settings"] },
];

export default function DashboardPreviewPage() {
  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <div className={styles.mark}>FX</div>
          <div className={styles.brandCopy}><strong>Fluxknight</strong><span>Operations OS</span></div>
        </div>
        <div className={styles.previewChip}>Preview · Mock data</div>
      </header>

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <button className={styles.workspaceCard} type="button">
            <span className={styles.workspaceMark}>F</span>
            <span><small>Current workspace</small><strong>Fluxknight</strong></span>
            <b>⌄</b>
          </button>

          {navGroups.map((group) => <div key={group.label} className={styles.navGroup}>
            <span className={styles.sectionLabel}>{group.label}</span>
            <nav className={styles.nav}>
              {group.items.map((item) => {
                const active = item === "Command Center";
                return <a key={item} href="#" className={active ? styles.navItemActive : styles.navItem}><span>{item}</span>{active && <b />}</a>;
              })}
            </nav>
          </div>)}
        </aside>

        <section className={styles.content}>
          <div className={styles.hero}>
            <div className={styles.heroCopy}>
              <span>Fluxknight workspace</span>
              <h1>Command Center</h1>
              <p>See what is happening, what needs attention, what changed, and what should happen next across your businesses and client workspaces.</p>
            </div>
            <div className={styles.state}><i /> Needs attention</div>
          </div>

          <BusinessCommandCenterPanel snapshot={snapshot} />
        </section>
      </div>

      <nav className={styles.mobileNav} aria-label="Preview mobile navigation">
        <span className={styles.active}>Home</span><span>Workspaces</span><span>Agents</span><span>Activity</span><span>Menu</span>
      </nav>
    </main>
  );
}
