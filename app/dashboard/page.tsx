import Link from "next/link";
import {
  Activity, ArrowUpRight, Bell, Bot, Building2, Mail, Network, PhoneCall,
  Search, Users, Workflow,
} from "@/components/admin/ServerIcons";
import { getLeads, getN8nStatus, getSupabaseReadiness } from "@/lib/limitless-data";
import { listClientOnboardingProfiles } from "@/lib/client-workspace-onboarding";
import FluxknightLogo from "@/components/admin/FluxknightLogo";
import TimeGreeting from "@/components/admin/TimeGreeting";
import styles from "@/app/dashboard/DashboardExecutive.module.css";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [leads, clients, automationStatus, supabase] = await Promise.all([
    getLeads(500).catch(() => []),
    listClientOnboardingProfiles(100).catch(() => []),
    getN8nStatus().catch(() => ({ error: "Unavailable" })),
    getSupabaseReadiness().catch(() => ({ ready: false })),
  ]);

  const newLeads = leads.filter((lead) => String(lead.status || "").toLowerCase() === "new");
  const pendingClients = clients.filter((client) => !["live", "paused"].includes(client.status));
  const liveClients = clients.filter((client) => client.status === "live");
  const systemHealth = supabase.ready && !automationStatus.error ? "Operational" : "Attention";

  const notifications = [
    ...newLeads.slice(0, 3).map((lead) => ({
      title: "New Limitless Realty lead",
      detail: lead.name || lead.phone || "A new lead entered the CRM",
      href: "/dashboard/limitless/leads",
      type: "organization",
    })),
    ...pendingClients.slice(0, 3).map((client) => ({
      title: "Client workspace needs attention",
      detail: client.business_name || client.business_email || "New client organization",
      href: "/dashboard/clients",
      type: "platform",
    })),
  ].slice(0, 6);

  const operations = [
    { title: "Follow-up center", detail: "Sequences, reminders and enrolled contacts", href: "/dashboard/limitless/followups", icon: Workflow, status: "Manage" },
    { title: "Email automation", detail: "Sequences, replies and outbound delivery", href: "/dashboard/workflows/email", icon: Mail, status: "Manage" },
    { title: "Outbound calls", detail: "Qualification, call queues and appointment handoff", href: "/dashboard/workflows/calls", icon: PhoneCall, status: "Manage" },
    { title: "Lead sourcing", detail: "Prospect searches, saved lists and exports", href: "/dashboard/workflows/scraping", icon: Search, status: "Manage" },
  ];

  return (
    <main className={`${styles.page} admin-page`}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>Fluxknight Command Center</p>
          <h1><TimeGreeting />.</h1>
          <p className={styles.heroLead}>Manage organizations, customers, follow-ups and business automations from one operational layer.</p>
          <div className={styles.heroActions}>
            <Link href="/dashboard/notifications"><Bell size={15} /> View notifications</Link>
            <Link href="/dashboard/limitless/followups"><Workflow size={15} /> Follow-up center</Link>
            <Link href="/dashboard/clients"><Users size={15} /> Client organizations</Link>
          </div>
        </div>
        <div className={styles.automationVisual} aria-label="Fluxknight AI operations visual">
          <div className={styles.orbit} />
          <div className={`${styles.orbit} ${styles.orbitTwo}`} />
          <div className={styles.core}><FluxknightLogo /></div>
          <div className={`${styles.node} ${styles.nodeOne}`}><Bot size={14} /> Assistant</div>
          <div className={`${styles.node} ${styles.nodeTwo}`}><Workflow size={14} /> Operations</div>
          <div className={`${styles.node} ${styles.nodeThree}`}><Building2 size={14} /> Organizations</div>
        </div>
      </section>

      <section className={styles.metrics} aria-label="Platform overview cards">
        <article className={styles.metric}><div className={styles.metricTop}><span className={styles.metricIcon}><Building2 size={17} /></span><small>Admin organizations</small></div><strong>2</strong><p>Limitless Realty and Gencouv</p></article>
        <article className={styles.metric}><div className={styles.metricTop}><span className={styles.metricIcon}><Users size={17} /></span><small>Client organizations</small></div><strong>{clients.length}</strong><p>{liveClients.length} live · {pendingClients.length} need attention</p></article>
        <article className={styles.metric}><div className={styles.metricTop}><span className={styles.metricIcon}><Bell size={17} /></span><small>Attention queue</small></div><strong>{notifications.length}</strong><p>Platform and organization signals</p></article>
        <article className={styles.metric}><div className={styles.metricTop}><span className={styles.metricIcon}><Network size={17} /></span><small>Automation health</small></div><strong>{systemHealth}</strong><p>{systemHealth === "Operational" ? "All core services responding" : "One or more services need attention"}</p></article>
      </section>

      <section className={styles.grid}>
        <article className={styles.panel}>
          <header className={styles.panelHeader}><div><h2>Admin Notifications</h2><p>Only platform and owned-organization activity appears here.</p></div><Link href="/dashboard/notifications">View all <ArrowUpRight size={12} /></Link></header>
          <div className={styles.actionGrid}>
            {notifications.length ? notifications.map((notification, index) => (
              <Link key={`${notification.title}-${index}`} href={notification.href} className={styles.actionCard}>
                <span><Bell size={15} /></span><span><strong>{notification.title}</strong><small>{notification.detail}</small></span><em>{notification.type}</em>
              </Link>
            )) : <div className={styles.actionCard}><span><Activity size={15} /></span><span><strong>No new alerts</strong><small>The admin attention queue is clear.</small></span><em>Clear</em></div>}
          </div>
        </article>

        <article className={styles.panel}>
          <header className={styles.panelHeader}><div><h2>Business Automations</h2><p>Manage outcomes, schedules and customer actions without exposing backend workflows.</p></div></header>
          <div className={styles.actionGrid}>
            {operations.map((operation) => (
              <Link key={operation.title} href={operation.href} className={styles.actionCard}>
                <span><operation.icon size={15} /></span><span><strong>{operation.title}</strong><small>{operation.detail}</small></span><em>{operation.status}</em>
              </Link>
            ))}
          </div>
        </article>
      </section>

      <section className={styles.grid}>
        <article className={styles.panel}>
          <header className={styles.panelHeader}><div><h2>Admin Organizations</h2><p>Brands owned and operated directly by Fluxknight administration.</p></div><Link href="/dashboard/organizations">Open registry</Link></header>
          <div className={styles.actionGrid}>
            <Link href="/dashboard/limitless/leads" className={styles.actionCard}><span><Building2 size={15} /></span><span><strong>Limitless Realty</strong><small>{newLeads.length} new leads currently visible</small></span><em>Owned</em></Link>
            <Link href="/dashboard/gencouv" className={styles.actionCard}><span><Activity size={15} /></span><span><strong>Gencouv</strong><small>Trading onboarding and automation workspace</small></span><em>Owned</em></Link>
          </div>
        </article>

        <article className={styles.panel}>
          <header className={styles.panelHeader}><div><h2>Client Organizations</h2><p>Each client receives isolated notifications inside its own dashboard.</p></div><Link href="/dashboard/clients">Open clients</Link></header>
          <div className={styles.activity}>
            {clients.slice(0, 4).map((client) => <article key={client.id}><i /><div><strong>{client.business_name || "Unnamed client organization"}</strong><span>{client.status.replaceAll("_", " ")} · {client.business_email || "No email"}</span></div></article>)}
            {!clients.length ? <article><i /><div><strong>No client organizations yet</strong><span>New signups will appear in the client registry and receive their own isolated dashboard.</span></div></article> : null}
          </div>
        </article>
      </section>
    </main>
  );
}
