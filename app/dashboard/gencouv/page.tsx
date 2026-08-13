import { Activity, Bot, CircleDollarSign, Flame, LineChart, Mail, ShieldCheck, Users } from "@/components/admin/ServerIcons";
import MetricCard from "@/components/admin/MetricCard";
import GencouvCohorts from "@/components/gencouv/GencouvCohorts";
import GencouvEmailControls from "@/components/gencouv/GencouvEmailControls";
import GencouvInbox from "@/components/gencouv/GencouvInbox";
import GencouvLeadActions from "@/components/gencouv/GencouvLeadActions";
import GencouvMailLeads from "@/components/gencouv/GencouvMailLeads";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";

export const dynamic = "force-dynamic";

type Lead = {
  lead_id?: string;
  name?: string;
  email?: string;
  phone?: string;
  source?: string;
  product_interest?: string;
  broker?: string;
  lifecycle_status?: string;
  lead_temperature?: string;
  pipeline_stage?: string;
  onboarding_status?: string;
  email_sequence_status?: string;
  follow_up_status?: string;
  dashboard_priority?: string;
  last_contact_at?: string;
  next_follow_up_at?: string;
  message?: string;
};

type DashboardData = {
  success: boolean;
  generated_at?: string;
  totals?: Record<string, number>;
  breakdowns?: {
    lifecycle_status?: Record<string, number>;
    email_sequence_status?: Record<string, number>;
    broker?: Record<string, number>;
    product_interest?: Record<string, number>;
    source?: Record<string, number>;
    priority?: Record<string, number>;
  };
  lead_boards?: Record<string, Lead[]>;
  recent_leads?: Lead[];
  email_controls?: {
    sending_enabled?: boolean;
    daily_send_limit?: number;
    max_daily_limit?: number;
    available_actions?: string[];
  };
  warnings?: {
    email_sending_enabled?: boolean;
    note?: string;
  };
};

type EmailMessage = {
  id?: string;
  recipient_email?: string;
  status?: string;
  direction?: string;
  is_auto_reply?: boolean;
  sent_at?: string;
  delivered_at?: string;
  bounced_at?: string;
  complained_at?: string;
  failed_at?: string;
  suppressed_at?: string;
  opened_at?: string;
  clicked_at?: string;
  last_event_at?: string;
  created_at?: string;
};

type PipelineLead = {
  id?: string;
  email?: string;
  normalized_email?: string;
  campaign_status?: string;
  validation_status?: string;
  qualification_status?: string;
  cohort_date?: string;
  created_at?: string;
};

type DailyCohort = {
  cohort_date?: string;
  raw_generated?: number;
  rejected?: number;
  qualified?: number;
  campaign_enrolled?: number;
  daily_new_lead_limit?: number;
  status?: string;
};

type CampaignSettings = {
  daily_send_limit?: number;
  daily_new_lead_limit?: number;
  sending_enabled?: boolean;
  status?: string;
};

const dashboardUrl =
  process.env.GENCOUV_DASHBOARD_API_URL ||
  "https://n8n.srv1720757.hstgr.cloud/webhook/gencouv-dashboard-data";

const TEST_MARKERS = ["codex", "test lead", "clean test", "sanitized test", "dummy", "sample lead"];
const BLOCKED_EMAIL_STATES = ["do_not_contact", "bounced", "complained", "suppressed", "unsubscribed", "failed"];

function isSyntheticLead(lead: Lead) {
  const searchable = [lead.name, lead.email, lead.phone, lead.source, lead.message]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return TEST_MARKERS.some((marker) => searchable.includes(marker)) || lead.source?.toLowerCase() === "test";
}

function hasValidEmail(lead: Lead) {
  const email = lead.email?.trim().toLowerCase() || "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
  const state = `${lead.email_sequence_status || ""} ${lead.lifecycle_status || ""} ${lead.follow_up_status || ""}`.toLowerCase();
  return !BLOCKED_EMAIL_STATES.some((blocked) => state.includes(blocked));
}

function isVisibleEmailLead(lead: Lead) {
  return !isSyntheticLead(lead) && hasValidEmail(lead);
}

