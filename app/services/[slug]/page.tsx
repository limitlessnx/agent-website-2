import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle, MessageSquare, Workflow, BarChart2, ShieldCheck } from "@/components/admin/ServerIcons";

const services = {
  "ai-sales-agent": {
    title: "AI Sales Agent",
    eyebrow: "Revenue automation",
    summary: "Qualify demand, answer buying questions, book meetings and move serious prospects to your team without making every lead wait for a human reply.",
    problem: "Sales teams lose opportunities when enquiries arrive outside working hours, qualification is inconsistent, or follow-up depends on someone remembering to do it.",
    how: ["Capture the enquiry from the connected channel", "Understand intent and ask qualification questions", "Score the opportunity against your rules", "Answer approved product, pricing and objection questions", "Book or route the qualified prospect", "Write the conversation and outcome back to the CRM"],
    benefits: ["Faster first response", "Consistent qualification", "More booked appointments", "Less repetitive sales work", "Clearer visibility into hot leads"],
    dashboard: ["New leads", "Qualified leads", "Appointments booked", "Hot-lead alerts", "Conversation outcomes"],
    channels: "WhatsApp · Web chat · Email · Voice · Telegram",
  },
  "ai-customer-support": {
    title: "AI Customer Support Agent",
    eyebrow: "Customer experience",
    summary: "Give customers instant answers, handle routine requests and escalate the conversations that genuinely need a human.",
    problem: "Support queues grow when the same questions are answered repeatedly and staff have to search several systems before they can help a customer.",
    how: ["Receive the customer's question", "Search the approved knowledge and business rules", "Answer routine questions conversationally", "Collect missing information when needed", "Create or route an issue when a human is required", "Log the interaction for the team"],
    benefits: ["24/7 response coverage", "Lower repetitive workload", "Consistent answers", "Faster escalation", "Better customer history"],
    dashboard: ["Open conversations", "Resolved requests", "Escalations", "Response time", "Top support topics"],
    channels: "Web chat · WhatsApp · Telegram · Email",
  },
  whatsapp: {
    title: "WhatsApp AI Assistant",
    eyebrow: "WhatsApp automation",
    summary: "Turn WhatsApp from a messaging inbox into a structured customer, sales and support channel connected to your business workflows.",
    problem: "Valuable enquiries disappear inside busy WhatsApp chats when responses, qualification, follow-up and record keeping depend entirely on staff.",
    how: ["Connect the approved WhatsApp Business API number", "Receive and classify incoming messages", "Use the business context and knowledge base to respond", "Qualify, book, support or route the customer", "Trigger the next workflow when a condition is met", "Record the conversation and usage"],
    benefits: ["Faster WhatsApp replies", "Automated lead qualification", "Consistent customer support", "Workflow-triggered follow-up", "Media and document support where configured"],
    dashboard: ["WhatsApp conversations", "Leads captured", "Qualified leads", "Messages used", "Escalations"],
    channels: "WhatsApp Business Platform",
  },
  telegram: {
    title: "Telegram AI Assistant",
    eyebrow: "Telegram automation",
    summary: "Deploy an intelligent Telegram bot for customer conversations, lead capture, notifications, internal operations and automated workflows.",
    problem: "Telegram is powerful, but a basic bot often stops at commands. Fluxknight connects conversation, business logic and downstream workflows.",
    how: ["Connect the Telegram bot", "Receive and interpret messages or commands", "Apply business rules and AI reasoning", "Collect or update customer information", "Trigger workflows and notifications", "Keep an auditable activity trail"],
    benefits: ["Natural customer conversations", "Automated notifications", "Lead capture", "Internal team workflows", "Lower manual admin"],
    dashboard: ["Active chats", "Leads", "Bot events", "Workflow runs", "Escalations"],
    channels: "Telegram",
  },
  voice: {
    title: "AI Voice Agent",
    eyebrow: "Voice automation",
    summary: "Answer or place calls, qualify callers, book appointments and hand important conversations to your team with context already attached.",
    problem: "Missed calls and repetitive phone conversations cost businesses leads while staff spend time collecting the same information again and again.",
    how: ["Receive or initiate the call through the configured telephony provider", "Identify the purpose of the call", "Hold a natural conversation using approved business context", "Qualify, schedule or resolve the request", "Escalate when a human is required", "Save the call outcome and summary"],
    benefits: ["Fewer missed enquiries", "24/7 call coverage", "Consistent qualification", "Appointment booking", "Structured call summaries"],
    dashboard: ["Calls handled", "Minutes used", "Qualified callers", "Appointments", "Human handoffs"],
    channels: "Inbound voice · Outbound voice",
  },
  crm: {
    title: "CRM Automation",
    eyebrow: "Pipeline automation",
    summary: "Keep your CRM current by connecting lead capture, conversations, qualification, follow-up and sales activity into one workflow layer.",
    problem: "A CRM is only useful when its records are current. Manual data entry creates gaps between what happened with a customer and what the dashboard says happened.",
    how: ["Capture customer activity from connected channels", "Normalize and match the record", "Update fields and stages from events", "Trigger follow-up based on status", "Notify the right team member", "Report the pipeline state"],
    benefits: ["Cleaner CRM records", "Less manual entry", "Reliable follow-up", "Faster sales handoff", "Better pipeline visibility"],
    dashboard: ["Pipeline value", "New records", "Stage movement", "Follow-up due", "Automation activity"],
    channels: "CRM · WhatsApp · Web · Email · Voice · Telegram",
  },
  "lead-generation": {
    title: "Lead Generation Engine",
    eyebrow: "Prospecting automation",
    summary: "Find relevant prospects, enrich records, qualify them and pass sales-ready leads into the next workflow instead of leaving prospecting as a spreadsheet exercise.",
    problem: "Manual prospecting consumes hours and creates inconsistent lists, weak enrichment and slow handoff to sales.",
    how: ["Define the target market and qualification criteria", "Discover relevant public business prospects", "Enrich and deduplicate records", "Score or classify prospects", "Send qualified records into the selected workflow", "Trigger email, WhatsApp, Telegram or voice follow-up where configured"],
    benefits: ["Faster prospect discovery", "Cleaner lead lists", "Automatic qualification", "Connected outreach", "Sales-ready alerts"],
    dashboard: ["Prospects found", "Enriched records", "Qualified leads", "Campaign status", "Hot-lead alerts"],
    channels: "Web data · Email · CRM · WhatsApp · Telegram · Voice",
  },
  "calendar-email": {
    title: "Calendar & Email Automation",
    eyebrow: "Scheduling and outreach",
    summary: "Automate email sequences, reminders, booking flows and calendar-driven follow-up so opportunities keep moving.",
    problem: "Good prospects go cold when follow-up and scheduling depend on manual reminders.",
    how: ["Receive a lead or workflow event", "Choose the correct email sequence", "Send the appropriate message", "Track responses and timing", "Offer or confirm a booking", "Trigger the next action based on the outcome"],
    benefits: ["Reliable follow-up", "Fewer no-shows", "More booked meetings", "Less admin", "Better timing"],
    dashboard: ["Emails sent", "Replies", "Bookings", "Sequences active", "Follow-ups due"],
    channels: "Email · Calendar · CRM",
  },
  "email-follow-up": {
    title: "Email Follow-up Automation",
    eyebrow: "Nurture automation",
    summary: "Give cold, warm and hot leads different follow-up paths based on their behaviour, timing and qualification state.",
    problem: "A single generic follow-up sequence treats every prospect the same and leaves sales teams guessing who deserves attention first.",
    how: ["Receive or import the lead", "Classify the lead state", "Start the relevant sequence", "Branch based on replies and engagement", "Escalate high-intent leads", "Stop or change the sequence when the customer converts"],
    benefits: ["Personalized follow-up", "Better lead prioritization", "Less manual chasing", "Clear sales handoff", "Reusable campaigns"],
    dashboard: ["Active sequences", "Replies", "Warm leads", "Hot leads", "Conversions"],
    channels: "Email · CRM · Calendar",
  },
} as const;

