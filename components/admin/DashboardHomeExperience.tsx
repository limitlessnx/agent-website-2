import Link from "next/link";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronRight,
  MessageSquareText,\n  Image,
  Target,
  Users,
  Workflow,
  WalletCards,
} from "@/components/admin/ServerIcons";
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

export default function DashboardHomeExperience({
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

  return (
    <section className={styles.home} aria-label={`${workspaceName || "Organization"} dashboard overview`}>
      <header className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>{workspaceName ? `${workspaceName.toUpperCase()} · COMMAND CENTER` : "COMMAND CENTER"}</span>
          <h1>Good afternoon, {name}</h1>
          <p>{healthy ? "Your AI workforce is operating smoothly." : "Your AI workforce is active, with a few items that need your attention."}</p>
        </div>
        <div className={[styles.health, healthy ? styles.healthy : health === "Critical" ? styles.criticalHealth : styles.attentionHealth].join(" ")}>
          <span />
          {healthy ? "All systems active" : health}
        </div>
      </header>

      <div className={styles.metrics} aria-label="Business metrics">
        {metrics.map((metric) => {
          const Icon = icons[metric.icon];
          return (
            <article key={metric.label} className={styles.metricCard}>
              <div className={styles.metricTop}>
                <span className={styles.metricIcon}><Icon size={18} /></span>
              </div>
              <strong>{metric.value}</strong>
              <span>{metric.label}</span>
              <small>{metric.detail}</small>
            </article>
          );
        })}
      </div>

      <section style={{ marginTop: 24 }}>
        <header className={styles.sectionHeader}>
          <div>
            <span className={styles.sectionKicker}>LIMITLESS REALTY</span>
            <h2>Property Operations</h2>
            <p>Manage the catalog, installment clients, and property media from the command center.</p>
          </div>
        </header>
        <div className={styles.agentGrid}>
          <Link href="/dashboard/limitless/properties" className={styles.agentCard}>
            <div className={styles.agentHead}>
              <span className={styles.avatar}><WalletCards size={20} /></span>
              <div><strong>Properties</strong><p>Property catalog</p><small>Listings, pricing, details and status</small></div>
              <ChevronRight size={18} aria-hidden="true" />
            </div>
            <p className={styles.agentNote}>Open the Limitless Realty property page to add, edit and manage listings.</p>
          </Link>
          <Link href="/dashboard/limitless/media" className={styles.agentCard}>
            <div className={styles.agentHead}>
              <span className={styles.avatar}><Image size={20} /></span>
              <div><strong>Property Media</strong><p>Pictures + videos</p><small>Upload and review customer-ready media</small></div>
              <ChevronRight size={18} aria-hidden="true" />
            </div>
            <p className={styles.agentNote}>Approved property media is registered for Maia's property-media workflow.</p>
          </Link>
          <Link href="/dashboard/limitless/payments/installments" className={styles.agentCard}>
            <div className={styles.agentHead}>
              <span className={styles.avatar}><WalletCards size={20} /></span>
              <div><strong>Installments</strong><p>Payment management</p><small>Balances, payments and reminder cadence</small></div>
              <ChevronRight size={18} aria-hidden="true" />
            </div>
            <p className={styles.agentNote}>Manage installment clients and payment reminders without leaving Limitless Realty.</p>
          </Link>
        </div>
      </section>

      <section className={styles.attentionPanel}>
        <header>
          <div>
            <span className={styles.sectionKicker}>OPERATIONS</span>
            <h2>Needs your attention</h2>
          </div>
          <b>{notices.length}</b>
        </header>
        <div className={styles.noticeList}>
          {notices.slice(0, 4).map((notice, index) => (
            <Link href={notice.href} key={notice.title + "-" + index} className={styles.notice}>
              <span className={[styles.noticeIcon, noticeTone(notice.type)].join(" ")}><AlertTriangle size={16} /></span>
              <div>
                <strong>{notice.title}</strong>
                <small>{notice.detail}</small>
              </div>
              <ChevronRight size={16} aria-hidden="true" />
            </Link>
          ))}
          {!notices.length ? (
            <div className={styles.clearState}>
              <CheckCircle2 size={18} />
              <div><strong>No urgent items</strong><span>Current operating signals do not require immediate review.</span></div>
            </div>
          ) : null}
        </div>
      </section>

      <section className={styles.teamSection}>
        <header className={styles.sectionHeader}>
          <div>
            <span className={styles.sectionKicker}>AI WORKFORCE</span>
            <h2>Your AI Team</h2>
            <p>See what each agent is doing and the results it is producing.</p>
          </div>
          <Link href="/dashboard/agents">View all agents <ChevronRight size={14} /></Link>
        </header>

        <div className={styles.agentGrid}>
          {agents.map((agent) => (
            <Link href={agent.href} className={styles.agentCard} key={agent.name}>
              <div className={styles.agentHead}>
                <span className={styles.avatar}><Bot size={20} /></span>
                <div>
                  <div className={styles.agentTitle}>
                    <strong>{agent.name}</strong>
                    <span className={[styles.agentStatus, styles[agent.status]].join(" ")}><i />{agent.status}</span>
                  </div>
                  <p>{agent.role}</p>
                  <small>{agent.channel}</small>
                </div>
                <ChevronRight size={18} aria-hidden="true" />
              </div>
              <div className={styles.agentMetrics}>
                {agent.metrics.map((metric) => (
                  <div key={metric.label}>
                    <strong>{metric.value}</strong>
                    <span>{metric.label}</span>
                  </div>
                ))}
              </div>
              <p className={styles.agentNote}>{agent.note}</p>
            </Link>
          ))}
        </div>
      </section>
    </section>
  );
}
