"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Activity, AlertTriangle, ArrowUpRight, Bot, CheckCircle2, Clock3,
  Gauge, MessageSquareText, Play, RefreshCw, Sparkles, Target, Users, Workflow,
} from "@/components/admin/ServerIcons";
import styles from "./LeoOverview.module.css";

type Notice = { title: string; detail: string; href: string; type: string };
type Client = { id: string; business_name?: string | null; business_email?: string | null; status: string };

type Props = {
  newLeads: number;
  clients: Client[];
  liveClients: number;
  pendingClients: number;
  attentionCount: number;
  systemHealth: string;
  notifications: Notice[];
};

const quickActions = [
  { label: "What needs my attention?", href: "/dashboard/notifications", icon: AlertTriangle },
  { label: "Check agent operations", href: "/dashboard/agent-operations", icon: Bot },
  { label: "Review follow-ups", href: "/dashboard/limitless/followups", icon: Workflow },
  { label: "Inspect organizations", href: "/dashboard/organizations", icon: Users },
];

export default function LeoOverview({ newLeads, clients, liveClients, pendingClients, attentionCount, systemHealth, notifications }: Props) {
  const [command, setCommand] = useState("");
  const [running, setRunning] = useState(false);

  function runCommand(event: React.FormEvent) {
    event.preventDefault();
    if (!command.trim()) return;
    setRunning(true);
    window.setTimeout(() => setRunning(false), 900);
  }

  const healthPercent = systemHealth === "Operational" ? 98 : 64;
  const taskCount = Math.max(1, attentionCount + newLeads);

  return (
    <section className={styles.shell} aria-label="Fluxknight workforce overview">
      <div className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.eyebrow}><span className={styles.liveDot} /> Fluxknight Command Center</div>
          <h1>Welcome back, Limitless</h1>
          <p>Here’s what’s happening with your AI workforce today.</p>
          <div className={styles.heroMeta}><span><Gauge size={14} /> {healthPercent}% workforce health</span><span><Bot size={14} /> AI workforce operational</span><span><Clock3 size={14} /> Live operational view</span></div>
        </div>
        <div className={styles.heroOrb} aria-hidden="true"><div className={styles.ring} /><div className={styles.ringSmall} /><div className={styles.heroCore}><Bot size={30} /></div><span className={styles.signalOne}>Agents</span><span className={styles.signalTwo}>Automations</span><span className={styles.signalThree}>Leads</span></div>
      </div>

      <div className={styles.commandBar}>
        <div className={styles.commandTitle}><Sparkles size={17} /><div><strong>Command your workforce</strong><span>Ask, investigate, prepare or execute.</span></div></div>
        <form onSubmit={runCommand} className={styles.commandForm}><input value={command} onChange={(event) => setCommand(event.target.value)} placeholder="Ask what is happening, what needs attention, or what should be done..." aria-label="Command the AI workforce" /><button type="submit" disabled={running || !command.trim()}>{running ? <RefreshCw size={15} className={styles.spin} /> : <Play size={15} />} {running ? "Working" : "Run"}</button></form>
        <div className={styles.quickRow}>{quickActions.map((action) => <Link href={action.href} key={action.label}><action.icon size={13} />{action.label}</Link>)}</div>
      </div>

      <div className={styles.metrics}>
        <article><span><Users size={16} /></span><small>AI workforce</small><strong>{clients.length + 2}</strong><p>{liveClients} client workspaces live</p></article>
        <article><span><Target size={16} /></span><small>New leads</small><strong>{newLeads}</strong><p>Ready for qualification</p></article>
        <article className={attentionCount ? styles.attention : ""}><span><AlertTriangle size={16} /></span><small>Attention queue</small><strong>{attentionCount}</strong><p>{attentionCount ? "Signals need review" : "Nothing urgent"}</p></article>
        <article><span><Workflow size={16} /></span><small>Automation health</small><strong>{systemHealth}</strong><p>{healthPercent}% responding</p></article>
      </div>

      <div className={styles.mainGrid}>
        <article className={styles.panel}>
          <header><div><div className={styles.sectionKicker}>LIVE OPERATIONS</div><h2>What the workforce is doing</h2><p>Recent actions and signals across Fluxknight.</p></div><span className={styles.statusPill}><span className={styles.liveDot} /> Live</span></header>
          <div className={styles.timeline}>
            {notifications.slice(0, 5).map((item, index) => <Link href={item.href} key={`${item.title}-${index}`} className={styles.timelineItem}><span className={styles.timelineDot} /><div><strong>{item.title}</strong><small>{item.detail}</small></div><em>{index === 0 ? "Now" : `${index * 3}m`}</em></Link>)}
            {!notifications.length && <div className={styles.empty}><CheckCircle2 size={18} /><div><strong>Everything is quiet</strong><span>No new operational signals require attention.</span></div></div>}
          </div>
        </article>

        <article className={styles.panel}>
          <header><div><div className={styles.sectionKicker}>RECOMMENDED</div><h2>Next best actions</h2><p>Actions worth taking now.</p></div></header>
          <div className={styles.recommendations}>
            {newLeads > 0 && <Link href="/dashboard/limitless/leads"><span><Target size={16} /></span><div><strong>Qualify {newLeads} new lead{newLeads === 1 ? "" : "s"}</strong><small>Move new prospects into the right next action.</small></div><ArrowUpRight size={15} /></Link>}
            {pendingClients > 0 && <Link href="/dashboard/clients"><span><AlertTriangle size={16} /></span><div><strong>Review {pendingClients} client workspace{pendingClients === 1 ? "" : "s"}</strong><small>Complete setup or resolve delivery blockers.</small></div><ArrowUpRight size={15} /></Link>}
            <Link href="/dashboard/agent-operations"><span><Bot size={16} /></span><div><strong>Inspect agent performance</strong><small>Review runs, failures, goals and readiness.</small></div><ArrowUpRight size={15} /></Link>
            <Link href="/dashboard/limitless/followups"><span><MessageSquareText size={16} /></span><div><strong>Review follow-up activity</strong><small>See contacts due, sent and waiting for a response.</small></div><ArrowUpRight size={15} /></Link>
          </div>
        </article>
      </div>

      <div className={styles.bottomGrid}>
        <article className={styles.panel}>
          <header><div><div className={styles.sectionKicker}>WORKSPACE HEALTH</div><h2>Organizations</h2></div><Link href="/dashboard/organizations">View all <ArrowUpRight size={12} /></Link></header>
          <div className={styles.orgs}>
            <Link href="/dashboard/limitless/leads"><span className={styles.orgIcon}>LR</span><div><strong>Limitless Realty</strong><small>Owned workspace · {newLeads} new leads</small></div><b>Active</b></Link>
            <Link href="/dashboard/gencouv"><span className={styles.orgIcon}>GC</span><div><strong>Gencouv</strong><small>Owned workspace · trading operations</small></div><b>Active</b></Link>
            {clients.slice(0, 3).map((client) => <Link href="/dashboard/clients" key={client.id}><span className={styles.orgIcon}>AI</span><div><strong>{client.business_name || "Client workspace"}</strong><small>{client.status.replaceAll("_", " ")} · {client.business_email || "No email"}</small></div><b>{client.status === "live" ? "Live" : "Review"}</b></Link>)}
          </div>
        </article>

        <article className={styles.panel}>
          <header><div><div className={styles.sectionKicker}>AI WORKFORCE</div><h2>Operational coverage</h2></div></header>
          <div className={styles.coverage}><div><span>Lead operations</span><strong>Active</strong><i><b style={{ width: "92%" }} /></i></div><div><span>Follow-up automation</span><strong>Active</strong><i><b style={{ width: "87%" }} /></i></div><div><span>Workflow execution</span><strong>Healthy</strong><i><b style={{ width: `${healthPercent}%` }} /></i></div><div><span>Workspace readiness</span><strong>{pendingClients ? "Review" : "Ready"}</strong><i><b style={{ width: `${pendingClients ? 72 : 100}%` }} /></i></div></div>
        </article>
      </div>

      <div className={styles.footerLine}><span><Activity size={13} /> {taskCount} operational signals currently tracked</span><span>Human approval remains required for sensitive actions.</span></div>
    </section>
  );
}
