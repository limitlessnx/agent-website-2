import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  FileText,
  Home,
  LockKeyhole,
  Megaphone,
  MessageCircle,
  Plus,
  UserRound,
  Users,
  Workflow,
} from "@/components/admin/ServerIcons";
import type { OrganizationDashboardData } from "@/lib/organization-dashboard";
import { formatDashboardPrice, leadPipelineStatus } from "@/lib/organization-dashboard";
import { planIncludesFeature, type FluxFeatureKey } from "@/lib/fluxknight-plans";

type Props = { data: OrganizationDashboardData };
const money = (value: string | undefined) => value || "Value pending";
const date = (value?: string | null) => value ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Time pending";
const featureForAction: Record<string, FluxFeatureKey | undefined> = { "/portal/appointments": "core_ai_support", "/portal/billing": undefined };

function Action({ href, label, description, icon: Icon, locked }: { href: string; label: string; description: string; icon: typeof Plus; locked?: boolean }) {
  return <Link className={`estate-action ${locked ? "is-locked" : ""}`} href={locked ? "/pricing#plan-details" : href}>
    <span className="estate-action-icon"><Icon size={18} /></span><span><strong>{label}</strong><small>{locked ? "Available on a higher plan" : description}</small></span>{locked ? <LockKeyhole size={15} /> : <ChevronRight size={16} />}
  </Link>;
}

