import Link from "next/link";
import { Activity, Bell, Bot, Building2, CheckCircle2, ChevronDown, CircleDot, MessageSquare, Network, Search, Settings, ShieldCheck, Target, Users, Workflow, Zap } from "@/components/admin/ServerIcons";
import { getLeads, getN8nStatus, getSupabaseReadiness } from "@/lib/limitless-data";
import { listClientOnboardingProfiles } from "@/lib/client-workspace-onboarding";
import styles from "@/app/dashboard/DashboardExecutive.module.css";

export const dynamic = "force-dynamic";

const nav = [
  ["Overview", "/dashboard", "▦"], ["Organizations", "/dashboard/organizations", "▥"], ["Leads", "/dashboard/limitless/leads", "♙"],
  ["Properties", "/dashboard/limitless/properties", "⌂"], ["Maia", "/dashboard/agent-operations", "◈"], ["Conversations", "/dashboard/limitless/conversations", "▢"],
  ["Automations", "/dashboard/workflows", "ϟ"], ["Analytics", "/dashboard/agent-operations", "▥"], ["Settings", "/dashboard/settings", "⚙"],
];

export default async function DashboardPage() {
  const [leads, clients, automationStatus, supabase] = await Promise.all([
    getLeads(500).catch(() => []), listClientOnboardingProfiles(100).catch(() => []), getN8nStatus().catch(() => ({ error: "Unavailable" })), getSupabaseReadiness().catch(() => ({ ready: false })),
  ]);
  const newLeads = leads.filter((lead) => String(lead.status || "").toLowerCase() === "new");
  const liveClients = clients.filter((client) => client.status === "live");
  const systemHealth = supabase.ready && !automationStatus.error;
  const readiness = systemHealth ? 100 : 86;
  const activity = [
    ...(newLeads.slice(0, 2).map((lead) => ({ title: "New lead received", detail: lead.name || lead.phone || "New CRM lead", time: "Recent", href: "/dashboard/limitless/leads", icon: Users }))),
    ...clients.slice(0, 1).map((client) => ({ title: "Client workspace updated", detail: client.business_name || "Organization", time: client.status.replaceAll("_", " "), href: "/dashboard/clients", icon: Building2 })),
  ];
  const activeGoals = 0;
  const totalGoals = 0;
  const completedGoals = 0;
  const runningGoals = 0;
  const failedGoals = 0;
  const successRate = systemHealth ? 100 : 0;

  return (
    <main className={`${styles.page} admin-page`}>
      <header className={styles.topbar}>
        <div className={styles.brand}><span className={styles.menuButton}>☰</span><span className={styles.brandMark}>♞</span><strong>Fluxknight</strong></div>
        <div className={styles.account}><span>FK</span><i /></div><Bell size={17} />
      </header>
      <div className={styles.searchBar}><Search size={17}/><span>Search organizations, leads, properties, users...</span><kbd>⌘ K</kbd></div>
      <nav className={styles.navRail} aria-label="Dashboard navigation">
        {nav.map(([label, href, icon]) => <Link className={label === "Overview" ? styles.activeNav : ""} href={href} key={label}><b>{icon}</b><span>{label}</span></Link>)}
      </nav>

      <section className={styles.maiaHero}>
        <div className={styles.maiaPortrait}><img src="/maia-robot.svg" alt="Maia robotic AI assistant" /></div>
        <div className={styles.maiaCopy}><div className={styles.eyebrow}>Limitless Realty · Maia <span className={styles.statusPill}><CircleDot size={8}/> Autonomous</span></div><h1>Agentic Intelligence</h1><p>Maia's operating brain, tools, memory, autonomous goals, property reasoning and WhatsApp route in one control surface.</p></div>
        <div className={styles.brainVisual} aria-hidden="true"><div className={styles.brainGlow}/><div className={styles.brainShape}><span/><span/><span/><span/><span/><span/><span/><span/></div></div>
      </section>

      <section className={styles.metrics}>
        <article className={styles.metric}><div className={styles.metricTop}><small>Autonomy</small><Zap size={18}/></div><strong className={styles.greenValue}>ON</strong><p>12 max steps</p></article>
        <article className={styles.metric}><div className={styles.metricTop}><small>Readiness</small><ShieldCheck size={18}/></div><strong>{readiness}%</strong><p>{systemHealth ? "All checks passed" : "Needs attention"}</p></article>
        <article className={styles.metric}><div className={styles.metricTop}><small>Runtime Sessions</small><MessageSquare size={18}/></div><strong>{activity.length}</strong><p>Recent sessions</p></article>
        <article className={styles.metric}><div className={styles.metricTop}><small>Active Goals</small><Target size={18}/></div><strong>{activeGoals}</strong><p className={styles.greenText}>{activeGoals ? "Running" : "No active goals"}</p></article>
      </section>

      <section className={styles.healthPanel}><header><div><Activity size={18}/><span>System Health</span></div><strong className={systemHealth ? styles.greenText : ""}>{systemHealth ? "All systems operational" : "Needs attention"} <i/></strong></header><div className={styles.healthGrid}><div><CheckCircle2 size={16}/><span><b>Scheduler</b><small>Every 5 min</small></span></div><div><CheckCircle2 size={16}/><span><b>Maia Gateway</b><small>Online</small></span></div><div><CheckCircle2 size={16}/><span><b>Autonomous</b><small>Online</small></span></div><div><CheckCircle2 size={16}/><span><b>Follow-ups</b><small>Online</small></span></div></div></section>

      <section className={styles.analyticsGrid}>
        <article className={styles.analyticsCard}><header><span>Goal Execution</span><button>7 days <ChevronDown size={12}/></button></header><div className={styles.goalChart}><div className={styles.donut}><strong>{totalGoals}</strong><small>Total</small></div><div className={styles.legend}><span><i className={styles.purple}/><b>Completed</b>{completedGoals}</span><span><i className={styles.green}/><b>Running</b>{runningGoals}</span><span><i className={styles.yellow}/><b>Failed</b>{failedGoals}</span></div></div></article>
        <article className={styles.analyticsCard}><header><span>Recent Activity</span><Link href="/dashboard/agent-operations">View all</Link></header><div className={styles.activityList}>{activity.length ? activity.map((item, index) => <Link href={item.href} key={`${item.title}-${index}`}><span className={styles.activityIcon}><item.icon size={14}/></span><span><b>{item.title}</b><small>{item.detail}</small></span><time>{item.time}</time></Link>) : <div className={styles.emptyState}>No recent activity recorded.</div>}</div></article>
        <article className={styles.analyticsCard}><header><span>Automation Usage</span><button>7 days <ChevronDown size={12}/></button></header><div className={styles.usage}><strong>{successRate}%</strong><small>Success rate</small><div className={styles.sparkline}><i/><i/><i/><i/><i/><i/><i/><i/><i/></div></div></article>
        <article className={styles.analyticsCard}><header><span>Maia Status</span><em className={styles.online}>Online</em></header><div className={styles.statusGrid}><div><small>Last run</small><b>Live</b></div><div><small>Next run</small><b>Every 5 min</b></div><div><small>Environment</small><b>Production</b></div><div><small>Version</small><b>Agentic</b></div></div></article>
      </section>

      <section className={styles.quickFooter}><Link href="/dashboard/agent-operations"><Bot size={16}/> Agent Operations</Link><Link href="/dashboard/limitless/followups"><Workflow size={16}/> Follow-ups</Link><Link href="/dashboard/workflows"><Network size={16}/> Automations</Link><Link href="/dashboard/settings"><Settings size={16}/> Settings</Link></section>
    </main>
  );
}
