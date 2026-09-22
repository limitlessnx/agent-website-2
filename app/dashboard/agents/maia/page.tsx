import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  MessageSquareText,
  PhoneCall,
  Target,
  Users,
  Workflow,
} from "@/components/admin/ServerIcons";
import { getLeads } from "@/lib/limitless-data";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type Lead = Awaited<ReturnType<typeof getLeads>>[number];

function normalized(value?: string) {
  return String(value || "").trim().toLowerCase();
}

function asDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function inWindow(value: string | undefined, days: number, now: Date) {
  const date = asDate(value);
  if (!date) return false;
  return date.getTime() >= now.getTime() - days * 24 * 60 * 60 * 1000;
}

function isEngaged(lead: Lead) {
  return Boolean(lead.last_contacted_at) ||
    ["in_conversation", "contacted", "engaged", "qualified", "follow_up", "follow-up"].includes(normalized(lead.status));
}

function isQualified(lead: Lead) {
  const score = normalized(lead.score);
  const status = normalized(lead.status);
  return ["hot", "high", "qualified", "ready"].includes(score) || status.includes("qualified");
}

function isFollowUp(lead: Lead) {
  return Boolean(lead.last_follow_up_at) ||
    Number(lead.follow_up_stage || 0) > 0 ||
    normalized(lead.status).includes("follow");
}

function isInspection(lead: Lead) {
  const status = normalized(lead.status);
  return status.includes("inspection") || status.includes("viewing") || status.includes("scheduled");
}

function isHandoff(lead: Lead) {
  const status = normalized(lead.status);
  return status.includes("handoff") || status.includes("human") || status.includes("escalat");
}

function metricSet(leads: Lead[]) {
  return {
    leads: leads.length,
    conversations: leads.filter(isEngaged).length,
    qualified: leads.filter(isQualified).length,
    followups: leads.filter(isFollowUp).length,
    inspections: leads.filter(isInspection).length,
    handoffs: leads.filter(isHandoff).length,
  };
}

