import Link from "next/link";
import Image from "next/image";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Bot,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Megaphone,
  MessageCircle,
  Plus,
  Users,
} from "@/components/admin/ServerIcons";
import type { PhotographyBooking, PhotographyDashboardData } from "@/lib/photography-dashboard";
import { photographyBookingStatus, photographyCustomerStage } from "@/lib/photography-dashboard";

type Props = { data: PhotographyDashboardData };

type ActionProps = {
  href: string;
  label: string;
  description: string;
  icon: typeof Plus;
  primary?: boolean;
};

function Action({ href, label, description, icon: Icon, primary = false }: ActionProps) {
  return <Link className={`exposure-action${primary ? " is-primary" : ""}`} href={href}>
    <span className="exposure-action-icon"><Icon size={18} /></span>
    <span><strong>{label}</strong><small>{description}</small></span>
    <ChevronRight size={15} />
  </Link>;
}

function hasStatus(value: string | null | undefined, statuses: string[]) {
  const normalized = String(value || "").toLowerCase();
  return statuses.some((status) => normalized.includes(status));
}

function bookingAttention(booking: PhotographyBooking) {
  if (booking.metadataLoaded && !booking.assigned_photographer_id) return "Unassigned photographer";
  if (hasStatus(booking.deposit_status, ["pending", "outstanding", "due"])) return "Deposit outstanding";
  if (hasStatus(booking.delivery_status, ["overdue"])) return "Delivery overdue";
  return null;
}

function bookingDetail(booking: PhotographyBooking) {
  return [booking.customer_name || "Client pending", booking.location].filter(Boolean).join(" · ");
}

