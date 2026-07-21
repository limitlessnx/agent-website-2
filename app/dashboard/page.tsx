import MetricCard from "@/components/admin/MetricCard";
import type { CSSProperties } from "react";
import { Bot, Building2, CheckCircle2, Clock3, Image, Send, Users } from "lucide-react";
import { automationProjects, getCampaignReports, getLeads, getN8nStatus, getProperties, isSupabaseConfigured } from "@/lib/limitless-data";

export default async function DashboardPage() {
  const [leads, properties, campaigns, n8n] = await Promise.all([
    getLeads(100),
    getProperties(100),
    getCampaignReports(20),
    getN8nStatus(),
  ]);
  const hotLeads = leads.filter((lead) => ["hot", "qualified"].includes(String(lead.score || lead.status).toLowerCase())).length;
  const missingImages = properties.filter((property) => !property.drive_photos_link).length;
  const activeProperties = properties.filter((property) => String(property.status || "active").toLowerCase() === "active").length;
  const acceptedCampaigns = campaigns.reduce((total, campaign) => total + campaign.accepted, 0);
  const failedCampaigns = campaigns.reduce((total, campaign) => total + campaign.failed, 0);
  const followUpLeads = leads.filter((lead) => Number(lead.follow_up_stage || 0) > 0).length;
  const launchScore =
    100 -
    (missingImages ? 12 : 0) -
    (!isSupabaseConfigured() ? 20 : 0) -
    (!n8n.configured ? 10 : 0) -
    (failedCampaigns ? 8 : 0);
  const visibleLeads = leads.slice(0, 5);
  const visibleCampaigns = campaigns.slice(0, 4);
  const workflowRows = n8n.workflows.slice(0, 5);

  return (
    <div className="admin-page">
      <section className="admin-hero-panel">
        <div>
          <p className="admin-kicker">Control Center</p>
          <h1>Good day, Limitless Admin</h1>
          <p>
            Maia is being prepared for launch. You have {hotLeads} hot/qualified lead(s), {missingImages} propert{missingImages === 1 ? "y" : "ies"} missing images,
            and {n8n.activeWorkflows} active n8n workflow(s) visible from this console.
          </p>
          <div className="admin-hero-actions">
            <a href="/dashboard/limitless/leads">Review leads</a>
            <a href="/dashboard/limitless/properties">Update properties</a>
          </div>
        </div>
        <div className="admin-launch-score">
          <span>{Math.max(0, launchScore)}%</span>
          <p>Launch readiness</p>
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
            <span className={isSupabaseConfigured() ? "admin-status live" : "admin-status warning"}>
              {isSupabaseConfigured() ? "Supabase connected" : "Fallback data"}
            </span>
          </div>
          <div className="admin-pipeline-bars" aria-label="Lead pipeline chart">
            <div style={{ "--bar-height": "74%" } as CSSProperties}><span>New</span></div>
            <div style={{ "--bar-height": "52%" } as CSSProperties}><span>Warm</span></div>
            <div style={{ "--bar-height": "38%" } as CSSProperties}><span>Hot</span></div>
            <div style={{ "--bar-height": "64%" } as CSSProperties}><span>Follow-up</span></div>
            <div style={{ "--bar-height": "45%" } as CSSProperties}><span>Campaign</span></div>
          </div>
        </section>

        <section className="admin-panel admin-ring-panel">
          <div className="admin-panel-header">
            <div>
              <h2>Maia Health</h2>
              <p>Launch-critical readiness checks.</p>
            </div>
          </div>
          <div className="admin-health-ring">
            <span>{Math.max(0, launchScore)}%</span>
          </div>
          <div className="admin-mini-legend">
            <span><i className="dot cyan" /> Supabase {isSupabaseConfigured() ? "ready" : "pending"}</span>
            <span><i className="dot amber" /> {followUpLeads} leads in sequence</span>
            <span><i className="dot rose" /> {missingImages} missing images</span>
          </div>
        </section>
      </div>

      <div className="admin-grid three">
        <section className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <h2>Today&apos;s Mission</h2>
              <p>Finish these before the live client demo.</p>
            </div>
          </div>
          <div className="admin-checklist upgraded">
            <span><CheckCircle2 size={16} /> WhatsApp template campaigns outside 24h</span>
            <span><CheckCircle2 size={16} /> Viewing reminders removed</span>
            <span><Clock3 size={16} /> Verify follow-up sequence timing</span>
            <span><Image size={16} /> Add property image links</span>
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
