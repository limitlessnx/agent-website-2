"use client";

import Link from "next/link";
import { AlertTriangle, Bot, CalendarDays, ChevronRight, Image as ImageIcon, MessageSquareText, Workflow, BellRing } from "lucide-react";
import styles from "./XposureStudioOverview.module.css";

type Metric = { label: string; value: number | string; detail: string; icon: string };
type Notice = { title: string; detail: string; href: string; type: string };
type Agent = { name: string; role: string; channel: string; status: string; href: string; note: string; metrics: Array<{ label: string; value: number | string }> };
type Activity = { id: string; title: string; meta: string; label: string; href: string; tone: string };

export default function XposureStudioOverview({
  workspaceName, metrics, notices, agents, conversations, activity,
}: {
  workspaceName: string;
  metrics: Metric[];
  notices: Notice[];
  agents: Agent[];
  conversations: Activity[];
  activity: Activity[];
}) {
  const conversationMetric = metrics.find((metric) => /conversation/i.test(metric.label));
  const followupMetric = metrics.find((metric) => /follow.?up/i.test(metric.label));
  const liveAgents = agents.filter((agent) => agent.status === "live").length;

  const cards = [
    { title: "Client conversations", value: conversationMetric?.value ?? conversations.length, detail: "Captured client-channel activity", href: "/dashboard/conversations", icon: MessageSquareText },
    { title: "Follow-ups & alerts", value: followupMetric?.value ?? notices.length, detail: "Items currently surfaced by the workspace", href: "/dashboard/activity", icon: Workflow },
    { title: "AI agents", value: agents.length, detail: liveAgents + " marked live in the current snapshot", href: "/dashboard/agents", icon: Bot },
    { title: "Bookings & calendar", value: "Open", detail: "Review booking requests and calendar connections", href: "/dashboard/bookings", icon: CalendarDays },
    { title: "Studio catalogue", value: "Open", detail: "Manage shoot packages and reference media", href: "/dashboard/catalogue", icon: ImageIcon },
    { title: "Reminders & automations", value: "Open", detail: "Create date-based, recurring, and event-triggered rules", href: "/dashboard/reminders", icon: BellRing },
  ];

  return (
    <div className={styles.overview} data-testid="xposure-studio-overview">
      <section className={styles.intro}>
        <div>
          <span className={styles.kicker}>XPOSURE STUDIOS · STUDIO OPERATIONS</span>
          <h2>Your studio at a glance</h2>
          <p>Client activity and agent signals currently available for {workspaceName}. Booking and catalogue figures will appear when their data sources are verified and connected.</p>
        </div>
        <span className={styles.studioMark}><ImageIcon size={22} /></span>
      </section>

      <section className={styles.metrics} aria-label="Studio operational metrics">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link href={card.href} className={styles.metric} key={card.title}>
              <span className={styles.metricIcon}><Icon size={18} /></span>
              <span className={styles.metricTitle}>{card.title}</span>
              <strong>{card.value}</strong>
              <small>{card.detail}</small>
              <ChevronRight className={styles.arrow} size={16} />
            </Link>
          );
        })}
      </section>

      <section className={styles.quickActions} aria-label="Studio quick actions">
        <h3>Quick access</h3>
        <div>
          <Link href="/dashboard/conversations"><MessageSquareText size={17} /><span><strong>Open client inbox</strong><small>Review captured conversations</small></span><ChevronRight size={16} /></Link>
          <Link href="/dashboard/agents"><Bot size={17} /><span><strong>Review AI agents</strong><small>Inspect agent configuration</small></span><ChevronRight size={16} /></Link>
          <Link href="/dashboard/activity"><CalendarDays size={17} /><span><strong>View activity</strong><small>Review available workspace events</small></span><ChevronRight size={16} /></Link>
          <Link href="/dashboard/reminders"><BellRing size={17} /><span><strong>Reminders & automations</strong><small>Configure dates and recurring schedules</small></span><ChevronRight size={16} /></Link>
        </div>
      </section>

      <section className={styles.panel}>
        <header><div><span className={styles.kicker}>OPERATIONS</span><h3>Needs attention</h3></div><span className={styles.count}>{notices.length}</span></header>
        {notices.length ? (
          <div className={styles.noticeList}>
            {notices.slice(0, 5).map((notice, index) => <Link href={notice.href} key={notice.title + index}><AlertTriangle size={17} /><span><strong>{notice.title}</strong><small>{notice.detail}</small></span><ChevronRight size={16} /></Link>)}
          </div>
        ) : <p className={styles.empty}>No unresolved dashboard alerts are currently available. This does not by itself confirm WhatsApp delivery or Maia runtime health.</p>}
      </section>

      <section className={styles.panel}>
        <header><div><span className={styles.kicker}>RECENT CLIENT ACTIVITY</span><h3>Latest activity</h3></div><Link className={styles.viewAll} href="/dashboard/conversations">Open inbox <ChevronRight size={14} /></Link></header>
        {activity.length ? (
          <div className={styles.activityList}>
            {activity.slice(0, 5).map((item) => <Link href={item.href} key={item.id}><span><strong>{item.title}</strong><small>{item.meta}</small></span><em>{item.label}</em></Link>)}
          </div>
        ) : <p className={styles.empty}>No recent client activity is available in this workspace snapshot.</p>}
      </section>
    </div>
  );
}
