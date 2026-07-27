import {
  Activity,
  ArrowUpRight,
  Bot,
  Building2,
  Database,
  Image,
  MessageCircle,
  Network,
  Users,
} from "lucide-react";
import {
  getLeads,
  getN8nStatus,
  getProperties,
  getSupabaseReadiness,
} from "@/lib/limitless-data";
import FluxknightLogo from "@/components/admin/FluxknightLogo";
import TimeGreeting from "@/components/admin/TimeGreeting";
import styles from "@/app/dashboard/DashboardExecutive.module.css";

const inactiveLeadStatuses = ["cold", "closed", "converted", "lost"];

export default async function DashboardPage() {
  const [leads, properties, n8n, supabase] = await Promise.all([
    getLeads(500),
    getProperties(500),
    getN8nStatus(),
    getSupabaseReadiness(),
  ]);

  const liveLeads = leads.filter((lead) => !inactiveLeadStatuses.includes(String(lead.status || "").toLowerCase()));
  const hotLeads = leads.filter((lead) => ["hot", "qualified"].includes(String(lead.score || lead.status || "").toLowerCase())).length;
  const warmLeads = leads.filter((lead) => String(lead.score || "").toLowerCase() === "warm").length;
  const newLeads = leads.filter((lead) => String(lead.status || "").toLowerCase() === "new").length;
  const activeProperties = properties.filter((property) => String(property.status || "active").toLowerCase() === "active").length;
  const missingMedia = properties.filter((property) => !property.drive_photos_link).length;
  const followUps = liveLeads.filter((lead) => Number(lead.follow_up_stage || 0) < 4).length;
  const systemHealth = Math.max(
    0,
    100 - (!supabase.ready ? 28 : 0) - (n8n.error ? 22 : 0) - (missingMedia ? 8 : 0),
  );

  const pipeline = [
    { label: "New", value: newLeads },
    { label: "Warm", value: warmLeads },
    { label: "Qualified", value: hotLeads },
    { label: "Follow-up", value: followUps },
  ];
  const pipelineMax = Math.max(1, ...pipeline.map((item) => item.value));

  const priorities = [
    {
      label: "Review active leads",
      detail: `${liveLeads.length} leads currently require sales attention`,
      href: "/dashboard/limitless/leads",
      icon: Users,
      value: liveLeads.length,
    },
    {
      label: "Complete scheduled follow-ups",
      detail: `${followUps} leads remain in the follow-up sequence`,
      href: "/dashboard/limitless/followups",
      icon: MessageCircle,
      value: followUps,
    },
    {
      label: missingMedia ? "Complete property media" : "Property media is complete",
      detail: missingMedia ? `${missingMedia} properties still need image links` : "All visible property records have media",
      href: "/dashboard/limitless/media",
      icon: Image,
      value: missingMedia || "Clear",
    },
    {
      label: supabase.ready ? "Workspace data is operational" : "Workspace data needs attention",
      detail: supabase.ready ? "Limitless Realty records are connected" : "Database configuration requires review",
      href: "/dashboard/settings",
      icon: Database,
      value: supabase.ready ? "Live" : "Check",
    },
  ];

  return (
    <main className={`${styles.page} admin-page`}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>Limitless Realty Workspace</p>
          <h1><TimeGreeting />.</h1>
          <p className={styles.heroLead}>
            Welcome back. You have <strong>{liveLeads.length} active leads</strong>, <strong>{followUps} pending follow-ups</strong> and <strong>{activeProperties} available properties</strong> in the workspace.
          </p>
          <div className={styles.heroActions}>
            <a href="/dashboard/limitless/leads"><Users size={15} /> Open leads</a>
            <a href="/dashboard/limitless/properties"><Building2 size={15} /> View properties</a>
            <a href="/dashboard/limitless/followups"><MessageCircle size={15} /> Review follow-ups</a>
          </div>
        </div>

        <div className={styles.automationVisual} aria-label="Limitless Realty AI operations visual">
          <div className={styles.orbit} />
          <div className={`${styles.orbit} ${styles.orbitTwo}`} />
          <div className={styles.core}><FluxknightLogo /></div>
          <div className={`${styles.node} ${styles.nodeOne}`}><Bot size={14} /> Maia</div>
          <div className={`${styles.node} ${styles.nodeTwo}`}><Building2 size={14} /> Properties</div>
          <div className={`${styles.node} ${styles.nodeThree}`}><Users size={14} /> CRM</div>
        </div>
      </section>

      <section className={styles.metrics} aria-label="Limitless Realty overview cards">
        <article className={styles.metric}>
          <div className={styles.metricTop}><span className={styles.metricIcon}><Users size={17} /></span><small>Active leads</small></div>
          <strong>{liveLeads.length.toLocaleString("en-NG")}</strong>
          <p>{hotLeads} hot or qualified leads</p>
        </article>
        <article className={styles.metric}>
          <div className={styles.metricTop}><span className={styles.metricIcon}><Building2 size={17} /></span><small>Available properties</small></div>
          <strong>{activeProperties.toLocaleString("en-NG")}</strong>
          <p>{missingMedia} records still need media</p>
        </article>
        <article className={styles.metric}>
          <div className={styles.metricTop}><span className={styles.metricIcon}><MessageCircle size={17} /></span><small>Pending follow-ups</small></div>
          <strong>{followUps.toLocaleString("en-NG")}</strong>
          <p>Active leads still in sequence</p>
        </article>
        <article className={styles.metric}>
          <div className={styles.metricTop}><span className={styles.metricIcon}><Network size={17} /></span><small>Workspace health</small></div>
          <strong>{systemHealth}%</strong>
          <p>{n8n.error ? "Automation connection needs attention" : "Core services are connected"}</p>
        </article>
      </section>

      <section className={styles.grid}>
        <article className={styles.panel}>
          <header className={styles.panelHeader}>
            <div><h2>Today&apos;s Priorities</h2><p>The items currently needing attention in Limitless Realty.</p></div>
            <a href="/dashboard/activity">View activity <ArrowUpRight size={12} /></a>
          </header>
          <div className={styles.actionGrid}>
            {priorities.map((priority) => (
              <a key={priority.label} href={priority.href} className={styles.actionCard}>
                <span><priority.icon size={15} /></span>
                <span><strong>{priority.label}</strong><small>{priority.detail}</small></span>
                <em>{priority.value}</em>
              </a>
            ))}
          </div>
        </article>

        <article className={styles.panel}>
          <header className={styles.panelHeader}>
            <div><h2>Lead Pipeline</h2><p>Current sales movement</p></div>
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
            <div><h2>Quick Access</h2><p>Core Limitless Realty tools, minus the usual dashboard clutter humans apparently crave.</p></div>
          </header>
          <div className={styles.actionGrid}>
            <a href="/dashboard/limitless/leads" className={styles.actionCard}>
              <span><Users size={15} /></span><span><strong>Lead management</strong><small>Review and update active opportunities</small></span><em>Open</em>
            </a>
            <a href="/dashboard/limitless/properties" className={styles.actionCard}>
              <span><Building2 size={15} /></span><span><strong>Property registry</strong><small>Manage available property records</small></span><em>Open</em>
            </a>
            <a href="/dashboard/limitless/followups" className={styles.actionCard}>
              <span><MessageCircle size={15} /></span><span><strong>Follow-up center</strong><small>Continue pending lead conversations</small></span><em>Open</em>
            </a>
            <a href="/dashboard/limitless/media" className={styles.actionCard}>
              <span><Image size={15} /></span><span><strong>Knowledge and media</strong><small>Maintain Maia&apos;s property information</small></span><em>Open</em>
            </a>
          </div>
        </article>

        <article className={styles.panel}>
          <header className={styles.panelHeader}>
            <div><h2>Recent Workspace Status</h2><p>Latest operational signals</p></div>
            <Activity size={16} />
          </header>
          <div className={styles.activity}>
            <article><i /><div><strong>Maia is available</strong><span>The Limitless Realty assistant remains connected to the workspace.</span></div></article>
            <article><i className={missingMedia ? styles.warning : ""} /><div><strong>Property knowledge readiness</strong><span>{missingMedia ? `${missingMedia} property records need media cleanup.` : "Property media coverage is healthy."}</span></div></article>
            <article><i className={!supabase.ready ? styles.warning : ""} /><div><strong>Workspace data</strong><span>Supabase is {supabase.ready ? "ready and connected" : "not fully configured"}.</span></div></article>
            <article><i className={n8n.error ? styles.warning : ""} /><div><strong>Automation connection</strong><span>n8n is {n8n.error ? "reporting a connection issue" : "connected and available"}.</span></div></article>
          </div>
        </article>
      </section>
    </main>
  );
}