export async function generateStaticParams() {
  return Object.keys(services).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const service = services[slug as keyof typeof services];
  return { title: service ? service.title : "Service", description: service?.summary };
}

export default async function ServiceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const service = services[slug as keyof typeof services];

  if (!service) {
    return <main style={{ minHeight: "100vh", background: "#090510", color: "#f7f0ff", padding: "180px 20px", textAlign: "center" }}><h1>Service not found</h1><Link href="/services" style={{ color: "#c084fc" }}>Back to services</Link></main>;
  }

  return (
    <main style={{ minHeight: "100vh", background: "#090510", color: "#f7f0ff", overflowX: "hidden" }}>
      <section style={{ padding: "150px 20px 86px", background: "radial-gradient(circle at 50% 0%,rgba(168,85,247,.18),transparent 44%),linear-gradient(180deg,#10091a 0%,#090510 100%)", borderBottom: "1px solid rgba(168,85,247,.22)" }}>
        <div style={{ maxWidth: 940, margin: "0 auto" }}>
          <p style={{ color: "#c084fc", fontSize: ".76rem", fontWeight: 900, letterSpacing: ".18em", textTransform: "uppercase", marginBottom: 16 }}>{service.eyebrow}</p>
          <h1 style={{ fontSize: "clamp(2.5rem,7vw,5.5rem)", lineHeight: .98, letterSpacing: "-.06em", margin: 0, maxWidth: 850 }}>{service.title}</h1>
          <p style={{ maxWidth: 760, margin: "24px 0 0", color: "#b9a8c9", fontSize: "clamp(1rem,2vw,1.2rem)", lineHeight: 1.75 }}>{service.summary}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 28 }}>
            {service.channels.split(" · ").map((channel) => <span key={channel} style={{ border: "1px solid rgba(168,85,247,.3)", background: "rgba(168,85,247,.08)", borderRadius: 999, padding: "8px 12px", color: "#d8c9e8", fontSize: ".82rem" }}>{channel}</span>)}
          </div>
          <Link href="/evaluation" style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 30, padding: "13px 20px", borderRadius: 11, background: "linear-gradient(135deg,#a855f7,#8b5cf6)", color: "white", textDecoration: "none", fontWeight: 900 }}>Have Fluxknight evaluate your business <ArrowRight size={16} /></Link>
        </div>
      </section>

      <section style={{ padding: "72px 20px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }} className="service-detail-grid">
          <article style={{ padding: 28, borderRadius: 18, background: "#10091a", border: "1px solid rgba(168,85,247,.24)" }}>
            <p style={{ color: "#c084fc", fontSize: ".72rem", fontWeight: 900, letterSpacing: ".14em", textTransform: "uppercase" }}>The business problem</p>
            <h2 style={{ fontSize: "1.7rem", letterSpacing: "-.03em" }}>What this solves</h2>
            <p style={{ color: "#b9a8c9", lineHeight: 1.75 }}>{service.problem}</p>
          </article>
          <article style={{ padding: 28, borderRadius: 18, background: "linear-gradient(135deg,rgba(168,85,247,.12),#10091a)", border: "1px solid rgba(168,85,247,.28)" }}>
            <p style={{ color: "#c084fc", fontSize: ".72rem", fontWeight: 900, letterSpacing: ".14em", textTransform: "uppercase" }}>Why it helps</p>
            <h2 style={{ fontSize: "1.7rem", letterSpacing: "-.03em" }}>Business outcomes</h2>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>{service.benefits.map((item) => <li key={item} style={{ display: "flex", gap: 10, color: "#d8c9e8", lineHeight: 1.55 }}><CheckCircle size={17} color="#c084fc" style={{ flexShrink: 0, marginTop: 2 }} />{item}</li>)}</ul>
          </article>
        </div>
      </section>

      <section style={{ padding: "20px 20px 76px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <p style={{ color: "#c084fc", fontSize: ".72rem", fontWeight: 900, letterSpacing: ".14em", textTransform: "uppercase" }}>How the system works</p>
          <h2 style={{ fontSize: "clamp(2rem,5vw,3.3rem)", letterSpacing: "-.05em", margin: "10px 0 30px" }}>From trigger to outcome.</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }} className="service-detail-steps">
            {service.how.map((step, index) => <div key={step} style={{ padding: 22, borderRadius: 16, background: "#10091a", border: "1px solid rgba(168,85,247,.22)" }}><div style={{ color: "#c084fc", fontWeight: 900, fontSize: ".75rem", marginBottom: 12 }}>0{index + 1}</div><p style={{ margin: 0, color: "#ddd2e8", lineHeight: 1.6 }}>{step}</p></div>)}
          </div>
        </div>
      </section>

      <section style={{ padding: "30px 20px 88px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px", borderRadius: 20, background: "#0d0715", border: "1px solid rgba(168,85,247,.28)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}><BarChart2 size={19} color="#c084fc" /><h2 style={{ margin: 0, fontSize: "1.35rem" }}>What the client dashboard can show</h2></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10 }} className="dashboard-preview-grid">
            {service.dashboard.map((item, index) => <div key={item} style={{ minHeight: 110, padding: 16, borderRadius: 13, background: "#140c20", border: "1px solid rgba(168,85,247,.2)" }}><div style={{ color: "#8f7ba4", fontSize: ".68rem", textTransform: "uppercase", letterSpacing: ".08em" }}>{item}</div><strong style={{ display: "block", marginTop: 18, fontSize: "1.55rem" }}>{index === 0 ? "128" : index === 1 ? "64" : index === 2 ? "24" : "12"}</strong><span style={{ color: "#8f7ba4", fontSize: ".72rem" }}>Live system metric</span></div>)}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 18, marginTop: 22, color: "#b9a8c9", fontSize: ".86rem" }}><span><Workflow size={15} style={{ verticalAlign: "middle", marginRight: 6 }} />Connected workflows</span><span><MessageSquare size={15} style={{ verticalAlign: "middle", marginRight: 6 }} />Connected channels</span><span><ShieldCheck size={15} style={{ verticalAlign: "middle", marginRight: 6 }} />Usage and access controls</span></div>
        </div>
      </section>

      <section style={{ padding: "70px 20px 110px", textAlign: "center", borderTop: "1px solid rgba(168,85,247,.18)" }}>
        <h2 style={{ fontSize: "clamp(1.8rem,5vw,3rem)", letterSpacing: "-.04em", marginBottom: 14 }}>Not sure which system you need?</h2>
        <p style={{ color: "#b9a8c9", maxWidth: 650, margin: "0 auto 24px", lineHeight: 1.7 }}>Start with the problem. Fluxknight will evaluate the requirement and recommend the right combination of agents, channels and workflows.</p>
        <Link href="/evaluation" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 22px", borderRadius: 11, background: "linear-gradient(135deg,#a855f7,#8b5cf6)", color: "white", textDecoration: "none", fontWeight: 900 }}>Start evaluation <ArrowRight size={16} /></Link>
      </section>

      <style>{`@media (max-width: 760px){.service-detail-grid{grid-template-columns:1fr!important}.service-detail-steps{grid-template-columns:1fr!important}.dashboard-preview-grid{grid-template-columns:repeat(2,1fr)!important}}`}</style>
    </main>
  );
}
