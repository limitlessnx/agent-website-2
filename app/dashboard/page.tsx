import {
  Activity,
  ArrowUpRight,
  Bot,
  Building2,
  Database,
  Megaphone,
  Network,
  Send,
  ShieldCheck,
  Users,
  Workflow,
} from "lucide-react";
import {
  getCampaignReports,
  getLeads,
  getN8nStatus,
  getProperties,
  getSupabaseReadiness,
} from "@/lib/limitless-data";
import FluxknightLogo from "@/components/admin/FluxknightLogo";
import styles from "@/app/dashboard/DashboardExecutive.module.css";

const inactiveLeadStatuses = ["cold", "closed", "converted"];

export default async function DashboardPage() {
  const [leads, properties, campaigns, n8n, supabase] = await Promise.all([
    getLeads(500),
    getProperties(500),
    getCampaignReports(50),
    getN8nStatus(),
    getSupabaseReadiness(),
  ]);

  const liveLeads = leads.filter((lead) => !inactiveLeadStatuses.includes(String(lead.status || "").toLowerCase()));
  const hotLeads = leads.filter((lead) => ["hot", "qualified"].includes(String(lead.score || lead.status || "").toLowerCase())).length;
  const warmLeads = leads.filter((lead) => String(lead.score || "").toLowerCase() === "warm").length;
  const newLeads = leads.filter((lead) => String(lead.status || "").toLowerCase() === "new").length;
  const activeProperties = properties.filter((property) => String(property.status || "active").toLowerCase() === "active").length;
  const missingMedia = properties.filter((property) => !property.drive_photos_link).length;
  const campaignSent = campaigns.reduce((total, campaign) => total + Number(campaign.accepted || 0), 0);
  const campaignFailed = campaigns.reduce((total, campaign) => total + Number(campaign.failed || 0), 0);
  const followUps = liveLeads.filter((lead) => Number(lead.follow_up_stage || 0) < 4).length;
  const systemHealth = Math.max(
    0,
    100 - (!supabase.ready ? 22 : 0) - (n8n.error ? 18 : 0) - (missingMedia ? 10 : 0) - (campaignFailed ? 8 : 0),
  );
  const pipeline = [
    { label: "New", value: newLeads },
    { label: "Warm", value: warmLeads },
    { label: "Hot", value: hotLeads },
    { label: "Follow-up", value: followUps },
  ];
  const pipelineMax = Math.max(1, ...pipeline.map((item) => item.value));

  const actions = [
    {
      label: missingMedia ? "Complete property media" : "Property media healthy",
      detail: missingMedia ? `${missingMedia} properties need image links` : "All visible records have media",
      href: "/dashboard/limitless/media",
      icon: Building2,
      value: missingMedia || "Clear",
    },
    {
      label: campaignFailed ? "Review failed campaign sends" : "Campaign delivery healthy",
      detail: campaignFailed ? `${campaignFailed} immediate failures recorded` : `${campaignSent} accepted by WhatsApp`,
      href: "/dashboard/limitless/campaigns",
      icon: Megaphone,
      value: campaignFailed || campaignSent,
    },
    {
      label: "Review active follow-ups",
      detail: `${followUps} leads remain in sequence`,
      href: "/dashboard/limitless/followups",
      icon: Users,
      value: followUps,
    },
    {
      label: supabase.ready ? "Data services operational" : "Repair data services",
      detail: supabase.ready ? "Supabase readiness checks passed" : "Database configuration needs attention",
      href: "/dashboard/settings",
      icon: Database,
      value: supabase.ready ? "Live" : "Action",
    },
  ];

  return (
    <main className={`${styles.page} admin-page`}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>Multi-Organization AI Operations</p>
          <h1>Operate agents, workflows and revenue from <span>one control plane.</span></h1>
          <p>
            Fluxknight coordinates organization data, Maia&apos;s WhatsApp operations, campaign delivery,
            automation health and executive performance without flattening every business into one chaotic menu.
          </p>
          <div className={styles.heroActions}>
            <a href="/dashboard/clients"><Building2 size={15} /> Manage organizations</a>
            <a href="/dashboard/agents"><Bot size={15} /> Open agent registry</a>
            <a href="/dashboard/workflows"><Workflow size={15} /> Open workflows</a>
          </div>
        </div>
        <div className={styles.automationVisual} aria-label="Fluxknight AI automation network visual">
          <div className={styles.orbit} />
          <div className={`${styles.orbit} ${styles.orbitTwo}`} />
          <div className={styles.core}><FluxknightLogo width={78} height={78} /></div>
          <div className={`${styles.node} ${styles.nodeOne}`}><Bot size={14} /> Maia</div>
          <div className={`${styles.node} ${styles.nodeTwo}`}><Network size={14} /> n8n</div>
          <div className={`${styles.node} ${styles.nodeThree}`}><Database size={14} /> Supabase</div>
        </div>
      </section>

      <section className={styles.metrics} aria-label="Executive KPI cards">
        <article className={styles.metric}>
          <div className={styles.metricTop}><span className={styles.metricIcon}><Users size={17} /></span><small>CRM</small></div>
          <strong>{leads.length.toLocaleString("en-NG")}</strong>
          <p>{hotLeads} hot or qualified leads</p>
        </article>
        <article className={styles.metric}>
          <div className={styles.metricTop}><span className={styles.metricIcon}><Building2 size={17} /></span><small>Catalog</small></div>
          <strong>{activeProperties.toLocaleString("en-NG")}</strong>
          <p>{missingMedia} missing media records</p>
        </article>
        <article className={styles.metric}>
          <div className={styles.metricTop}><span className={styles.metricIcon}><Send size={17} /></span><small>Messaging</small></div>
          <strong>{campaignSent.toLocaleString("en-NG")}</strong>
          <p>{campaignFailed} immediate campaign failures</p>
        </article>
        <article className={styles.metric}>
          <div className={styles.metricTop}><span className={styles.metricIcon}><ShieldCheck size={17} /></span><small>Platform health</small></div>
          <strong>{systemHealth}%</strong>
          <p>{n8n.activeWorkflows} active workflows visible</p>
        </article>
      </section>

      <section className={styles.grid}>
        <article className={styles.panel}>
          <header className={styles.panelHeader}>
            <div><h2>Organization Action Center</h2><p>Compact operational actions replacing verbose status walls.</p></div>
            <a href="/dashboard/activity">View activity <ArrowUpRight size={12} /></a>
          </header>
          <div className={styles.actionGrid}>
            {actions.map((action) => (
              <a key={action.label} href={action.href} className={styles.actionCard}>
                <span><action.icon size={15} /></span>
                <span><strong>{action.label}</strong><small>{action.detail}</small></span>
                <em>{action.value}</em>
              </a>
            ))}
          </div>
        </article>

        <article className={styles.panel}>
          <header className={styles.panelHeader}>
            <div><h2>Lead Pipeline</h2><p>Limitless Realty workspace</p></div>
            <a href="/dashboard/limitless/leads">Open CRM</a>
          </header>
          <div className={styles.pipeline}>
            {pipeline.map((item) => (
              <div className={styles.pipelineRow} key={item.label}>
                <span>{item.label}</span>
                <div className={styles.bar}><i style={{ width: `${Math.max(5, Math.round((item.value / pipelineMax) * 100))}%` }} /></div>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className={styles.grid}>
        <article className={styles.panel}>
          <header className={styles.panelHeader}>
            <div><h2>AI Operations Registry</h2><p>Grouped agents and workflow infrastructure.</p></div>
            <a href="/dashboard/automations">Control center</a>
          </header>
          <div className={styles.actionGrid}>
            <a href="/dashboard/agents" className={styles.actionCard}>
              <span><Bot size={15} /></span><span><strong>Customer-facing agents</strong><small>Maia and organization agent configurations</small></span><em>Open</em>
            </a>
            <a href="/dashboard/workflows" className={styles.actionCard}>
              <span><Workflow size={15} /></span><span><strong>Workflow registry</strong><small>{n8n.workflows.length} workflows visible from n8n</small></span><em>{n8n.activeWorkflows}</em>
            </a>
            <a href="/dashboard/clients" className={styles.actionCard}>
              <span><Building2 size={15} /></span><span><strong>Organization provisioning</strong><small>Create and manage client workspaces</small></span><em>Manage</em>
            </a>
            <a href="/dashboard/settings" className={styles.actionCard}>
              <span><Database size={15} /></span><span><strong>Connections and governance</strong><small>Supabase, n8n and platform readiness</small></span><em>{supabase.ready ? "Live" : "Check"}</em>
            </a>
          </div>
        </article>

        <article className={styles.panel}>
          <header className={styles.panelHeader}>
            <div><h2>Unified Activity</h2><p>Latest platform signals</p></div>
            <Activity size={16} />
          </header>
          <div className={styles.activity}>
            <article><i /><div><strong>Maia WhatsApp operations connected</strong><span>Canonical action workflow available for dashboard sends.</span></div></article>
            <article><i className={missingMedia ? styles.warning : ""} /><div><strong>Property knowledge readiness</strong><span>{missingMedia ? `${missingMedia} property records need media cleanup.` : "Property media coverage is healthy."}</span></div></article>
            <article><i className={campaignFailed ? styles.danger : ""} /><div><strong>Campaign delivery state</strong><span>{campaignFailed ? `${campaignFailed} failures require review.` : "No immediate failure found in the visible reports."}</span></div></article>
            <article><i className={!supabase.ready || n8n.error ? styles.warning : ""} /><div><strong>Infrastructure health</strong><span>Supabase {supabase.ready ? "ready" : "needs attention"}; n8n {n8n.error ? "needs attention" : "connected"}.</span></div></article>
          </div>
        </article>
      </section>
    </main>
  );
}
