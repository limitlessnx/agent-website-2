import MetricCard from "@/components/admin/MetricCard";
import type { CSSProperties } from "react";
import { AlertTriangle, Bot, Building2, CheckCircle2, Clock3, Image, Send, ShieldCheck, Users } from "lucide-react";
import { automationProjects, getCampaignReports, getLeads, getN8nStatus, getProperties, getSupabaseReadiness } from "@/lib/limitless-data";

const inactiveLeadStatuses = ["cold", "closed", "converted"];
const pipelineLabels = ["New", "Warm", "Hot", "Follow-up", "Campaign"];

export default async function DashboardPage() {
  const [leads, properties, campaigns, n8n] = await Promise.all([
    getLeads(100),
    getProperties(100),
    getCampaignReports(20),
    getN8nStatus(),
  ]);
  const supabase = await getSupabaseReadiness();
  const supabaseReady = supabase.ready;
  const n8nReady = n8n.configured && !n8n.error;
  const liveLeads = leads.filter((lead) => !inactiveLeadStatuses.includes(String(lead.status).toLowerCase()));
  const newLeads = leads.filter((lead) => String(lead.status).toLowerCase() === "new").length;
  const warmLeads = leads.filter((lead) => String(lead.score).toLowerCase() === "warm").length;
  const hotLeads = leads.filter((lead) => ["hot", "qualified"].includes(String(lead.score || lead.status).toLowerCase())).length;
  const missingImages = properties.filter((property) => !property.drive_photos_link).length;
  const missingPhones = leads.filter((lead) => !lead.phone).length;
  const activeProperties = properties.filter((property) => String(property.status || "active").toLowerCase() === "active").length;
  const acceptedCampaigns = campaigns.reduce((total, campaign) => total + campaign.accepted, 0);
  const failedCampaigns = campaigns.reduce((total, campaign) => total + campaign.failed, 0);
  const activeFollowUpLeads = liveLeads.filter((lead) => Number(lead.follow_up_stage || 0) < 4);
  const followUpLeads = activeFollowUpLeads.length;
  const healthScore =
    100 -
    (missingImages ? 12 : 0) -
    (!supabaseReady ? 20 : 0) -
    (!n8nReady ? 12 : 0) -
    (failedCampaigns ? 10 : 0) -
    (missingPhones ? 6 : 0);
  const visibleLeads = leads.slice(0, 5);
  const visibleCampaigns = campaigns.slice(0, 4);
  const workflowRows = n8n.workflows.slice(0, 5);
  const missingImageRows = properties.filter((property) => !property.drive_photos_link).slice(0, 4);
  const failedCampaignRows = campaigns.filter((campaign) => campaign.failed > 0).slice(0, 3);
  const pipelineCounts = [newLeads, warmLeads, hotLeads, followUpLeads, campaigns.length];
  const pipelineMax = Math.max(1, ...pipelineCounts);
  const attentionItems = [
    !supabaseReady
      ? {
          label: "Supabase schema not live",
          detail: supabase.configured
            ? `Missing or inaccessible table(s): ${supabase.tables.filter((table) => !table.ready).map((table) => table.table).join(", ")}. Run the schema SQL before using live data.`
            : "Supabase env vars are not visible to production.",
          href: "/dashboard/settings",
          tone: "danger",
        }
      : null,
    missingImages
      ? {
          label: "Property images needed",
          detail: `${missingImages} active catalog item(s) need Google Drive image links so Maia can show the right media.`,
          href: "/dashboard/limitless/media",
          tone: "warning",
        }
      : null,
    failedCampaigns
      ? {
          label: "Campaign failures found",
          detail: `${failedCampaigns} immediate WhatsApp failure(s) are recorded in recent campaign reports.`,
          href: "/dashboard/limitless/campaigns",
          tone: "danger",
        }
      : null,
    missingPhones
      ? {
          label: "Lead phone cleanup",
          detail: `${missingPhones} lead(s) cannot receive WhatsApp messages until their phone numbers are fixed.`,
          href: "/dashboard/limitless/leads",
          tone: "warning",
        }
      : null,
    !n8nReady
      ? {
          label: "n8n visibility needs attention",
          detail: n8n.configured ? n8n.error || "n8n is configured but the workflow check did not pass." : "n8n variables are not visible to the dashboard.",
          href: "/dashboard/automations",
          tone: "danger",
        }
      : null,
  ].filter(Boolean) as { label: string; detail: string; href: string; tone: string }[];

  return (
    <div className="admin-page">
      <section className="admin-hero-panel">
        <div>
          <p className="admin-kicker">Live Control Center</p>
          <h1>Good day, Limitless Admin</h1>
          <p>
            Maia is running as the live operating system for Limitless Realty. You have {hotLeads} hot/qualified lead(s),
            {missingImages} propert{missingImages === 1 ? "y" : "ies"} missing images, and {n8n.activeWorkflows} active
            n8n workflow(s) visible from this console.
          </p>
          <div className="admin-hero-actions">
            <a href="/dashboard/limitless/leads">Review leads</a>
            <a href="/dashboard/limitless/properties">Update properties</a>
          </div>
        </div>
        <div className="admin-launch-score">
          <span>{Math.max(0, healthScore)}%</span>
          <p>System health</p>
        </div>
      </section>

      <div className="admin-metric-grid">
        <MetricCard icon={Users} tone="cyan" label="Total leads" value={leads.length} detail={`${hotLeads} hot/qualified`} trend="+ live CRM" />
        <MetricCard icon={Building2} tone="emerald" label="Active properties" value={activeProperties} detail={`${missingImages} missing image links`} trend="catalog" />
        <MetricCard icon={Send} tone="amber" label="WhatsApp accepted" value={acceptedCampaigns} detail={`${failedCampaigns} immediate failures`} trend="campaigns" />
        <MetricCard icon={Bot} tone="violet" label="Active workflows" value={n8n.activeWorkflows} detail={n8n.configured ? "Live n8n check" : "n8n env not set"} trend="n8n" />
      </div>

      <div className="admin-grid dashboard-main">
        <section className="admin-panel admin-chart-panel">
          <div className="admin-panel-header">
            <div>
              <h2>Lead Pipeline</h2>
              <p>Current CRM signal from Maia conversations.</p>
            </div>
            <span className={supabaseReady ? "admin-status live" : "admin-status warning"}>
              {supabaseReady ? "Supabase live" : "Schema pending"}
            </span>
          </div>
          <div className="admin-pipeline-bars" aria-label="Lead pipeline chart">
            {pipelineLabels.map((label, index) => (
              <div key={label} style={{ "--bar-height": `${Math.max(12, Math.round((pipelineCounts[index] / pipelineMax) * 86))}%` } as CSSProperties}>
                <strong>{pipelineCounts[index]}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-panel admin-ring-panel">
          <div className="admin-panel-header">
            <div>
              <h2>Maia Health</h2>
              <p>Live operating checks.</p>
            </div>
          </div>
          <div className="admin-health-ring">
            <span>{Math.max(0, healthScore)}%</span>
          </div>
          <div className="admin-mini-legend">
            <span><i className="dot cyan" /> Supabase {supabaseReady ? "ready" : "pending"}</span>
            <span><i className="dot amber" /> {followUpLeads} leads in sequence</span>
            <span><i className="dot rose" /> {missingImages} missing images</span>
          </div>
        </section>
      </div>

      <div className="admin-grid three">
        <section className="admin-panel admin-live-panel">
          <div className="admin-panel-header">
            <div>
              <h2>Attention Queue</h2>
              <p>Items that need action before the system can operate cleanly.</p>
            </div>
          </div>
          <div className="admin-list">
            {attentionItems.map((item) => (
              <a key={item.label} className={`admin-list-row compact attention-${item.tone}`} href={item.href}>
                <div>
                  <strong>{item.label}</strong>
                  <span>{item.detail}</span>
                </div>
                <em>open</em>
              </a>
            ))}
            {!attentionItems.length ? (
              <div className="admin-list-row compact attention-good">
                <div>
                  <strong>No urgent issue found</strong>
                  <span>Core live checks are currently clean from the data visible to the dashboard.</span>
                </div>
                <em>clean</em>
              </div>
            ) : null}
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <h2>Live Safeguards</h2>
              <p>Controls that reduce accidental client-facing errors.</p>
            </div>
          </div>
          <div className="admin-checklist upgraded">
            <span><ShieldCheck size={16} /> Campaign sends stay behind Telegram approval</span>
            <span><CheckCircle2 size={16} /> Viewing reminders are not part of this dashboard</span>
            <span><Clock3 size={16} /> Follow-ups remain per-lead, not repeated hourly</span>
            <span><AlertTriangle size={16} /> Failed sends surface here for review</span>
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <h2>Missing Media</h2>
              <p>Properties Maia cannot show images for yet.</p>
            </div>
            <a className="admin-outline-link" href="/dashboard/limitless/media">Open media</a>
          </div>
          <div className="admin-list">
            {missingImageRows.map((property) => (
              <div key={property.id} className="admin-list-row compact">
                <div>
                  <strong>{property.title}</strong>
                  <span>{[property.location_area, property.location_city].filter(Boolean).join(", ") || "No location saved"}</span>
                </div>
                <em>missing</em>
              </div>
            ))}
            {!missingImageRows.length ? <p className="admin-empty">All visible properties have image links.</p> : null}
          </div>
        </section>
      </div>

      <div className="admin-grid three">
        <section className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <h2>Daily Operations</h2>
              <p>Review these before sending campaigns or handing leads to sales.</p>
            </div>
          </div>
          <div className="admin-checklist upgraded">
            <span><CheckCircle2 size={16} /> Check new and hot leads</span>
            <span><CheckCircle2 size={16} /> Confirm active properties are accurate</span>
            <span><Clock3 size={16} /> Review follow-up sequence counts</span>
            <span><Image size={16} /> Fix missing property image links</span>
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <h2>Campaign Pulse</h2>
              <p>Latest WhatsApp campaign summaries.</p>
            </div>
          </div>
          <div className="admin-list">
            {visibleCampaigns.map((campaign) => (
              <div key={campaign.id} className="admin-list-row compact">
                <div>
                  <strong>{campaign.campaign_topic}</strong>
                  <span>{campaign.accepted} accepted / {campaign.failed} failed / {campaign.skipped} skipped</span>
                </div>
                <em>{campaign.attempted}</em>
              </div>
            ))}
            {!visibleCampaigns.length ? <p className="admin-empty">No campaign reports yet.</p> : null}
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <h2>Workflow Watch</h2>
              <p>n8n automation visibility.</p>
            </div>
          </div>
          <div className="admin-list">
            {workflowRows.map((workflow) => (
              <div key={workflow.id} className="admin-list-row compact">
                <div>
                  <strong>{workflow.name}</strong>
                  <span>{workflow.id}</span>
                </div>
                <em className={workflow.active ? "good" : "muted"}>{workflow.active ? "active" : "off"}</em>
              </div>
            ))}
            {!workflowRows.length ? <p className="admin-empty">{n8n.configured ? "No workflows returned." : "n8n credentials are not configured."}</p> : null}
          </div>
        </section>
      </div>

      {failedCampaignRows.length ? (
        <section className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <h2>Recent Send Failures</h2>
              <p>These need review before retrying any outbound WhatsApp message.</p>
            </div>
            <a className="admin-outline-link" href="/dashboard/limitless/campaigns">Open campaigns</a>
          </div>
          <div className="admin-list">
            {failedCampaignRows.map((campaign) => (
              <div key={campaign.id} className="admin-list-row compact attention-danger">
                <div>
                  <strong>{campaign.campaign_topic}</strong>
                  <span>{campaign.failed} failed / {campaign.accepted} accepted / {campaign.skipped} skipped</span>
                </div>
                <em>{campaign.created_at ? new Date(campaign.created_at).toLocaleDateString() : "review"}</em>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h2>Activity Feed</h2>
            <p>Recent lead and automation signals for the Limitless Realty system.</p>
          </div>
          <a className="admin-outline-link" href="/dashboard/limitless/leads">Open CRM</a>
        </div>
        <div className="admin-feed">
          {visibleLeads.map((lead) => (
            <div key={lead.id} className="admin-feed-row">
              <span className="admin-avatar">{String(lead.name || "?").slice(0, 1).toUpperCase()}</span>
              <div>
                <strong>{lead.name || "Unknown lead"}</strong>
                <p>{lead.phone || "No phone"} / {lead.location_preference || "location pending"} / {lead.budget || "budget pending"}</p>
              </div>
              <em>{lead.score || lead.status || "new"}</em>
            </div>
          ))}
          {!visibleLeads.length ? <p className="admin-empty">No leads loaded yet.</p> : null}
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h2>Automation Projects</h2>
            <p>Limitless now, reusable for future client systems.</p>
          </div>
        </div>
        <div className="admin-list">
          {automationProjects.map((project) => (
            <div key={project.id} className="admin-list-row">
              <div>
                <strong>{project.name}</strong>
                <span>{project.description}</span>
              </div>
              <em>{project.status}</em>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
