import Link from "next/link";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronRight,
  Image,
  MessageSquareText,
  Target,
  Users,
  Workflow,
  WalletCards,
} from "@/components/admin/ServerIcons";
import { getProperties } from "@/lib/limitless-data";
import styles from "./DashboardHomeExperience.module.css";

type Metric = {
  label: string;
  value: number | string;
  detail: string;
  icon: "leads" | "conversations" | "followups" | "qualified" | "revenue";
};

type Notice = {
  title: string;
  detail: string;
  href: string;
  type: string;
};

type AgentMetric = { label: string; value: number | string };

type Agent = {
  name: string;
  role: string;
  channel: string;
  status: "live" | "attention" | "limited";
  href: string;
  note: string;
  metrics: AgentMetric[];
};

const icons = {
  leads: Users,
  conversations: MessageSquareText,
  followups: Workflow,
  qualified: Target,
  revenue: WalletCards,
};

function noticeTone(type: string) {
  const value = String(type || "").toLowerCase();
  if (value.includes("critical") || value.includes("error") || value.includes("fail")) return styles.critical;
  if (value.includes("attention") || value.includes("warn") || value.includes("pending")) return styles.warning;
  return styles.info;
}

export default async function DashboardHomeExperience({
  name,
  workspaceName,
  health,
  metrics,
  notices,
  agents,
}: {
  name: string;
  workspaceName?: string;
  health: "Operational" | "Attention" | "Critical";
  metrics: Metric[];
  notices: Notice[];
  agents: Agent[];
}) {
  const healthy = health === "Operational";
  const properties = await getProperties(8);
  const revenue = metrics.find((metric) => metric.icon === "revenue");
  const operationalMetrics = metrics.filter((metric) => metric.icon !== "revenue");
  const activeProperties = properties.filter((property) => String(property.status || "active").toLowerCase() === "active").length;
  const soldProperties = properties.filter((property) => String(property.status || "").toLowerCase() === "sold").length;
  const draftProperties = properties.filter((property) => String(property.status || "").toLowerCase() === "draft").length;

  return (
    <section className={styles.home} aria-label={`${workspaceName || "Organization"} dashboard overview`}>
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.heroTopline}>
            <span className={styles.eyebrow}>{workspaceName ? `${workspaceName.toUpperCase()} · COMMAND CENTER` : "COMMAND CENTER"}</span>
            <div className={[styles.health, healthy ? styles.healthy : health === "Critical" ? styles.criticalHealth : styles.attentionHealth].join(" ")}><span />{healthy ? "All systems active" : health}</div>
          </div>
          <h1>Good afternoon, <span>{name}</span></h1>
          <p>{healthy ? "Your AI workforce, customers, properties and payments at a glance." : "Your AI workforce is active, with a few items that need your attention."}</p>
        </div>
        <div className={styles.heroMaia}><span className={styles.heroMaiaIcon}><Bot size={18} /></span><div><strong>Maia</strong><small>AI business partner</small></div><ChevronRight size={16} aria-hidden="true" /></div>
      </header>

      <section className={styles.financeHero} aria-label="Financial overview">
        <div className={styles.financeCopy}>
          <div className={styles.financeLabel}><span className={styles.metricIcon}><WalletCards size={18} /></span><span>Financial overview</span><span className={styles.period}>Current period</span></div>
          <strong>{revenue?.value ?? "—"}</strong><span>Revenue collected</span><small>{revenue?.detail || "Recorded payments across installment plans"}</small>
        </div>
        <div className={styles.financeVisual} aria-hidden="true"><span /><span /><span /><span /><span /><span /><span /><span /></div>
        <div className={styles.financeActions}>
          <Link href="/dashboard/limitless/payments/installments"><WalletCards size={16} /> Installments</Link>
          <Link href="/dashboard/limitless/payments"><ChevronRight size={16} /> Payments</Link>
          <Link href="/dashboard/limitless/properties"><Image size={16} /> Properties</Link>
        </div>
      </section>

      <section className={styles.metrics} aria-label="Business metrics">
        {operationalMetrics.map((metric) => {
          const Icon = icons[metric.icon];
          return <article key={metric.label} className={styles.metricCard}><div className={styles.metricTop}><span className={styles.metricIcon}><Icon size={17} /></span><span className={styles.metricTrend}>{metric.detail}</span></div><strong>{metric.value}</strong><span>{metric.label}</span></article>;
        })}
      </section>

      <section className={styles.propertyPanel} aria-labelledby="property-catalog-heading">
        <header className={styles.sectionHeader}>
          <div><span className={styles.sectionKicker}>LIMITLESS REALTY</span><h2 id="property-catalog-heading">Property Catalog</h2><p>Real inventory with property images and media access.</p></div>
          <Link href="/dashboard/limitless/properties">View all <ChevronRight size={14} /></Link>
        </header>
        <div className={styles.propertyStats}><span><strong>{properties.length}</strong> total</span><span><strong>{activeProperties}</strong> active</span><span><strong>{soldProperties}</strong> sold</span><span><strong>{draftProperties}</strong> draft</span></div>
        {properties.length ? (
          <div className={styles.propertyRail}>
            {properties.map((property) => (
              <Link href="/dashboard/limitless/properties" className={styles.propertyCard} key={property.id}>
                <div className={styles.propertyMedia}>
                  {property.drive_photos_link ? <img src={property.drive_photos_link} alt="" loading="lazy" /> : <div className={styles.propertyPlaceholder}><Image size={22} /></div>}
                  <span className={styles.propertyStatus}>{property.status || "active"}</span>
                  {property.drive_photos_link ? <span className={styles.mediaBadge}><Image size={12} /> Media ready</span> : null}
                </div>
                <div className={styles.propertyBody}><strong>{property.title}</strong><span>{[property.location_area, property.location_city].filter(Boolean).join(", ") || "Location not saved"}</span><b>{property.price || "Price pending"}</b><small>{property.type || "Property"} · Open catalog for photos & videos</small></div>
              </Link>
            ))}
          </div>
        ) : <div className={styles.propertyEmpty}><Image size={18} /><span>No property records yet. Add the first listing from the catalog.</span><Link href="/dashboard/limitless/properties">Open catalog</Link></div>}
      </section>

      <div className={styles.lowerGrid}>
        <section className={styles.attentionPanel}>
          <header><div><span className={styles.sectionKicker}>OPERATIONS</span><h2>Needs your attention</h2></div><b>{notices.length}</b></header>
          <div className={styles.noticeList}>
            {notices.slice(0, 4).map((notice, index) => <Link href={notice.href} key={notice.title + "-" + index} className={styles.notice}><span className={[styles.noticeIcon, noticeTone(notice.type)].join(" ")}><AlertTriangle size={15} /></span><div><strong>{notice.title}</strong><small>{notice.detail}</small></div><ChevronRight size={16} aria-hidden="true" /></Link>)}
            {!notices.length ? <div className={styles.clearState}><CheckCircle2 size={18} /><div><strong>No urgent items</strong><span>Current operating signals do not require immediate review.</span></div></div> : null}
          </div>
        </section>

        <section className={styles.quickPanel}>
          <header className={styles.sectionHeader}><div><span className={styles.sectionKicker}>REALTY OPERATIONS</span><h2>Property tools</h2></div></header>
          <div className={styles.quickGrid}>
            <Link href="/dashboard/limitless/properties"><WalletCards size={17} /><span><strong>Properties</strong><small>Catalog & pricing</small></span><ChevronRight size={15} /></Link>
            <Link href="/dashboard/limitless/media"><Image size={17} /><span><strong>Property media</strong><small>Photos & videos</small></span><ChevronRight size={15} /></Link>
            <Link href="/dashboard/limitless/payments/installments"><WalletCards size={17} /><span><strong>Installments</strong><small>Clients & reminders</small></span><ChevronRight size={15} /></Link>
            <Link href="/dashboard/limitless/leads"><Target size={17} /><span><strong>Leads</strong><small>Property prospects</small></span><ChevronRight size={15} /></Link>
          </div>
        </section>
      </div>

      <section className={styles.teamSection}>
        <header className={styles.sectionHeader}><div><span className={styles.sectionKicker}>AI WORKFORCE</span><h2>Your AI Team</h2><p>See what each agent is doing and the results it is producing.</p></div><Link href="/dashboard/agents">View all agents <ChevronRight size={14} /></Link></header>
        <div className={styles.agentGrid}>
          {agents.map((agent) => <Link href={agent.href} className={styles.agentCard} key={agent.name}><div className={styles.agentHead}><span className={styles.avatar}><Bot size={19} /></span><div><div className={styles.agentTitle}><strong>{agent.name}</strong><span className={[styles.agentStatus, styles[agent.status]].join(" ")}><i />{agent.status}</span></div><p>{agent.role}</p><small>{agent.channel}</small></div><ChevronRight size={17} aria-hidden="true" /></div><div className={styles.agentMetrics}>{agent.metrics.map((metric) => <div key={metric.label}><strong>{metric.value}</strong><span>{metric.label}</span></div>)}</div><p className={styles.agentNote}>{agent.note}</p></Link>)}
        </div>
      </section>
    </section>
  );
}
