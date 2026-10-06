/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart2,
  Bot,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  Image as ImageIcon,
  MessageSquareText,
  Play,
  Target,
  Users,
  WalletCards,
  Workflow,
} from "@/components/admin/ServerIcons";
import type { LimitlessDashboardData, OrganizationOperationalItem } from "@/lib/admin-organization-data";
import { formatNaira } from "@/lib/limitless-payments";
import styles from "./DashboardHomeExperience.module.css";

type Metric = { label: string; value: number | string; detail: string; icon: "leads" | "conversations" | "followups" | "qualified" | "revenue" };
type Notice = { title: string; detail: string; href: string; type: string };
type AgentMetric = { label: string; value: number | string };
type Agent = { name: string; role: string; channel: string; status: "live" | "attention" | "limited"; href: string; note: string; metrics: AgentMetric[] };

const icons = { leads: Users, conversations: MessageSquareText, followups: Workflow, qualified: Target, revenue: WalletCards };

function noticeTone(type: string) {
  const value = String(type || "").toLowerCase();
  if (value.includes("critical") || value.includes("error") || value.includes("fail")) return styles.critical;
  if (value.includes("attention") || value.includes("warn") || value.includes("pending")) return styles.warning;
  return styles.info;
}

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("en-NG", { hour: "2-digit", hour12: false, timeZone: "Africa/Lagos" }).format(new Date()));
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

function shortDate(value: string | null) {
  if (!value) return "No due date";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-NG", { month: "short", day: "numeric" }).format(parsed);
}

function isRecent(value?: string) {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && Date.now() - time < 30 * 24 * 60 * 60 * 1000;
}

function PropertyCard({ property }: { property: LimitlessDashboardData["properties"]["items"][number] }) {
  const status = String(property.status || "active").toLowerCase();
  const badge = property.featured ? "Featured" : isRecent(property.created_at) ? "New" : status === "sold" ? "Sold" : status === "inactive" || status === "draft" ? "Draft" : "Active";
  return (
    <Link href="/dashboard/limitless/properties" className={styles.propertyCard}>
      <div className={styles.propertyMedia}>
        {property.imageUrl ? <img src={property.imageUrl} alt={property.title} loading="lazy" /> : <div className={styles.propertyPlaceholder} aria-hidden="true"><Building2 size={26} /></div>}
        <span className={styles.propertyBadge}>{badge}</span>
      </div>
      <div className={styles.propertyBody}>
        <div className={styles.propertyTitleRow}><strong>{property.title}</strong><ChevronRight size={15} aria-hidden="true" /></div>
        <span className={styles.propertyLocation}>{[property.location_city, property.location_area].filter(Boolean).join(", ") || "Location not saved"}</span>
        <strong className={styles.propertyPrice}>{property.price || "Price pending"}</strong>
        <span className={styles.propertyType}>{property.type || "Property"}</span>
        <div className={styles.propertyMediaCounts}>
          <span><ImageIcon size={13} /> {property.imageCount} {property.imageCount === 1 ? "photo" : "photos"}</span>
          <span><Play size={13} /> {property.videoCount} {property.videoCount === 1 ? "video" : "videos"}</span>
        </div>
      </div>
    </Link>
  );
}

function LegacyOrganizationView({ metrics, notices, agents }: { metrics: Metric[]; notices: Notice[]; agents: Agent[] }) {
  return (
    <>
      <div className={styles.metrics} aria-label="Business metrics">
        {metrics.map((metric) => {
          const Icon = icons[metric.icon];
          return <article key={metric.label} className={styles.metricCard}><span className={styles.metricIcon}><Icon size={18} /></span><strong>{metric.value}</strong><span>{metric.label}</span><small>{metric.detail}</small></article>;
        })}
      </div>
      <section className={styles.attentionPanel}>
        <header><div><span className={styles.sectionKicker}>OPERATIONS</span><h2>Needs your attention</h2></div><b>{notices.length}</b></header>
        <div className={styles.noticeList}>
          {notices.slice(0, 4).map((notice, index) => <Link href={notice.href} key={notice.title + "-" + index} className={styles.notice}><span className={[styles.noticeIcon, noticeTone(notice.type)].join(" ")}><AlertTriangle size={16} /></span><div><strong>{notice.title}</strong><small>{notice.detail}</small></div><ChevronRight size={16} /></Link>)}
          {!notices.length ? <div className={styles.clearState}><CheckCircle2 size={18} /><div><strong>No urgent items</strong><span>Current operating signals do not require immediate review.</span></div></div> : null}
        </div>
      </section>
      <section className={styles.teamSection}>
        <header className={styles.sectionHeader}><div><span className={styles.sectionKicker}>AI WORKFORCE</span><h2>Your AI Team</h2></div><Link href="/dashboard/agents">View all agents <ChevronRight size={14} /></Link></header>
        <div className={styles.agentGrid}>
          {agents.map((agent) => <Link href={agent.href} className={styles.agentCard} key={agent.name}><div className={styles.agentHead}><span className={styles.avatar}><Bot size={20} /></span><div><div className={styles.agentTitle}><strong>{agent.name}</strong><span className={[styles.agentStatus, styles[agent.status]].join(" ")}><i />{agent.status}</span></div><p>{agent.role}</p><small>{agent.channel}</small></div><ChevronRight size={18} /></div><div className={styles.agentMetrics}>{agent.metrics.map((metric) => <div key={metric.label}><strong>{metric.value}</strong><span>{metric.label}</span></div>)}</div><p className={styles.agentNote}>{agent.note}</p></Link>)}
        </div>
      </section>
    </>
  );
}