export default function PhotographyDashboard({ data }: Props) {
  const activeBookings = data.bookings.filter((booking) => !["cancelled", "completed"].includes(booking.status.toLowerCase()));
  const upcoming = activeBookings.slice(0, 4);
  const stages = ["New enquiry", "Follow-up", "Booked", "Client"];
  const activeCustomers = data.customers.filter((customer) => customer.status !== "inactive");
  const followUps = data.customers.filter((customer) => photographyCustomerStage(customer) === "Follow-up");
  const attentionBookings = activeBookings.filter((booking) => bookingAttention(booking)).slice(0, 4);
  const activeAgents = data.agents.filter((agent) => ["published", "testing", "active"].includes(agent.status.toLowerCase()));
  const confirmedBookings = data.bookings.filter((booking) => booking.status.toLowerCase().includes("confirm"));

  return <main className="portal-page exposure-dashboard">
    <section className="exposure-hero">
      <div><p className="portal-kicker">Photography studio workspace</p><h1>Good morning, {data.businessName} <span aria-hidden="true">👋</span></h1><p>Keep today’s shoots, client replies and fulfilment moving.</p></div>
      <div className={`exposure-connect ${data.whatsappConnected ? "is-live" : "is-pending"}`}><span /><div><small>Maia · WhatsApp Concierge</small><strong>{data.whatsappConnected ? "Online and ready" : "Setup in progress"}</strong></div><Link href="/portal/integrations" aria-label="Configure WhatsApp"><ArrowUpRight size={16} /></Link></div>
    </section>

    {!data.whatsappConnected ? <section className="exposure-setup"><div><p className="portal-kicker">Next step</p><strong>Connect WhatsApp to start handling studio enquiries.</strong><span>Fluxknight will configure Maia after your studio brief is reviewed.</span></div><Link className="portal-button" href="/portal/integrations">Connect WhatsApp <ArrowUpRight size={15} /></Link></section> : null}

    <section className="exposure-metrics" aria-label="Photography business overview">
      <article><span><Users size={16} /> New enquiries</span><strong>{activeCustomers.length}</strong><small>Client conversations</small></article>
      <article><span><CalendarDays size={16} /> Bookings confirmed</span><strong>{confirmedBookings.length}</strong><small>Calendar records</small></article>
      <article className={followUps.length ? "is-attention" : ""}><span><Activity size={16} /> Follow-ups due</span><strong>{followUps.length}</strong><small>{followUps.length ? "Needs attention" : "No follow-ups due"}</small></article>
      <article><span><Bot size={16} /> Shoots this week</span><strong>{upcoming.length}</strong><small>{data.fluxCredits === null ? "Flux Credits unavailable" : `${data.fluxCredits.toLocaleString("en-NG")} credits left`}</small></article>
    </section>

    <section className="exposure-actions" aria-label="Xposure quick actions">
      <Action href="/portal/appointments/new" label="New booking" description="Schedule a studio shoot" icon={CalendarDays} primary />
      <Action href="/portal/conversations" label="Open inbox" description="Reply to clients" icon={MessageCircle} primary />
      <Action href="/portal/customers" label="Add client" description="Capture a new enquiry" icon={Plus} />
      <Action href="/portal/catalogue" label="Studio catalogue" description="Manage packages and sets" icon={Activity} />
      <Action href="/portal/campaigns" label="Run campaign" description="Send a Meta template" icon={Megaphone} />
    </section>

    <section className="exposure-priority-grid">
      <article className="exposure-panel">
        <header><div><p className="portal-kicker">Upcoming bookings</p><h2>What is next</h2><p>Prioritised from your studio calendar.</p></div><Link href="/portal/appointments">View calendar <ChevronRight size={14} /></Link></header>
        <div className="exposure-bookings">{upcoming.map((booking) => <Link className="exposure-booking" href={`/portal/appointments/${booking.id}`} key={booking.id}><span className="exposure-time">{booking.start_at ? new Date(booking.start_at).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" }) : "—"}</span><div><strong>{booking.title || "Studio session"}</strong><small>{bookingDetail(booking)}</small></div><em className={booking.status.toLowerCase().includes("confirm") ? "confirmed" : "pending"}>{photographyBookingStatus(booking.status)}</em></Link>)}{!upcoming.length ? <p className="exposure-empty"><CalendarDays size={18} /> No upcoming shoots yet. Create your first booking to see it here.</p> : null}</div>
      </article>

      <article className="exposure-panel exposure-attention-panel">
        <header><div><p className="portal-kicker">Needs attention</p><h2>Keep work moving</h2><p>Only supported follow-up and booking signals appear here.</p></div><Link href="/portal/notifications">View all <ChevronRight size={14} /></Link></header>
        <div className="exposure-attention-list">
          {followUps.slice(0, 3).map((customer) => <Link className="exposure-attention-item" href={`/portal/customers/${customer.id}`} key={`follow-up-${customer.id}`}><span className="exposure-attention-icon"><MessageCircle size={16} /></span><span><strong>Reply to {customer.full_name}</strong><small>Client follow-up is due</small></span><ChevronRight size={15} /></Link>)}
          {attentionBookings.map((booking) => <Link className="exposure-attention-item" href={`/portal/appointments/${booking.id}`} key={`booking-${booking.id}`}><span className="exposure-attention-icon"><AlertTriangle size={16} /></span><span><strong>{bookingAttention(booking)}</strong><small>{booking.title || "Studio session"} · {bookingDetail(booking)}</small></span><ChevronRight size={15} /></Link>)}
          {!followUps.length && !attentionBookings.length ? <div className="exposure-empty"><CheckCircle2 size={18} /> Nothing urgent right now.</div> : null}
        </div>
      </article>
    </section>

    <article className="exposure-panel exposure-maia"><header><div><p className="portal-kicker">Maia · WhatsApp Concierge</p><h2>Your studio assistant</h2></div><span className="exposure-online"><i /> {data.whatsappConnected ? "Online" : "Not connected"}</span></header><div className="exposure-maia-stats"><div><strong>{data.customers.length}</strong><small>Client conversations</small></div><div><strong>{activeAgents.length}</strong><small>Active AI agents</small></div><div><strong>{data.workflows.filter((workflow) => workflow.status === "active").length}</strong><small>Automations</small></div></div><p>Maia can answer approved studio questions, qualify shoot enquiries, support bookings and hand complex requests to your team.</p><Link className="portal-button secondary" href="/portal/agents">Configure Maia <ArrowUpRight size={15} /></Link></article>

    <section className="exposure-panel exposure-pipeline-panel"><header><div><p className="portal-kicker">Clients & enquiries</p><h2>Client pipeline</h2><p>Move conversations from enquiry to booked session.</p></div><Link href="/portal/customers">View all <ChevronRight size={14} /></Link></header><div className="exposure-pipeline" role="list" aria-label="Client pipeline stages">{stages.map((stage) => <div className="exposure-pipeline-column" key={stage} role="listitem"><header><span>{stage}</span><strong>{data.customers.filter((customer) => photographyCustomerStage(customer) === stage).length}</strong></header>{data.customers.filter((customer) => photographyCustomerStage(customer) === stage).slice(0, 3).map((customer) => <Link href={`/portal/customers/${customer.id}`} key={customer.id}><strong>{customer.full_name}</strong><small>{customer.phone || customer.email || "Client details pending"}</small></Link>)}{!data.customers.some((customer) => photographyCustomerStage(customer) === stage) ? <small className="exposure-muted">No records</small> : null}</div>)}</div></section>

    <section className="exposure-panel exposure-supporting-panel"><header><div><p className="portal-kicker">Studio catalogue</p><h2>Showcase your shoot ideas</h2><p>Organize packages, categories and sample work for the team.</p></div><Link href="/portal/catalogue">Open catalogue <ChevronRight size={14} /></Link></header><div className="exposure-catalogue-grid">{data.catalogueCategories.map((category) => <Link href={`/portal/catalogue?category=${encodeURIComponent(category.name)}`} key={category.name}><Image className="exposure-catalogue-art" src={category.image} alt="" width={47} height={47} /><span><strong>{category.name}</strong><small>{category.itemCount} studio items <ChevronRight size={13} /></small></span></Link>)}</div></section>
    <section className="exposure-footer-row"><div><span>Plan</span><strong>{data.planCode || "Free workspace"}</strong></div><div><span>Flux Credits</span><strong>{data.fluxCredits === null ? "Unavailable" : data.fluxCredits.toLocaleString("en-NG")}</strong></div><Link className="portal-button secondary" href="/portal/billing">View plan <ChevronRight size={15} /></Link></section>
  </main>;
}
