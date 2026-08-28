"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import {
  Activity, AlertTriangle, ArrowUpRight, Bot, CheckCircle2, ChevronRight, Clock3,
  Gauge, MessageSquareText, Play, Search, ShieldCheck, Sparkles, Target, Users, Workflow,
} from "@/components/admin/ServerIcons";
import LeoRealtimeVoice from "@/components/leo/LeoRealtimeVoice";
import LeoActionCenter from "@/components/leo/LeoActionCenter";
import { useLeoConversation } from "@/components/leo/LeoConversationContext";
import styles from "./LeoOverviewDesktop.module.css";

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
  { label: "Attention", href: "/dashboard/notifications", icon: AlertTriangle },
  { label: "Agent operations", href: "/dashboard/agent-operations", icon: Bot },
  { label: "Follow-ups", href: "/dashboard/limitless/followups", icon: Workflow },
  { label: "Organizations", href: "/dashboard/organizations", icon: Users },
];

function noticeSeverity(type: string) {
  const value = String(type || "").toLowerCase();
  if (value.includes("error") || value.includes("fail") || value.includes("critical")) return "Critical";
  if (value.includes("warn") || value.includes("attention") || value.includes("pending")) return "Important";
  return "Info";
}

export default function LeoOverview({ newLeads, clients, liveClients, pendingClients, attentionCount, systemHealth, notifications }: Props) {
  const pathname = usePathname();
  const { sessionId, messages, busy, error, operationState, sendMessage, setSessionId, appendTranscript } = useLeoConversation();
  const healthPercent = systemHealth === "Operational" ? 98 : 64;
  const taskCount = Math.max(1, attentionCount + newLeads);
  const pageContext = useMemo(() => ({ pathname, section: "leo", resourceType: "platform-operations", localTime: new Date().toString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }), [pathname]);
  const leoStateLabel = operationState === "investigating" ? "Investigating" : operationState === "executing" ? "Executing" : operationState === "approval_required" ? "Approval required" : operationState === "verified" ? "Verified" : operationState === "error" ? "Needs attention" : "Ready";
  const latestLeoMessage = [...messages].reverse().find((message) => message.role === "assistant");

  async function runCommand(form: HTMLFormElement) {
    const input = form.elements.namedItem("leo-command") as HTMLInputElement | null;
    const message = String(input?.value || "").trim();
    if (!message || busy) return;
    if (input) input.value = "";
    await sendMessage(message, pageContext);
  }

  function investigate(item: Notice) {
    if (busy) return;
    void sendMessage(`Investigate this operational signal: ${item.title}. Context: ${item.detail}. Explain the finding, impact, likely cause, and safest next action. Do not execute a sensitive action without approval.`, { ...pageContext, signal: { title: item.title, detail: item.detail, type: item.type, href: item.href } });
  }

  return (
    <section className={styles.shell} aria-label="Fluxknight command center">
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <div className={styles.eyebrow}><span className={styles.liveDot} /> Platform command center</div>
          <div className={styles.titleRow}><h1>Super Leo.</h1><span className={styles.liveBadge}><span className={styles.liveDot} /> {leoStateLabel}</span></div>
          <p>One operational assistant across your AI workforce, client workspaces and automations.</p>
        </div>
        <div className={styles.headerActions}>
          <Link href="/dashboard/agents" className={styles.secondaryButton}><Bot size={14} /> Manage agents</Link>
          <Link href="/dashboard/notifications" className={styles.primaryButton}><AlertTriangle size={14} /> {attentionCount || 0} attention</Link>
        </div>
      </header>

      <div className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.heroLabel}><Sparkles size={14} /> AI operations layer</span>
          <h2>Your workforce is running. <span>Leo keeps watch.</span></h2>
          <p>Observe, investigate, recommend, request approval, act and verify. Human judgment stays in control where it matters.</p>
          <div className={styles.quickActions}>{quickActions.map((action) => <Link href={action.href} key={action.label}><action.icon size={14} /><span>{action.label}</span><ChevronRight size={13} /></Link>)}</div>
        </div>
        <div className={styles.leoCard}>
          <div className={styles.leoHeader}><div><span className={styles.agentStatus}><span className={styles.liveDot} /> {leoStateLabel}</span><strong>Leo</strong><small>System operations assistant</small></div><Bot size={18} /></div>
          <div className={styles.leoOrb}><LeoRealtimeVoice mode="orb" sessionId={sessionId || undefined} pageContext={pageContext} onSessionId={setSessionId} onTranscript={appendTranscript} /></div>
          <div className={styles.leoFooter}><span>Shared session</span><span>Realtime</span></div>
        </div>
      </div>

      <div className={styles.commandBar}>
        <div className={styles.commandIntro}><div className={styles.commandIcon}>{busy ? <Search size={15} /> : <Sparkles size={15} />}</div><div><strong>{operationState === "executing" ? "Leo is executing" : operationState === "approval_required" ? "Leo is waiting for approval" : busy ? "Leo is investigating" : error ? "Leo needs attention" : operationState === "verified" ? "Leo verified the last action" : "Command Super Leo"}</strong><span>{operationState === "executing" ? "The approved action is running. Leo will report the result when it returns." : operationState === "approval_required" ? "Review the prepared action below before anything changes." : busy ? "Checking current system state before responding." : error ? error : operationState === "verified" ? "Execution returned successfully and the result is recorded in the shared session." : "Ask, investigate, prepare or execute with approval."}</span></div></div>
        <form className={styles.commandForm} onSubmit={(event) => { event.preventDefault(); void runCommand(event.currentTarget); }}><input name="leo-command" disabled={busy} placeholder="Ask what is happening, what needs attention, or what should be done…" aria-label="Command Super Leo" /><button type="submit" disabled={busy}><Play size={13} /> {busy ? "Working" : "Ask Leo"}</button></form>
      </div>

      {(busy || latestLeoMessage) && <article className={styles.operationCard} aria-live="polite">
        <div className={styles.operationState}><span className={busy ? styles.operationPulse : styles.operationDone}>{busy ? <Search size={15} /> : <CheckCircle2 size={15} />}</span><div><span>{operationState === "executing" ? "EXECUTING" : busy ? "INVESTIGATING" : operationState === "verified" ? "VERIFIED" : "LATEST LEO RESULT"}</span><strong>{operationState === "executing" ? "Leo is carrying out the approved action" : busy ? "Leo is checking the current system state" : operationState === "verified" ? "Action completed and verification returned" : "Finding and recommended next action"}</strong></div></div>
        <p>{operationState === "executing" ? "Leo is executing only the scoped action you approved. The result will remain visible in this shared session." : busy ? "Leo is gathering context before recommending or preparing an action. Sensitive changes remain approval-gated." : latestLeoMessage?.content}</p>
        <div className={styles.operationFoot}><ShieldCheck size={12} /><span>{operationState === "executing" ? "Act → verify → report" : busy ? "Observe → investigate → recommend" : operationState === "verified" ? "Execution verified in the shared Leo session" : "Result available in the shared Leo conversation"}</span></div>
      </article>}

      <LeoActionCenter />

      <div className={styles.metrics}>
        <article><div className={styles.metricIcon}><Bot size={16} /></div><span>AI workforce</span><strong>{clients.length + 2}</strong><small>{liveClients} client workspaces live</small></article>
        <article><div className={styles.metricIcon}><Target size={16} /></div><span>New leads</span><strong>{newLeads}</strong><small>Ready for qualification</small></article>
        <article className={attentionCount ? styles.warning : ""}><div className={styles.metricIcon}><AlertTriangle size={16} /></div><span>Attention queue</span><strong>{attentionCount}</strong><small>{attentionCount ? "Signals need review" : "Nothing urgent"}</small></article>
        <article><div className={styles.metricIcon}><Gauge size={16} /></div><span>Automation health</span><strong>{healthPercent}%</strong><small>{systemHealth} · responding normally</small></article>
      </div>

      <div className={styles.mainGrid}>
        <article className={styles.panel}>
          <header className={styles.panelHeader}><div><span>NEEDS ATTENTION</span><h3>Operational signals</h3><p>Real platform signals Leo can investigate in context.</p></div><Link href="/dashboard/activity">View activity <ArrowUpRight size={13} /></Link></header>
          <div className={styles.attentionList}>
            {notifications.slice(0, 6).map((item, index) => { const severity = noticeSeverity(item.type); return <div key={`${item.title}-${index}`} className={styles.attentionItem}>
              <span className={`${styles.severity} ${severity === "Critical" ? styles.severityCritical : severity === "Important" ? styles.severityImportant : styles.severityInfo}`}>{severity}</span>
              <div className={styles.attentionCopy}><strong>{item.title}</strong><small>{item.detail}</small></div>
              <div className={styles.attentionActions}><button type="button" disabled={busy} onClick={() => investigate(item)}><Search size={12} /> Investigate</button><Link href={item.href} aria-label={`View ${item.title}`}><ArrowUpRight size={13} /></Link></div>
            </div>; })}
            {!notifications.length && <div className={styles.empty}><CheckCircle2 size={18} /><div><strong>All systems quiet</strong><span>No operational signals require attention.</span></div></div>}
          </div>
        </article>

        <article className={styles.panel}>
          <header className={styles.panelHeader}><div><span>LEO RECOMMENDS</span><h3>Next best actions</h3><p>High-value actions based on current state.</p></div></header>
          <div className={styles.recommendations}>
            {newLeads > 0 && <Link href="/dashboard/limitless/leads"><div className={styles.recIcon}><Target size={15} /></div><div><strong>Qualify {newLeads} new lead{newLeads === 1 ? "" : "s"}</strong><small>Move new prospects into the right next action.</small></div><ArrowUpRight size={14} /></Link>}
            {pendingClients > 0 && <Link href="/dashboard/clients"><div className={styles.recIcon}><AlertTriangle size={15} /></div><div><strong>Review {pendingClients} client workspace{pendingClients === 1 ? "" : "s"}</strong><small>Complete setup or resolve delivery blockers.</small></div><ArrowUpRight size={14} /></Link>}
            <Link href="/dashboard/agent-operations"><div className={styles.recIcon}><Bot size={15} /></div><div><strong>Inspect agent performance</strong><small>Review runs, failures, goals and readiness.</small></div><ArrowUpRight size={14} /></Link>
            <Link href="/dashboard/limitless/followups"><div className={styles.recIcon}><MessageSquareText size={15} /></div><div><strong>Review follow-up activity</strong><small>See contacts due, sent and waiting for a response.</small></div><ArrowUpRight size={14} /></Link>
          </div>
        </article>
      </div>

      <div className={styles.bottomGrid}>
        <article className={styles.panel}>
          <header className={styles.panelHeader}><div><span>WORKSPACES</span><h3>Organization health</h3><p>Current operational state by workspace.</p></div><Link href="/dashboard/organizations">View all <ArrowUpRight size={13} /></Link></header>
          <div className={styles.orgs}>
            <Link href="/dashboard/limitless/leads"><span className={styles.orgIcon}>LR</span><div><strong>Limitless Realty</strong><small>{newLeads} new leads · owned workspace</small></div><b>Active</b></Link>
            <Link href="/dashboard/gencouv"><span className={styles.orgIcon}>GC</span><div><strong>Gencouv</strong><small>Trading operations · owned workspace</small></div><b>Active</b></Link>
            {clients.slice(0, 3).map((client) => <Link href="/dashboard/clients" key={client.id}><span className={styles.orgIcon}>AI</span><div><strong>{client.business_name || "Client workspace"}</strong><small>{client.status.replaceAll("_", " ")} · {client.business_email || "No email"}</small></div><b>{client.status === "live" ? "Live" : "Review"}</b></Link>)}
          </div>
        </article>

        <article className={styles.panel}>
          <header className={styles.panelHeader}><div><span>SYSTEM COVERAGE</span><h3>Automation health</h3><p>Service readiness across the platform.</p></div><span className={styles.healthPill}><span className={styles.liveDot} /> Healthy</span></header>
          <div className={styles.coverage}>
            <div><span>Lead operations</span><strong>92%</strong><i><b style={{ width: "92%" }} /></i></div>
            <div><span>Follow-up automation</span><strong>87%</strong><i><b style={{ width: "87%" }} /></i></div>
            <div><span>Workflow execution</span><strong>{healthPercent}%</strong><i><b style={{ width: `${healthPercent}%` }} /></i></div>
            <div><span>Workspace readiness</span><strong>{pendingClients ? "72%" : "100%"}</strong><i><b style={{ width: `${pendingClients ? 72 : 100}%` }} /></i></div>
          </div>
          <div className={styles.coverageFoot}><Clock3 size={13} /> Last platform check <strong>Live</strong></div>
        </article>
      </div>

      <footer className={styles.footerLine}><span><Activity size={13} /> {taskCount} operational signals tracked</span><span>Human approval remains required for sensitive actions.</span></footer>
    </section>
  );
}