export default async function MaiaPerformancePage() {
  const leads = await getLeads(500).catch(() => []);
  const now = new Date();

  const windows = [7, 30, 90].map((days) => {
    const scoped = leads.filter((lead) =>
      inWindow(lead.created_at, days, now) ||
      inWindow(lead.last_contacted_at, days, now) ||
      inWindow(lead.last_follow_up_at, days, now)
    );
    return { days, ...metricSet(scoped) };
  });

  const current = metricSet(leads);
  const engagementRate = current.leads ? Math.round((current.conversations / current.leads) * 100) : 0;
  const qualificationRate = current.conversations ? Math.round((current.qualified / current.conversations) * 100) : 0;
  const inspectionRate = current.qualified ? Math.round((current.inspections / current.qualified) * 100) : 0;

  const recent = [...leads]
    .sort((a, b) => {
      const aTime = asDate(a.last_contacted_at)?.getTime() || asDate(a.created_at)?.getTime() || 0;
      const bTime = asDate(b.last_contacted_at)?.getTime() || asDate(b.created_at)?.getTime() || 0;
      return bTime - aTime;
    })
    .slice(0, 8);

  return (
    <main className="admin-page">
      <div className={styles.backRow}>
        <Link href="/dashboard"><ArrowLeft size={15} /> Dashboard</Link>
        <Link href="/dashboard/agents">Manage agents</Link>
      </div>

      <header className={styles.hero}>
        <div className={styles.identity}>
          <div className={styles.avatar}>M</div>
          <div>
            <span className={styles.kicker}>AI WORKFORCE</span>
            <div className={styles.titleRow}>
              <h1>Maia</h1>
              <span className={styles.live}><i /> Live</span>
            </div>
            <p>WhatsApp Sales Agent · Limitless Realty</p>
          </div>
        </div>
        <div className={styles.heroActions}>
          <Link href="/dashboard/conversations"><MessageSquareText size={15} /> Conversations</Link>
          <Link href="/dashboard/limitless/leads"><Users size={15} /> Leads</Link>
        </div>
      </header>

      <section className={styles.summaryGrid} aria-label="Maia performance summary">
        <article><Users size={17} /><strong>{current.leads}</strong><span>Leads</span><small>Visible CRM records</small></article>
        <article><MessageSquareText size={17} /><strong>{current.conversations}</strong><span>Conversations</span><small>{engagementRate}% engagement</small></article>
        <article><Target size={17} /><strong>{current.qualified}</strong><span>Qualified</span><small>{qualificationRate}% of engaged leads</small></article>
        <article><Workflow size={17} /><strong>{current.followups}</strong><span>Follow-ups</span><small>Current follow-up state</small></article>
        <article><CheckCircle2 size={17} /><strong>{current.inspections}</strong><span>Inspections</span><small>{inspectionRate}% of qualified leads</small></article>
        <article><PhoneCall size={17} /><strong>{current.handoffs}</strong><span>Human handoffs</span><small>Escalated lead state</small></article>
      </section>

      <div className={styles.mainGrid}>
        <section className={styles.panel}>
          <header>
            <div><span className={styles.kicker}>SALES FUNNEL</span><h2>Lead progression</h2><p>How visible lead records are moving through Maia’s sales journey.</p></div>
          </header>
          <div className={styles.funnel}>
            {[
              ["Leads entered", current.leads],
              ["Conversations", current.conversations],
              ["Qualified", current.qualified],
              ["Follow-ups", current.followups],
              ["Inspections", current.inspections],
              ["Human handoffs", current.handoffs],
            ].map(([label, value], index, all) => {
              const max = Math.max(Number(all[0][1]) || 1, 1);
              const width = Math.max(8, Math.round((Number(value) / max) * 100));
              return (
                <div key={String(label)} className={styles.funnelRow}>
                  <div><span>{label}</span><strong>{value}</strong></div>
                  <i><b style={{ width: width + "%" }} /></i>
                </div>
              );
            })}
          </div>
          <div className={styles.dataNote}>
            <Clock3 size={15} />
            <p>Conversation and funnel counts currently use CRM lead-state evidence. They are not yet true WhatsApp message-session analytics.</p>
          </div>
        </section>

        <section className={styles.panel}>
          <header>
            <div><span className={styles.kicker}>PERFORMANCE WINDOWS</span><h2>7 / 30 / 90 days</h2><p>Recent activity based on lead creation, contact, and follow-up timestamps.</p></div>
          </header>
          <div className={styles.windows}>
            {windows.map((window) => (
              <article key={window.days}>
                <strong>{window.days}D</strong>
                <div><span>Leads</span><b>{window.leads}</b></div>
                <div><span>Conversations</span><b>{window.conversations}</b></div>
                <div><span>Qualified</span><b>{window.qualified}</b></div>
                <div><span>Follow-ups</span><b>{window.followups}</b></div>
                <div><span>Inspections</span><b>{window.inspections}</b></div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <section className={styles.panel}>
        <header className={styles.recentHeader}>
          <div><span className={styles.kicker}>RECENT LEAD ACTIVITY</span><h2>Latest customer movement</h2><p>Recent records that Maia has touched or that entered the sales pipeline.</p></div>
          <Link href="/dashboard/limitless/leads">View CRM</Link>
        </header>
        <div className={styles.leadList}>
          {recent.map((lead) => (
            <Link href="/dashboard/limitless/leads" key={lead.id}>
              <div>
                <strong>{lead.name || lead.phone || "Unnamed lead"}</strong>
                <span>{[lead.location_preference, lead.budget].filter(Boolean).join(" · ") || "Lead profile"}</span>
              </div>
              <div className={styles.leadState}>
                <b>{lead.score || lead.status || "active"}</b>
                <small>{isInspection(lead) ? "inspection" : isQualified(lead) ? "qualified" : isFollowUp(lead) ? "follow-up" : isEngaged(lead) ? "engaged" : "new"}</small>
              </div>
            </Link>
          ))}
          {!recent.length ? <p className={styles.empty}>No lead activity is available yet.</p> : null}
        </div>
      </section>
    </main>
  );
}