export default function DashboardHomeExperience({
  name, workspaceName, health, metrics, notices, agents, activity, limitlessDashboard,
}: {
  name: string;
  workspaceName?: string;
  health: "Operational" | "Attention" | "Critical";
  metrics: Metric[];
  notices: Notice[];
  agents: Agent[];
  activity: OrganizationOperationalItem[];
  limitlessDashboard?: LimitlessDashboardData;
}) {
  const healthy = health === "Operational";
  const limitless = limitlessDashboard;
  const maia = agents.find((agent) => agent.name.toLowerCase() === "maia") || agents[0];
  const [revenuePeriod, setRevenuePeriod] = useState<"year" | "month">("year");
  const maxBar = Math.max(...(limitless?.financial.recentCollectionSeries || [0]), 1);

  return (
    <section className={styles.home} aria-label={(workspaceName || "Organization") + " dashboard overview"}>
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>{limitless ? "LIMITLESS REALTY · COMMAND CENTER" : workspaceName ? workspaceName.toUpperCase() + " · COMMAND CENTER" : "COMMAND CENTER"}</span>
          <h1>{greeting()}, {name} <span aria-hidden="true">👋</span></h1>
          <p>{healthy ? "Here’s what’s happening across your business today." : "Your workspace is active, with a few items that need your attention."}</p>
          <div className={styles.heroStatus}><span className={healthy ? styles.statusDot : styles.statusDotWarning} />{healthy ? "All systems active" : health}</div>
        </div>
        {maia ? <Link href={maia.href} className={styles.maiaCard}><span className={styles.maiaAvatar}><Bot size={20} /></span><span><strong>{maia.name}</strong><small>{limitless ? "Limitless Realty assistant · " : ""}{maia.status === "live" ? "Online" : maia.status}</small></span><ChevronRight size={18} /></Link> : null}
      </header>

      {limitless ? (
        <>
          <section className={styles.financeHero} aria-labelledby="finance-heading">
            <label className={styles.financePeriodSwitch}>
              <span>View</span>
              <select value={revenuePeriod} onChange={(event) => setRevenuePeriod(event.target.value as "year" | "month")} aria-label="Revenue period">
                <option value="year">Year</option>
                <option value="month">Month</option>
              </select>
            </label>
            <div className={styles.financeHeader}>
              <div><span className={styles.cardKicker}><WalletCards size={15} /> REVENUE COLLECTED</span><strong id="finance-heading">{formatNaira(revenuePeriod === "year" ? limitless.financial.yearCollected : limitless.financial.monthCollected)}</strong><span className={styles.financePeriod}>{revenuePeriod === "year" ? "This year" : "This month"}</span></div>
              <div className={styles.financeChart} aria-label="Last seven days of recorded collections">
                {limitless.financial.recentCollectionSeries.map((value, index) => <span key={index} style={{ height: Math.max(8, (value / maxBar) * 100) + "%" }} />)}
              </div>
            </div>
            <div className={styles.financeMeta}><span><ArrowUpRight size={15} /> {formatNaira(limitless.financial.todayCollected)} today</span><small>{formatNaira(limitless.financial.collected)} collected across recorded installment plans</small></div>
            <div className={styles.financeActions}>
              <Link href="/dashboard/limitless/payments"><CreditCard size={16} /><span>Record Payment</span></Link>
              <Link href="/dashboard/limitless/payments/installments"><CalendarDays size={16} /><span>View Installments</span></Link>
              <Link href="/dashboard/limitless/payments"><BarChart2 size={16} /><span>View Collections</span></Link>
            </div>
          </section>

          <section className={styles.kpiGrid} aria-label="Business KPIs">
            {metrics.filter((metric) => metric.icon !== "revenue").slice(0, 4).map((metric) => {
              const Icon = icons[metric.icon];
              const href = metric.icon === "conversations" ? "/dashboard/conversations" : "/dashboard/limitless/leads";
              return <Link href={href} key={metric.label} className={styles.kpiCard}><span className={styles.kpiIcon}><Icon size={16} /></span><strong>{metric.value}</strong><span>{metric.label}</span><small>{metric.detail}</small></Link>;
            })}
          </section>

          <section className={styles.sectionCard}>
            <header className={styles.sectionHeader}><div><span className={styles.sectionKicker}>LIMITLESS REALTY</span><h2>Property Catalog</h2><p>Your active property inventory</p></div><Link href="/dashboard/limitless/properties">View all <ChevronRight size={14} /></Link></header>
            <div className={styles.propertySummary}><span><b>{limitless.properties.active}</b> active</span><span><b>{limitless.properties.featured}</b> featured</span><span><b>{limitless.properties.sold}</b> sold</span><span><b>{limitless.properties.draft}</b> draft</span></div>
            <div className={styles.propertyCarousel}>{limitless.properties.items.map((property) => <PropertyCard property={property} key={property.id} />)}{!limitless.properties.items.length ? <div className={styles.emptyInline}>No properties are currently available in the catalog.</div> : null}</div>
          </section>

          <div className={styles.twoColumn}>
            <section className={styles.compactCard}>
              <header className={styles.sectionHeader}><div><span className={styles.sectionKicker}>COLLECTIONS</span><h2>Collection Performance</h2></div><span className={styles.periodLabel}>Recorded plans</span></header>
              <div className={styles.collectionBody}>
                <div className={styles.donut} style={{ background: `conic-gradient(var(--fk-success) ${Math.min(100, limitless.financial.collectionRate)}%, var(--fk-brand) 0)` }}><strong>{limitless.financial.collectionRate}%</strong><span>Collection rate</span></div>
                <div className={styles.collectionLegend}><span><i className={styles.greenDot} />Collected <b>{formatNaira(limitless.financial.collected)}</b></span><span><i className={styles.purpleDot} />Outstanding <b>{formatNaira(limitless.financial.outstanding)}</b></span><span><i className={styles.redDot} />Overdue <b>{formatNaira(limitless.financial.overdue)}</b></span></div>
              </div>
            </section>

            <section className={styles.compactCard}>
              <header className={styles.sectionHeader}><div><span className={styles.sectionKicker}>PAYMENTS</span><h2>Upcoming Payments</h2></div><Link href="/dashboard/limitless/payments/installments">View all <ChevronRight size={14} /></Link></header>
              <div className={styles.paymentList}>
                {limitless.upcomingPayments.map((payment) => <Link href="/dashboard/limitless/payments/installments" className={styles.paymentRow} key={payment.id}><span className={styles.paymentAvatar}><CircleDollarSign size={16} /></span><span className={styles.paymentCopy}><strong>{payment.clientName}</strong><small>{payment.propertyTitle} · {shortDate(payment.dueDate)}</small></span><b>{formatNaira(payment.amount)}</b><ChevronRight size={15} /></Link>)}
                {!limitless.upcomingPayments.length ? <div className={styles.emptyInline}>No upcoming installment payments are recorded.</div> : null}
              </div>
            </section>
          </div>

          <section className={styles.sectionCard}>
            <header className={styles.sectionHeader}><div><span className={styles.sectionKicker}>OPERATIONS</span><h2>Needs your attention</h2></div><b className={styles.countBadge}>{notices.length}</b></header>
            <div className={styles.noticeList}>
              {notices.slice(0, 4).map((notice, index) => <Link href={notice.href} key={notice.title + "-" + index} className={styles.notice}><span className={[styles.noticeIcon, noticeTone(notice.type)].join(" ")}><AlertTriangle size={15} /></span><div><strong>{notice.title}</strong><small>{notice.detail}</small></div><ChevronRight size={15} /></Link>)}
              {!notices.length ? <div className={styles.clearState}><CheckCircle2 size={18} /><div><strong>No urgent items</strong><span>Current operating signals do not require immediate review.</span></div></div> : null}
            </div>
          </section>

          <section className={styles.sectionCard}>
            <header className={styles.sectionHeader}><div><span className={styles.sectionKicker}>ACTIVITY</span><h2>Recent Activity</h2><p>Latest persisted business activity from this workspace.</p></div><Link href="/dashboard/activity">View all <ChevronRight size={14} /></Link></header>
            <div className={styles.activityList}>
              {activity.slice(0, 5).map((item) => <Link href={item.href} className={styles.activityRow} key={item.id}><span className={styles.activityIcon}><MessageSquareText size={15} /></span><span><strong>{item.title}</strong><small>{item.meta}</small></span><em>{item.label}</em></Link>)}
              {!activity.length ? <div className={styles.emptyInline}>No recent activity is available.</div> : null}
            </div>
          </section>
        </>
      ) : <LegacyOrganizationView metrics={metrics} notices={notices} agents={agents} />}
    </section>
  );
}