async function getGencouvDashboard() {
  const secret = process.env.GENCOUV_DASHBOARD_SECRET;

  if (!secret) {
    return {
      data: null as DashboardData | null,
      error: "GENCOUV_DASHBOARD_SECRET is not configured in Flux Knight.",
    };
  }

  try {
    const response = await fetch(dashboardUrl, {
      headers: { "x-gencouv-dashboard-secret": secret },
      cache: "no-store",
    });
    const data = (await response.json()) as DashboardData;

    if (!response.ok || data.success === false) {
      return {
        data: null as DashboardData | null,
        error: "The Gencouv dashboard feed rejected the request.",
      };
    }

    return { data, error: null as string | null };
  } catch {
    return {
      data: null as DashboardData | null,
      error: "The Gencouv dashboard feed is not reachable.",
    };
  }
}

function total(data: DashboardData | null, key: string) {
  return data?.totals?.[key] ?? 0;
}

function formatTime(value?: string) {
  if (!value) return "No timestamp";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function Breakdown({ title, items }: { title: string; items?: Record<string, number> }) {
  const rows = Object.entries(items || {}).filter(([, value]) => value > 0);

  return (
    <section className="admin-panel">
      <div className="admin-panel-header">
        <div>
          <h2>{title}</h2>
          <p>Live split from the Gencouv CRM sheet.</p>
        </div>
      </div>
      <div className="admin-checklist">
        {rows.length ? rows.map(([label, value]) => <span key={label}>{label}: {value}</span>) : <span>No records yet</span>}
      </div>
    </section>
  );
}

function countMessages(messages: EmailMessage[], predicate: (message: EmailMessage) => boolean) {
  return messages.reduce((total, message) => total + (predicate(message) ? 1 : 0), 0);
}

function LeadCard({ lead }: { lead: Lead }) {
  return (
    <article className="admin-panel" style={{ minHeight: 220 }}>
      <div className="admin-panel-header">
        <div>
          <h2 style={{ fontSize: "1rem" }}>{lead.name || "Unknown lead"}</h2>
          <p>{lead.email}</p>
        </div>
        <span className={lead.dashboard_priority === "High" ? "admin-status live" : "admin-status"}>
          {lead.dashboard_priority || "Low"}
        </span>
      </div>
      <div className="admin-checklist">
        <span>{lead.product_interest || "General"}</span>
        <span>{lead.broker || "Broker unknown"}</span>
        <span>{lead.email_sequence_status || "not_ready"}</span>
        <span>{lead.lifecycle_status || "Cold"}</span>
      </div>
      <p style={{ color: "var(--admin-text-soft)", lineHeight: 1.6, margin: "16px 0 0" }}>
        {lead.message || "No message preview available."}
      </p>
      <p style={{ color: "var(--admin-text-muted)", fontSize: ".78rem", margin: "14px 0 0" }}>
        Last contact: {formatTime(lead.last_contact_at)}
      </p>
      <GencouvLeadActions leadId={lead.lead_id} email={lead.email} name={lead.name} />
    </article>
  );
}

export default async function GencouvWorkspacePage() {
  const [organizations, dashboard, emailMessages, campaignEnrollments, rawLeads, rejectedLeads, qualifiedLeads, dailyCohorts, campaignSettings] = await Promise.all([
    supabaseServerRequest<any[]>("organizations?select=id,name,slug,status,metadata&slug=eq.gencouv&limit=1").catch(() => []),
    getGencouvDashboard(),
    supabaseServerRequest<any[]>("gencouv_email_messages?select=*&order=created_at.desc&limit=500").catch(() => []),
    supabaseServerRequest<any[]>("gencouv_campaign_enrollments?select=*&order=cohort_date.desc,created_at.desc&limit=500").catch(() => []),
    supabaseServerRequest<PipelineLead[]>("gencouv_raw_leads?select=id,email,normalized_email,campaign_status,validation_status,qualification_status,cohort_date,created_at&order=created_at.desc&limit=1000").catch(() => []),
    supabaseServerRequest<PipelineLead[]>("gencouv_rejected_leads?select=id,email,normalized_email,processing_status,validation_result,created_at&order=created_at.desc&limit=1000").catch(() => []),
    supabaseServerRequest<PipelineLead[]>("gencouv_qualified_leads?select=id,email,normalized_email,campaign_status,validation_status,qualification_status,cohort_date,created_at&order=created_at.desc&limit=1000").catch(() => []),
    supabaseServerRequest<DailyCohort[]>("gencouv_daily_cohorts?select=*&order=cohort_date.desc&limit=30").catch(() => []),
    supabaseServerRequest<CampaignSettings[]>("gencouv_campaign_settings?select=*&campaign_key=eq.gencouv_long_form_copy_trading&limit=1").catch(() => []),
  ]);

  const organization = organizations[0];
  const data = dashboard.data;
  const hotLeads = (data?.lead_boards?.hot || []).filter(isVisibleEmailLead).slice(0, 4);
  const recentLeads = (data?.recent_leads || []).filter(isVisibleEmailLead).slice(0, 8);
  const allLeads = [...Object.values(data?.lead_boards || {}).flat(), ...(data?.recent_leads || [])]
    .filter(isVisibleEmailLead);
  const uniqueMailLeads = Array.from(
    new Map(
      allLeads.map((lead) => [lead.email!.trim().toLowerCase(), { ...lead, email: lead.email!.trim().toLowerCase() }]),
    ).values(),
  );
  const outboundMessages = emailMessages.filter((message: EmailMessage) => message.direction !== "inbound");
  const inboundMessages = emailMessages.filter((message: EmailMessage) => message.direction === "inbound");
  const emailMetrics = {
    sent: countMessages(outboundMessages, (message) => Boolean(message.sent_at) || ["sent", "delivered", "opened", "clicked", "replied"].includes(message.status || "")),
    delivered: countMessages(outboundMessages, (message) => Boolean(message.delivered_at) || ["delivered", "opened", "clicked", "replied"].includes(message.status || "")),
    bounced: countMessages(outboundMessages, (message) => Boolean(message.bounced_at) || message.status === "bounced"),
    suppressed: countMessages(outboundMessages, (message) => Boolean(message.suppressed_at) || message.status === "suppressed"),
    failed: countMessages(outboundMessages, (message) => Boolean(message.failed_at) || message.status === "failed"),
    complained: countMessages(outboundMessages, (message) => Boolean(message.complained_at) || message.status === "complained"),
    replies: inboundMessages.length,
    genuineReplies: countMessages(inboundMessages, (message) => !message.is_auto_reply),
    autoReplies: countMessages(inboundMessages, (message) => Boolean(message.is_auto_reply)),
  };
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const latestCohort = dailyCohorts.find((cohort) => cohort.cohort_date === today) || dailyCohorts[0];
  const settings = campaignSettings[0] || {};
  const rawToday = rawLeads.filter((lead) => lead.cohort_date === today || lead.created_at?.startsWith(today)).length;
  const rejectedToday = rejectedLeads.filter((lead) => lead.created_at?.startsWith(today)).length;
  const qualifiedToday = qualifiedLeads.filter((lead) => lead.cohort_date === today || lead.created_at?.startsWith(today)).length;
  const enrolledToday = campaignEnrollments.filter((row: any) => row.cohort_date === today).length;

  return (
    <main className="admin-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-kicker">Gencouv Workspace</p>
          <h1>Trading and Client Operations</h1>
          <p>Monitor Gencouv leads, copy-trading interest, onboarding movement, broker mix, and email sequence readiness from one Flux Knight control room.</p>
        </div>
        <span className="admin-status live">{organization?.status || "active"}</span>
      </header>

      {dashboard.error ? (
        <section className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <h2>Dashboard feed setup needed</h2>
              <p>{dashboard.error}</p>
            </div>
            <span className="admin-status warning">not connected</span>
          </div>
          <div className="admin-checklist">
            <span>Add GENCOUV_DASHBOARD_SECRET to the Flux Knight server environment</span>
            <span>Keep email sequence sending disabled until approved</span>
          </div>
        </section>
      ) : null}

      <div className="admin-metric-grid">
        <MetricCard icon={Users} tone="cyan" label="Raw leads today" value={latestCohort?.raw_generated ?? rawToday} detail="Candidates generated before validation" trend="Supabase" />
        <MetricCard icon={ShieldCheck} tone="emerald" label="Qualified today" value={latestCohort?.qualified ?? qualifiedToday} detail="Passed validation and qualification" trend="post-validation" />
        <MetricCard icon={Activity} tone="amber" label="Rejected today" value={latestCohort?.rejected ?? rejectedToday} detail="Blocked before campaign enrollment" trend="safeguards" />
        <MetricCard icon={Mail} tone="rose" label="Enrolled today" value={latestCohort?.campaign_enrolled ?? enrolledToday} detail="New campaign cohort reservations" trend={`${settings.daily_new_lead_limit || 30}/day cap`} />
        <MetricCard icon={ShieldCheck} tone="violet" label="Onboarding" value={total(data, "onboarding")} detail="Pending setup or evaluation" trend="client path" />
        <MetricCard icon={CircleDollarSign} tone="emerald" label="Onboarded" value={total(data, "onboarded")} detail="Active client base" trend="conversion" />
      </div>

      <div className="admin-metric-grid">
        <MetricCard icon={Mail} tone="cyan" label="Sent" value={emailMetrics.sent} detail="Recorded outbound Resend messages" trend="provider events" />
        <MetricCard icon={ShieldCheck} tone="emerald" label="Delivered" value={emailMetrics.delivered} detail="Confirmed or progressed delivery events" trend="provider events" />
        <MetricCard icon={Activity} tone="amber" label="Bounced" value={emailMetrics.bounced} detail="Blocked from further nurture" trend="stop condition" />
        <MetricCard icon={Activity} tone="rose" label="Suppressed/failed" value={emailMetrics.suppressed + emailMetrics.failed + emailMetrics.complained} detail="Suppressed, failed or complained contacts" trend="do not contact" />
        <MetricCard icon={Users} tone="violet" label="Replies" value={emailMetrics.replies} detail={`${emailMetrics.genuineReplies} genuine, ${emailMetrics.autoReplies} auto`} trend="inbox" />
      </div>

      <section id="sequence-status" className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h2>Email sequence status</h2>
            <p>{data?.warnings?.note || "Email sequence sending remains disabled until approved."}</p>
          </div>
          <span className={data?.warnings?.email_sending_enabled ? "admin-status live" : "admin-status warning"}>
            {data?.warnings?.email_sending_enabled ? "enabled" : "disabled"}
          </span>
        </div>
        <div className="admin-checklist">
          {Object.entries(data?.breakdowns?.email_sequence_status || {}).filter(([, value]) => value > 0).map(([label, value]) => (
            <span key={label}>{label}: {value}</span>
          ))}
          {!Object.values(data?.breakdowns?.email_sequence_status || {}).some(Boolean) ? <span>No email sequence records yet</span> : null}
        </div>
      </section>

      <div id="email-control">
        <GencouvEmailControls
          dailyLimit={settings.daily_send_limit || data?.email_controls?.daily_send_limit || 10}
          maxDailyLimit={30}
          sendingEnabled={Boolean(settings.sending_enabled || data?.email_controls?.sending_enabled)}
        />
      </div>

      <GencouvMailLeads leads={uniqueMailLeads} messages={emailMessages} />

      <GencouvInbox messages={emailMessages} />

      <section id="daily-cohort-summary" className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h2>Daily cohort summary</h2>
            <p>Supabase-backed lead generation and enrollment totals. Follow-up emails from older cohorts are not counted as new leads.</p>
          </div>
          <span className="admin-status">{dailyCohorts.length} cohorts</span>
        </div>
        <div className="admin-checklist">
          {dailyCohorts.length ? dailyCohorts.slice(0, 10).map((cohort) => (
            <span key={`${cohort.cohort_date}-${cohort.status}`}>
              {cohort.cohort_date || "No date"}:
              {" "}raw {cohort.raw_generated || 0},
              {" "}rejected {cohort.rejected || 0},
              {" "}qualified {cohort.qualified || 0},
              {" "}enrolled {cohort.campaign_enrolled || 0}/{cohort.daily_new_lead_limit || 30}
            </span>
          )) : <span>No Supabase cohorts recorded yet</span>}
        </div>
      </section>

      <GencouvCohorts enrollments={campaignEnrollments} />

      <div id="operations" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
        <Breakdown title="Lifecycle board" items={data?.breakdowns?.lifecycle_status} />
        <Breakdown title="Broker mix" items={data?.breakdowns?.broker} />
        <Breakdown title="Lead source" items={data?.breakdowns?.source} />
      </div>

      <section id="lead-board" className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h2><Bot size={18} /> High-priority leads</h2>
            <p>Prospects with valid email addresses that are ready for the Get on board flow.</p>
          </div>
          <span className="admin-status live">{hotLeads.length} visible</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 14 }}>
          {hotLeads.length ? hotLeads.map((lead) => <LeadCard key={lead.lead_id || `${lead.email}-${lead.last_contact_at}`} lead={lead} />) : <p>No email-ready hot leads yet.</p>}
        </div>
      </section>

      <section id="acquisition" className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h2><LineChart size={18} /> Recent Gencouv activity</h2>
            <p>Last sync: {formatTime(data?.generated_at)}</p>
          </div>
          <span className="admin-status">{recentLeads.length} records</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 14 }}>
          {recentLeads.length ? recentLeads.map((lead) => <LeadCard key={`${lead.lead_id}-${lead.name}-${lead.last_contact_at}`} lead={lead} />) : <p>No recent email-ready leads yet.</p>}
        </div>
      </section>
    </main>
  );
}
