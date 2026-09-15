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

const primaryNav = ["Command Center", "CRM", "Conversations", "Automations", "Agents", "Social", "Activity"];
const workspaceNav = ["Limitless Realty", "Gencouv", "Clients"];
const platformNav = ["Billing & Usage", "Knowledge", "AI Models", "Integrations", "Settings"];

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
          <span className={styles.sectionLabel}>Overview</span>
          <nav className={styles.nav}>
            {primaryNav.map((item, index) => <a key={item} href="#" className={index === 0 ? styles.navItemActive : styles.navItem}><span>{item}</span>{index === 0 && <b />}</a>)}
          </nav>
          <span className={styles.sectionLabel}>Workspaces</span>
          <nav className={styles.nav}>{workspaceNav.map((item) => <a key={item} href="#" className={styles.navItem}>{item}</a>)}</nav>
          <span className={styles.sectionLabel}>Platform</span>
          <nav className={styles.nav}>{platformNav.map((item) => <a key={item} href="#" className={styles.navItem}>{item}</a>)}</nav>
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