export default function OrganizationDashboard({ data }: Props) {
  const grouped = ["New Enquiries", "Qualified", "Viewing Scheduled", "Negotiation"].map((stage) => ({ stage, leads: data.leads.filter((lead) => leadPipelineStatus(lead) === stage).slice(0, 3) }));
  const activeProperties = data.properties.filter((property) => !["sold", "inactive"].includes(String(property.status || "").toLowerCase()));
  const scheduled = data.appointments.filter((item) => !["cancelled", "completed"].includes(item.status.toLowerCase())).slice(0, 4);
  const recent = data.runs.slice(0, 5);
  const businessPlus = data.planCode ? planIncludesFeature(data.planCode, "industry_database") : false;
  return <main className="portal-page estate-dashboard">
    <section className="estate-hero">
      <div><p className="portal-kicker">{data.industryName} workspace</p><h1>Welcome back, {data.businessName}</h1><p>{data.description}</p></div>
      <div className="estate-hero-status"><span className={data.whatsappConnected ? "live-dot" : "pending-dot"} /><div><small>WhatsApp automation</small><strong>{data.whatsappConnected ? "Connected" : "Setup in progress"}</strong></div></div>
    </section>
    {!data.whatsappConnected ? <section className="estate-setup-hint"><div><p className="portal-kicker">Next step</p><strong>Connect WhatsApp to start handling enquiries.</strong><span>Fluxknight configures the agent after your business information is reviewed.</span></div><Link className="portal-button" href="/portal/integrations">Connect WhatsApp <ArrowUpRight size={15} /></Link></section> : null}
    <section className="estate-metrics" aria-label="Business overview">
      <article><span><Home size={16} /> Total properties</span><strong>{activeProperties.length}</strong><small>Tenant catalog</small></article>
      <article><span><Users size={16} /> Total leads</span><strong>{data.leads.length}</strong><small>Known opportunities</small></article>
      <article><span><CalendarDays size={16} /> Viewings</span><strong>{scheduled.length}</strong><small>Upcoming records</small></article>
      <article><span><CircleDollarSign size={16} /> Flux Credits</span><strong>{data.fluxCredits === null ? "—" : data.fluxCredits.toLocaleString("en-NG")}</strong><small>{data.fluxCreditPercentUsed}% used this cycle</small></article>
    </section>
    <section className="estate-actions" aria-label="Quick actions">
      <Action href="/portal/systems" label="Add Property" description="Manage your property catalog" icon={Plus} locked={!businessPlus && activeProperties.length === 0} />
      <Action href="/portal/customers" label="Add Lead" description="Capture a new opportunity" icon={UserRound} />
      <Action href="/portal/appointments" label="Schedule Viewing" description="Open booking records" icon={CalendarDays} />
      <Action href="/portal/conversations" label="Send Message" description="Open customer conversations" icon={MessageCircle} />
      <Action href="/portal/systems" label="Create Listing" description="Prepare a property listing" icon={FileText} locked={!businessPlus} />
      <Action href="/portal/systems" label="Run Campaign" description="Review available automations" icon={Megaphone} locked={!data.planCode || !planIncludesFeature(data.planCode, "follow_ups")} />
    </section>
    <section className="estate-section-head"><div><p className="portal-kicker">Property listings</p><h2>Available properties</h2></div><Link href="/portal/systems">See all <ChevronRight size={15} /></Link></section>
    <section className="estate-property-grid">
      {activeProperties.slice(0, 4).map((property) => <article className="estate-property-card" key={property.id}>
        <div className="estate-property-image">{property.drive_photos_link ? <img src={property.drive_photos_link} alt="" /> : <Home size={30} />}</div>
        <div className="estate-property-body"><span className="estate-chip">{property.status || "Available"}</span><h3>{property.title}</h3><p>{[property.location_area, property.location_city].filter(Boolean).join(", ") || "Location pending"}</p><strong>{formatDashboardPrice(property.price)}</strong></div>
      </article>)}
      {!activeProperties.length ? <div className="estate-empty">No property records have been added yet. Your catalog will appear here after setup.</div> : null}
    </section>
    <section className="estate-two-column">
      <article className="estate-panel"><div className="estate-section-head"><div><p className="portal-kicker">Lead pipeline</p><h2>Opportunity movement</h2></div><Link href="/portal/customers">See all <ChevronRight size={15} /></Link></div><div className="estate-pipeline">{grouped.map(({ stage, leads }) => <div className="estate-pipeline-column" key={stage}><header><span>{stage}</span><strong>{data.leads.filter((lead) => leadPipelineStatus(lead) === stage).length}</strong></header>{leads.map((lead) => <Link href={`/portal/customers/${lead.id}`} key={lead.id}><strong>{lead.name}</strong><small>{[lead.property_type, lead.location_preference].filter(Boolean).join(" · ") || "Lead details pending"}</small></Link>)}{!leads.length ? <small className="estate-muted">No records</small> : null}</div>)}</div></article>
      <article className="estate-panel"><div className="estate-section-head"><div><p className="portal-kicker">Upcoming viewings</p><h2>Next appointments</h2></div><Link href="/portal/appointments">See all <ChevronRight size={15} /></Link></div><div className="estate-list">{scheduled.map((item) => <div key={item.id}><span className="estate-list-icon"><CalendarDays size={16} /></span><span><strong>{item.title}</strong><small>{date(item.start_at)}{item.customer_name ? ` · ${item.customer_name}` : ""}</small></span><em>{item.status.replaceAll("_", " ")}</em></div>)}{!scheduled.length ? <p className="estate-empty">No upcoming viewings recorded.</p> : null}</div></article>
    </section>
    <section className="estate-panel"><div className="estate-section-head"><div><p className="portal-kicker">Recent activity</p><h2>What your systems have been doing</h2></div><Link href="/portal/systems">See all <ChevronRight size={15} /></Link></div><div className="estate-list">{recent.map((run) => <div key={run.id}><span className="estate-list-icon"><Activity size={16} /></span><span><strong>{run.workflow_key.replaceAll("_", " ")}</strong><small>{date(run.created_at)}{run.duration_ms ? ` · ${run.duration_ms} ms` : ""}</small></span><em>{run.status.replaceAll("_", " ")}</em></div>)}{!recent.length ? <p className="estate-empty">No recent activity has been recorded yet.</p> : null}</div></section>
    <section className="estate-plan-row"><div><p className="portal-kicker">Plan access</p><h2>{data.planCode ? `${data.planCode} workspace` : "Free workspace"}</h2><p>Features remain visible while unavailable actions explain what unlocks them.</p></div><div><span className="estate-credit-bar"><i style={{ width: `${Math.min(100, Math.max(0, data.fluxCreditPercentUsed))}%` }} /></span><small>{data.fluxCredits === null ? "Usage unavailable" : `${data.fluxCreditPercentUsed}% Flux Credits used`}</small></div><Link className="portal-button secondary" href="/portal/billing">View plan <ChevronRight size={15} /></Link></section>
  </main>;
}
