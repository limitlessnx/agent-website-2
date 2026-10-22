import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  Bot,
  CalendarDays,
  ChevronRight,
  Megaphone,
  MessageCircle,
  Plus,
  Users,
} from "@/components/admin/ServerIcons";
import type { PhotographyDashboardData } from "@/lib/photography-dashboard";
import { photographyBookingStatus, photographyCustomerStage } from "@/lib/photography-dashboard";

type Props = { data: PhotographyDashboardData };

function Action({ href, label, description, icon: Icon }: { href: string; label: string; description: string; icon: typeof Plus }) {
  return <Link className="exposure-action" href={href}><span className="exposure-action-icon"><Icon size={18} /></span><span><strong>{label}</strong><small>{description}</small></span><ChevronRight size={15} /></Link>;
}

export default function PhotographyDashboard({ data }: Props) {
  const upcoming = data.bookings.filter((booking) => !["cancelled", "completed"].includes(booking.status.toLowerCase())).slice(0, 4);
  const stages = ["New enquiry", "Follow-up", "Booked", "Client"];
  const activeCustomers = data.customers.filter((customer) => customer.status !== "inactive");
  const activeAgents = data.agents.filter((agent) => ["published", "testing", "active"].includes(agent.status.toLowerCase()));
  return <main className="portal-page exposure-dashboard">
    <section className="exposure-hero">
      <div><p className="portal-kicker">Photography studio workspace</p><h1>Good morning, {data.businessName} <span aria-hidden="true">👋</span></h1><p>Here’s what’s happening with your studio today.</p></div>
      <div className={`exposure-connect ${data.whatsappConnected ? "is-live" : "is-pending"}`}><span /><div><small>Maia · WhatsApp Concierge</small><strong>{data.whatsappConnected ? "Online and ready" : "Setup in progress"}</strong></div><Link href="/portal/integrations" aria-label="Configure WhatsApp"><ArrowUpRight size={16} /></Link></div>
    </section>
    {!data.whatsappConnected ? <section className="exposure-setup"><div><p className="portal-kicker">Next step</p><strong>Connect WhatsApp to start handling studio enquiries.</strong><span>Fluxknight will configure Maia after your studio brief is reviewed.</span></div><Link className="portal-button" href="/portal/integrations">Connect WhatsApp <ArrowUpRight size={15} /></Link></section> : null}
    <section className="exposure-metrics" aria-label="Photography business overview">
      <article><span><Users size={16} /> New enquiries</span><strong>{activeCustomers.length}</strong><small>Client conversations</small></article>
      <article><span><CalendarDays size={16} /> Bookings confirmed</span><strong>{data.bookings.filter((booking) => booking.status.toLowerCase().includes("confirm")).length}</strong><small>Calendar records</small></article>
      <article><span><Activity size={16} /> Follow-ups due</span><strong>{data.customers.filter((customer) => photographyCustomerStage(customer) === "Follow-up").length}</strong><small>Needs attention</small></article>
      <article><span><Bot size={16} /> Shoots this week</span><strong>{upcoming.length}</strong><small>{data.fluxCredits === null ? "Flux Credits unavailable" : `${data.fluxCredits.toLocaleString("en-NG")} credits left`}</small></article>
    </section>
    <section className="exposure-actions" aria-label="Xposure quick actions">
      <Action href="/portal/customers" label="Add client" description="Capture a new enquiry" icon={Plus} />
      <Action href="/portal/appointments" label="New booking" description="Schedule a studio shoot" icon={CalendarDays} />
      <Action href="/portal/conversations" label="Open inbox" description="Reply to clients" icon={MessageCircle} />
      <Action href="/portal/catalogue" label="Studio catalogue" description="Manage packages and sets" icon={Activity} />
      <Action href="/portal/campaigns" label="Run campaign" description="Send a Meta template" icon={Megaphone} />
    </section>
    <section className="exposure-grid">
      <article className="exposure-panel"><header><div><p className="portal-kicker">Upcoming bookings</p><h2>Your next studio sessions</h2></div><Link href="/portal/appointments">View all <ChevronRight size={14} /></Link></header><div className="exposure-bookings">{upcoming.map((booking) => <div className="exposure-booking" key={booking.id}><span className="exposure-time">{booking.start_at ? new Date(booking.start_at).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" }) : "—"}</span><div><strong>{booking.title || "Studio session"}</strong><small>{booking.customer_name || "Client pending"}{booking.location ? ` · ${booking.location}` : ""}</small></div><em className={booking.status.toLowerCase().includes("confirm") ? "confirmed" : "pending"}>{photographyBookingStatus(booking.status)}</em></div>)}{!upcoming.length ? <p className="exposure-empty">No upcoming bookings yet. Your next confirmed sessions will appear here.</p> : null}</div></article>
      <article className="exposure-panel exposure-maia"><header><div><p className="portal-kicker">Maia · WhatsApp Concierge</p><h2>Your studio assistant</h2></div><span className="exposure-online"><i /> {data.whatsappConnected ? "Online" : "Not connected"}</span></header><div className="exposure-maia-stats"><div><strong>{data.customers.length}</strong><small>Client conversations</small></div><div><strong>{activeAgents.length}</strong><small>Active AI agents</small></div><div><strong>{data.workflows.filter((workflow) => workflow.status === "active").length}</strong><small>Automations</small></div></div><p>Maia can answer approved studio questions, qualify shoot enquiries, support bookings and hand complex requests to your team.</p><Link className="portal-button secondary" href="/portal/agents">Configure Maia <ArrowUpRight size={15} /></Link></article>
    </section>
    <section className="exposure-panel"><header><div><p className="portal-kicker">Clients & enquiries</p><h2>Client pipeline</h2></div><Link href="/portal/customers">View all <ChevronRight size={14} /></Link></header><div className="exposure-pipeline">{stages.map((stage) => <div className="exposure-pipeline-column" key={stage}><header><span>{stage}</span><strong>{data.customers.filter((customer) => photographyCustomerStage(customer) === stage).length}</strong></header>{data.customers.filter((customer) => photographyCustomerStage(customer) === stage).slice(0, 3).map((customer) => <Link href={`/portal/customers/${customer.id}`} key={customer.id}><strong>{customer.full_name}</strong><small>{customer.phone || customer.email || "Client details pending"}</small></Link>)}{!data.customers.some((customer) => photographyCustomerStage(customer) === stage) ? <small className="exposure-muted">No records</small> : null}</div>)}</div></section>
    <section className="exposure-panel"><header><div><p className="portal-kicker">Studio catalogue</p><h2>Showcase your shoot ideas</h2><p>Organize packages, categories and sample work for the team.</p></div><Link href="/portal/catalogue">Open catalogue <ChevronRight size={14} /></Link></header><div className="exposure-catalogue-grid">{data.catalogueCategories.map((category) => <Link href={`/portal/catalogue?category=${encodeURIComponent(category.name)}`} key={category.name}><img className="exposure-catalogue-art" src={category.image} alt="" /><span><strong>{category.name}</strong><small>{category.itemCount} studio items <ChevronRight size={13} /></small></span></Link>)}</div></section>
    <section className="exposure-footer-row"><div><span>Plan</span><strong>{data.planCode || "Free workspace"}</strong></div><div><span>Flux Credits</span><strong>{data.fluxCredits === null ? "Unavailable" : data.fluxCredits.toLocaleString("en-NG")}</strong></div><Link className="portal-button secondary" href="/portal/billing">View plan <ChevronRight size={15} /></Link></section>
  </main>;
}
