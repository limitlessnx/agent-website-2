import { Activity, Bot, CircleDollarSign, Flame, LineChart, Mail, ShieldCheck, Users } from "lucide-react";
import MetricCard from "@/components/admin/MetricCard";
import GencouvEmailControls from "@/components/gencouv/GencouvEmailControls";
import GencouvLeadActions from "@/components/gencouv/GencouvLeadActions";
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

const dashboardUrl =
  process.env.GENCOUV_DASHBOARD_API_URL ||
  "https://n8n.srv1720757.hstgr.cloud/webhook/gencouv-dashboard-data";

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

function LeadCard({ lead }: { lead: Lead }) {
  return (
    <article className="admin-panel" style={{ minHeight: 220 }}>
      <div className="admin-panel-header">
        <div>
          <h2 style={{ fontSize: "1rem" }}>{lead.name || "Unknown lead"}</h2>
          <p>{lead.email || lead.phone || "No contact captured"}</p>
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
  const [organizations, dashboard] = await Promise.all([
    supabaseServerRequest<any[]>("organizations?select=id,name,slug,status,metadata&slug=eq.gencouv&limit=1").catch(() => []),
    getGencouvDashboard(),
  ]);

  const organization = organizations[0];
  const data = dashboard.data;
  const hotLeads = data?.lead_boards?.hot?.slice(0, 4) || [];
  const recentLeads = data?.recent_leads?.slice(0, 8) || [];

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
        <MetricCard icon={Users} tone="cyan" label="Total records" value={total(data, "leads")} detail="CRM rows from Gencouv Leads" trend="live" />
        <MetricCard icon={Flame} tone="emerald" label="Hot leads" value={total(data, "hot")} detail="Ready for fast follow-up" trend="priority" />
        <MetricCard icon={Activity} tone="amber" label="Follow-ups due" value={total(data, "follow_ups_due")} detail="Needs review or contact" trend="next action" />
        <MetricCard icon={ShieldCheck} tone="violet" label="Onboarding" value={total(data, "onboarding")} detail="Pending setup or evaluation" trend="client path" />
        <MetricCard icon={CircleDollarSign} tone="emerald" label="Onboarded" value={total(data, "onboarded")} detail="Active client base" trend="conversion" />
        <MetricCard icon={Mail} tone="rose" label="Bounced" value={total(data, "bounced")} detail="Protect deliverability" trend="email health" />
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
          dailyLimit={data?.email_controls?.daily_send_limit || 10}
          maxDailyLimit={data?.email_controls?.max_daily_limit || 10}
          sendingEnabled={Boolean(data?.email_controls?.sending_enabled)}
        />
      </div>

      <div id="operations" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
        <Breakdown title="Lifecycle board" items={data?.breakdowns?.lifecycle_status} />
        <Breakdown title="Broker mix" items={data?.breakdowns?.broker} />
        <Breakdown title="Lead source" items={data?.breakdowns?.source} />
      </div>

      <section id="lead-board" className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h2><Bot size={18} /> High-priority leads</h2>
            <p>Prospects the support agent identified as ready for the Get on board flow.</p>
          </div>
          <span className="admin-status live">{hotLeads.length} visible</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 14 }}>
          {hotLeads.length ? hotLeads.map((lead) => <LeadCard key={lead.lead_id || `${lead.email}-${lead.last_contact_at}`} lead={lead} />) : <p>No hot leads yet.</p>}
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
          {recentLeads.length ? recentLeads.map((lead) => <LeadCard key={`${lead.lead_id}-${lead.name}-${lead.last_contact_at}`} lead={lead} />) : <p>No recent leads yet.</p>}
        </div>
      </section>
    </main>
  );
}
