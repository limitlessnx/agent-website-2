import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Bot, CheckCircle2, Target, Users } from "@/components/admin/ServerIcons";
import TimeGreeting from "@/components/admin/TimeGreeting";
import styles from "./DashboardReferenceOverview.module.css";

type Notice = { title: string; detail: string; href: string; type: string };
type Agent = { id: string; name: string; role: string; status: string; note: string };

type Props = {
  totalLeads: number;
  newLeads: number;
  liveClients: number;
  attentionCount: number;
  systemHealth: string;
  notifications: Notice[];
  agents: Agent[];
};

function tone(status: string) {
  const value = status.toLowerCase();
  if (value === "active" || value === "live") return "live";
  if (value === "error" || value === "disabled") return "danger";
  if (value === "paused" || value === "attention") return "warning";
  return "idle";
}

export default function DashboardReferenceOverview({
  totalLeads,
  newLeads,
  liveClients,
  attentionCount,
  systemHealth,
  notifications,
  agents,
}: Props) {
  const healthy = systemHealth === "Operational";
  const metrics = [
    { label: "Leads", value: totalLeads, detail: `${newLeads} new`, icon: Target },
    { label: "Live clients", value: liveClients, detail: "Active workspaces", icon: Users },
    { label: "Needs attention", value: attentionCount, detail: attentionCount ? "Review required" : "Nothing urgent", icon: AlertTriangle },
    { label: "Platform", value: systemHealth, detail: healthy ? "Core checks healthy" : "Review system health", icon: CheckCircle2 },
  ];

  return (
    <section className={styles.shell} aria-label="Fluxknight command overview">
      <header className={styles.intro}>
        <div>
          <span className={styles.kicker}>COMMAND CENTER</span>
          <h1><TimeGreeting /></h1>
          <p>Here is what your AI workforce and business operations are doing right now.</p>
        </div>
        <span className={healthy ? styles.healthLive : styles.healthWarning}><i />{systemHealth}</span>
      </header>

      <div className={styles.metrics}>
        {metrics.map((metric) => (
          <article key={metric.label}>
            <div className={styles.metricTop}><span>{metric.label}</span><metric.icon size={16} /></div>
            <strong>{metric.value}</strong>
            <small>{metric.detail}</small>
          </article>
        ))}
      </div>

      <div className={styles.mainGrid}>
        <article className={styles.panel}>
          <header><div><span>NEEDS YOUR ATTENTION</span><h2>Priority queue</h2></div><Link href="/dashboard/activity">View all <ArrowUpRight size={13} /></Link></header>
          <div className={styles.attention}>
            {notifications.slice(0, 4).map((notice, index) => (
              <Link href={notice.href} key={`${notice.title}-${index}`}>
                <span className={styles.noticeIcon}><AlertTriangle size={14} /></span>
                <div><strong>{notice.title}</strong><small>{notice.detail}</small></div>
                <ArrowUpRight size={13} />
              </Link>
            ))}
            {!notifications.length ? <div className={styles.empty}><CheckCircle2 size={17} /><span>No current operating signal requires attention.</span></div> : null}
          </div>
        </article>

        <article className={styles.panel}>
          <header><div><span>YOUR AI TEAM</span><h2>AI workforce</h2></div><Link href="/dashboard/agents">Manage <ArrowUpRight size={13} /></Link></header>
          <div className={styles.agents}>
            {agents.slice(0, 4).map((agent) => (
              <Link href="/dashboard/agents" key={agent.id}>
                <span className={styles.agentIcon}><Bot size={16} /></span>
                <div><strong>{agent.name}</strong><small>{agent.role} · {agent.note}</small></div>
                <em className={styles[tone(agent.status)]}>{agent.status}</em>
              </Link>
            ))}
            {!agents.length ? <div className={styles.empty}><Bot size={17} /><span>No configured AI worker is visible in this view yet.</span></div> : null}
          </div>
        </article>
      </div>
    </section>
  );
}
