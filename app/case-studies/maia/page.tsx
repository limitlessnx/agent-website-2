import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CalendarCheck2,
  CheckCircle2,
  Database,
  Mail,
  MessageSquareText,
  Network,
  UsersRound,
  Workflow,
} from "@/components/admin/ServerIcons";
import styles from "./page.module.css";

const maiaDescription =
  "See how Maia connects lead capture, qualification, WhatsApp and email follow-up, inspection scheduling, reminders, CRM, Leo admin visibility, and human handoff for real estate operations.";

export const metadata: Metadata = {
  title: "Maia Real Estate Automation Case Study",
  description: maiaDescription,
  alternates: { canonical: "/case-studies/maia" },
  openGraph: {
    type: "website",
    url: "/case-studies/maia",
    title: "Maia Real Estate Automation Case Study | Fluxknight",
    description: maiaDescription,
    siteName: "Fluxknight",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Maia real estate automation system by Fluxknight" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Maia Real Estate Automation Case Study | Fluxknight",
    description: maiaDescription,
    images: ["/og-image.png"],
  },
};

const capabilities = [
  { icon: MessageSquareText, title: "Lead capture", text: "Capture new enquiries immediately with the customer details needed for the next step." },
  { icon: CheckCircle2, title: "Lead qualification", text: "Collect budget, preferred location, property type, urgency, and buying intent before an agent takes over." },
  { icon: MessageSquareText, title: "WhatsApp follow-up", text: "Keep conversations moving when prospects pause, miss a reply, or need another prompt before booking." },
  { icon: Mail, title: "Email follow-up", text: "Continue nurturing qualified prospects through email when a longer-form update or reminder is useful." },
  { icon: CalendarCheck2, title: "Inspection scheduling", text: "Move qualified buyers toward inspections and appointments without repeated manual coordination." },
  { icon: Workflow, title: "Reminders", text: "Protect important next actions so inspection dates, follow-ups, and customer commitments do not disappear." },
  { icon: Database, title: "CRM", text: "Keep lead details, status, history, and next actions organized in one operational record." },
  { icon: Bot, title: "Leo admin", text: "Give administrators visibility into conversations, follow-up status, inspections, and leads that need attention." },
  { icon: UsersRound, title: "Human handoff", text: "Escalate the right conversations to an agent when judgement, negotiation, or closing requires a person." },
];

const journey = [
  ["01", "A buyer sends an enquiry", "Maia responds immediately and captures the conversation before interest goes cold."],
  ["02", "The lead is qualified", "Budget, intent, location, property preferences, and readiness are collected and organized."],
  ["03", "The right property conversation starts", "Relevant information can be shared while unsuitable or incomplete enquiries are clarified."],
  ["04", "Inspection moves forward", "Qualified prospects are guided toward a booking or inspection with the required details captured."],
  ["05", "Reminders protect the next step", "Maia keeps scheduled activity from relying entirely on an agent's memory."],
  ["06", "Follow-up continues across channels", "WhatsApp and email can keep the lead warm when they need more time or miss a response."],
  ["07", "CRM stays updated", "The lead record reflects what happened, what matters, and what should happen next."],
  ["08", "Leo gives the team visibility", "Admins can see where conversations are progressing and where human attention is needed."],
  ["09", "A human agent takes over", "The team enters with context instead of restarting the conversation from zero."],
];

export default function MaiaCaseStudyPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroGlow} />
        <div className={styles.shell}>
          <span className={styles.eyebrow}>Case study · Maia</span>
          <h1>A complete real estate automation system.</h1>
          <p>
            Maia connects lead capture, qualification, follow-up, inspection scheduling, reminders, CRM updates, Leo admin visibility, and human handoff into one operating flow.
          </p>
          <div className={styles.actions}>
            <Link className={styles.primary} href="/evaluation" data-cta="maia-case-study-evaluation">Evaluate My Business <ArrowRight size={17} /></Link>
            <Link className={styles.secondary} href="/#maia-case-study">Back to homepage</Link>
          </div>
        </div>
      </section>

      <section className={styles.problemSection}>
        <div className={styles.shell}>
          <div className={styles.heading}>
            <span className={styles.eyebrow}>The operational problem</span>
            <h2>Real estate leads are often lost between first enquiry and serious action.</h2>
            <p>Slow replies, forgotten follow-up, scattered customer details, missed inspections, and low admin visibility create friction long before an agent gets a chance to close.</p>
          </div>
          <div className={styles.problemGrid}>
            {["Leads wait too long for replies","Agents restart conversations from scratch","Follow-up depends on memory","Inspection coordination gets delayed","Customer information is scattered","Management cannot easily see what needs attention"].map((item) => (
              <article key={item}><CheckCircle2 size={18} /><span>{item}</span></article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.mapSection}>
        <div className={styles.shell}>
          <div className={styles.heading}>
            <span className={styles.eyebrow}>The Maia system</span>
            <h2>One connected flow from enquiry to human handoff.</h2>
            <p>The system is designed to keep the customer journey moving while preserving the moments where people should stay in control.</p>
          </div>
          <div className={styles.systemMap}>
            <div className={styles.orbitA} /><div className={styles.orbitB} />
            <div className={styles.center}><Network size={24} /><span>Real estate AI operating system</span><strong>Maia</strong><em><i /> Live workflow</em></div>
            {capabilities.map(({icon: Icon,title},index)=><div className={styles.mapNode} key={title} style={{"--i":index} as CSSProperties}><Icon size={16}/><span>{title}</span></div>)}
          </div>
        </div>
      </section>

      <section className={styles.capabilitiesSection}>
        <div className={styles.shell}>
          <div className={styles.heading}>
            <span className={styles.eyebrow}>What the complete system comprises</span>
            <h2>Every important part of the lead journey stays connected.</h2>
          </div>
          <div className={styles.capabilityGrid}>
            {capabilities.map(({icon:Icon,title,text})=><article key={title}><span className={styles.icon}><Icon size={19}/></span><h3>{title}</h3><p>{text}</p></article>)}
          </div>
        </div>
      </section>

      <section className={styles.journeySection}>
        <div className={styles.shell}>
          <div className={styles.heading}>
            <span className={styles.eyebrow}>Lead journey</span>
            <h2>What happens to one buyer from the first message onward.</h2>
          </div>
          <div className={styles.timeline}>
            {journey.map(([step,title,text])=><article key={step}><span>{step}</span><div><h3>{title}</h3><p>{text}</p></div></article>)}
          </div>
        </div>
      </section>

      <section className={styles.outcomesSection}>
        <div className={styles.shell}>
          <div className={styles.heading}>
            <span className={styles.eyebrow}>Business impact</span>
            <h2>What improves for the business and the buyer.</h2>
          </div>
          <div className={styles.outcomeColumns}>
            <article><h3>For the real estate business</h3>{["Faster responses","Better-qualified leads","Fewer forgotten prospects","More inspection opportunities progressing","Less repetitive agent work","Cleaner CRM records","Better management visibility","Smoother handoff to human agents"].map(item=><p key={item}><CheckCircle2 size={15}/>{item}</p>)}</article>
            <article><h3>For the buyer</h3>{["Quicker answers","Clearer next steps","Property information without repeated waiting","Easier inspection scheduling","Timely reminders","More consistent follow-up","Less need to repeat information","Human support when the conversation becomes serious"].map(item=><p key={item}><CheckCircle2 size={15}/>{item}</p>)}</article>
          </div>
        </div>
      </section>

      <section className={styles.leoSection}>
        <div className={styles.shell}>
          <div className={styles.leoCard}>
            <div><span className={styles.eyebrow}>Leo admin layer</span><h2>Automation with management visibility.</h2><p>Leo gives the team a control layer over what Maia is doing, helping administrators understand lead activity, follow-up status, scheduled inspections, and conversations that need human attention.</p></div>
            <div className={styles.leoPanel}><div><span className={styles.liveDot}/> Operations live</div><strong>12 leads progressing</strong><p>4 qualified · 3 inspections scheduled · 2 need human attention</p><small>Illustrative dashboard view · Lead context and next actions remain connected.</small></div>
          </div>
        </div>
      </section>

      <section className={styles.finalCta}>
        <div className={styles.shell}>
          <span className={styles.eyebrow}>Build around your operation</span>
          <h2>Want this kind of real estate system inside your business?</h2>
          <p>Start with the workflow you already have. Fluxknight maps where leads are being lost, where staff time is being wasted, and where automation can create useful leverage first.</p>
          <Link className={styles.primary} href="/evaluation" data-cta="maia-case-study-final">Evaluate My Business <ArrowRight size={17}/></Link>
        </div>
      </section>
    </main>
  );
}
