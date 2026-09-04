import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CalendarCheck2,
  CheckCircle2,
  Database,
  Mail,
  MessageSquareText,
  UsersRound,
  Workflow,
} from "@/components/admin/ServerIcons";
import MaiaSystemRing from "@/components/MaiaSystemRing";
import styles from "./page.module.css";

const maiaDescription =
  "See how a real estate company can use Maia to connect enquiries, lead qualification, campaigns, follow-up, scheduling, relationship automation, CRM, admin visibility, and human handoff in one operating system.";

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
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Maia real estate automation system by Fluxknight" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Maia Real Estate Automation Case Study | Fluxknight",
    description: maiaDescription,
    images: ["/twitter-image"],
  },
};

const capabilities = [
  { icon: MessageSquareText, title: "Inquiry handling", text: "Answer common property questions immediately and understand what the buyer needs before the conversation stalls." },
  { icon: MessageSquareText, title: "Lead capture", text: "Capture new enquiries immediately with the customer details needed for the next step." },
  { icon: CheckCircle2, title: "Lead qualification", text: "Collect budget, preferred location, property type, urgency, and buying intent before an agent takes over." },
  { icon: MessageSquareText, title: "WhatsApp follow-up", text: "Keep conversations moving when prospects pause, miss a reply, or need another prompt before booking." },
  { icon: Mail, title: "Email follow-up", text: "Continue nurturing qualified prospects through email when a longer-form update or reminder is useful." },
  { icon: Bot, title: "Support desk", text: "Handle routine support needs and route conversations that require staff attention without losing context." },
  { icon: CalendarCheck2, title: "Inspection scheduling", text: "Move qualified buyers toward inspections and appointments without repeated manual coordination." },
  { icon: Workflow, title: "Reminders", text: "Protect important next actions so inspection dates, follow-ups, and customer commitments do not disappear." },
  { icon: Database, title: "CRM", text: "Keep lead details, status, history, important dates, preferences, and next actions organized in one operational record." },
  { icon: Bot, title: "Leo admin", text: "Give administrators visibility into conversations, campaigns, follow-up status, inspections, and leads that need attention." },
  { icon: UsersRound, title: "Human handoff", text: "Escalate the right conversations to an agent when judgement, negotiation, or closing requires a person." },
];

const journey = [
  ["01", "A buyer sends an enquiry", "Maia responds immediately, answers initial questions, and captures the conversation before interest goes cold."],
  ["02", "The lead is qualified", "Budget, intent, location, property preferences, and readiness are collected and organized."],
  ["03", "The right property conversation starts", "Relevant information can be shared while unsuitable or incomplete enquiries are clarified."],
  ["04", "Inspection moves forward", "Qualified prospects are guided toward a booking or inspection with the required details captured."],
  ["05", "Reminders protect the next step", "Maia keeps scheduled activity from relying entirely on an agent's memory."],
  ["06", "Follow-up continues across channels", "WhatsApp and email can keep the lead warm when they need more time or miss a response."],
  ["07", "Support stays available", "Routine customer questions can be handled while cases needing staff attention are routed with context."],
  ["08", "CRM stays updated", "The lead record reflects what happened, what matters, important dates, preferences, and what should happen next."],
  ["09", "Leo gives the team visibility", "Admins can see where conversations are progressing, what campaigns are active, and where human attention is needed."],
  ["10", "A human agent takes over", "The team enters with context instead of restarting the conversation from zero."],
];

const relationshipAutomations = [
  {
    title: "New property campaigns",
    text: "When a new property or offer arrives, a real estate company can select relevant, eligible leads from the CRM and send a WhatsApp campaign through Maia instead of manually contacting every prospect.",
  },
  {
    title: "Personal client reminders",
    text: "Create a specific reminder for one customer based on what matters to that relationship, whether it is a promised follow-up, inspection date, document reminder, or a future check-in.",
  },
  {
    title: "Birthday messages",
    text: "Save a client's birthday in the CRM and let Maia send a personalized birthday greeting from the business automatically when the date arrives.",
  },
  {
    title: "Anniversary and seasonal greetings",
    text: "Automate meaningful relationship messages such as anniversaries, festive greetings, seasonal notes, and other dates that matter to the customer rather than contacting them only when the business wants another sale.",
  },
  {
    title: "Periodic relationship check-ins",
    text: "Schedule thoughtful periodic messages that keep the business present in the customer's mind without turning every interaction into a sales request.",
  },
  {
    title: "CRM-driven personalization",
    text: "Use stored preferences, previous enquiries, important dates, and customer history to determine what message should be sent, when it should be sent, and when a human should step in.",
  },
];

const industryExamples = [
  ["Photography", "Store a couple's wedding date and automatically send a thoughtful anniversary message each year. New photography packages or seasonal campaigns can also be shared with the right past clients."],
  ["Gyms & fitness", "Track member birthdays, membership milestones, renewal periods, missed visits, and personalized check-ins while staff step in when a member needs human support."],
  ["Hotels & hospitality", "Welcome returning guests, send seasonal greetings, re-engage previous guests with relevant offers, and keep booking conversations connected to guest history."],
  ["Professional & service businesses", "Remember customer preferences, important follow-up dates, completed jobs, anniversaries, and periodic check-ins so relationships continue after the first transaction."],
];

export default function MaiaCaseStudyPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroGlow} />
        <div className={styles.shell}>
          <span className={styles.eyebrow}>Case study · Real estate company</span>
          <h1>How a real estate company can run customer operations with Maia.</h1>
          <p>
            Maia connects enquiries, lead qualification, follow-up, campaigns, support, inspection scheduling, relationship reminders, CRM updates, admin visibility, and human handoff in one operating flow.
          </p>
          <div className={styles.actions}>
            <Link className={styles.primary} href="/pricing" data-cta="maia-case-study-pricing">See Business+ pricing <ArrowRight size={17} /></Link>
            <Link className={styles.secondary} href="/">Back to homepage</Link>
          </div>
          <div className={styles.heroImage} role="img" aria-label="Modern luxury real estate residence at dusk">
            <div className={styles.heroImageShade} />
            <div className={styles.heroImageCaption}>
              <span>Example operating environment</span>
              <strong>Real estate customer operations</strong>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.mapSection}>
        <div className={styles.shell}>
          <div className={styles.heading}>
            <span className={styles.eyebrow}>The Maia system</span>
            <h2>See the complete operating flow.</h2>
            <p>Every animated connection below represents a part of the customer journey staying connected instead of operating as a separate tool or forgotten task.</p>
          </div>
          <MaiaSystemRing />
        </div>
      </section>

      <section className={styles.problemSection}>
        <div className={styles.shell}>
          <div className={styles.heading}>
            <span className={styles.eyebrow}>The operational problem</span>
            <h2>Real estate leads are often lost between first enquiry and serious action.</h2>
            <p>Slow replies, forgotten follow-up, scattered customer details, missed inspections, disconnected campaigns, and low admin visibility create friction long before an agent gets a chance to close.</p>
          </div>
          <div className={styles.problemGrid}>
            {["Leads wait too long for replies","Agents restart conversations from scratch","Follow-up depends on memory","Inspection coordination gets delayed","Customer information is scattered","Past customers are rarely nurtured after the sale"].map((item) => (
              <article key={item}><CheckCircle2 size={18} /><span>{item}</span></article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.capabilitiesSection}>
        <div className={styles.shell}>
          <div className={styles.heading}>
            <span className={styles.eyebrow}>What the system comprises</span>
            <h2>Eleven connected capabilities. One customer journey.</h2>
          </div>
          <div className={styles.capabilityGrid}>
            {capabilities.map(({icon:Icon,title,text})=><article key={title}><span className={styles.icon}><Icon size={19}/></span><h3>{title}</h3><p>{text}</p></article>)}
          </div>
        </div>
      </section>

      <section className={styles.journeySection}>
        <div className={styles.shell}>
          <div className={styles.heading}>
            <span className={styles.eyebrow}>How it works</span>
            <h2>What happens to one buyer from the first message onward.</h2>
          </div>
          <div className={styles.timeline}>
            {journey.map(([step,title,text])=><article key={step}><span>{step}</span><div><h3>{title}</h3><p>{text}</p></div></article>)}
          </div>
        </div>
      </section>

      <section className={styles.relationshipSection}>
        <div className={styles.shell}>
          <div className={styles.heading}>
            <span className={styles.eyebrow}>Beyond follow-up</span>
            <h2>Maia can help the business remember the customer, not only the sale.</h2>
            <p>Automation can nurture relationships long after the first enquiry. The CRM becomes useful memory for the business, while Maia turns that memory into thoughtful action at the right time.</p>
          </div>
          <div className={styles.relationshipGrid}>
            {relationshipAutomations.map(({title,text})=><article key={title}><span className={styles.relationshipIcon}><Workflow size={18}/></span><h3>{title}</h3><p>{text}</p></article>)}
          </div>
        </div>
      </section>

      <section className={styles.campaignSection}>
        <div className={styles.shell}>
          <div className={styles.campaignCard}>
            <div>
              <span className={styles.eyebrow}>Campaign example</span>
              <h2>A new property arrives. Maia already knows who may care.</h2>
              <p>A manager can identify the relevant customer segment from the CRM, prepare an approved campaign, and send the message through WhatsApp to eligible contacts. Replies return into the same customer context, where Maia can answer questions, qualify renewed interest, schedule the next action, or hand the conversation to an agent.</p>
            </div>
            <div className={styles.campaignFlow}>
              <span>New property added</span><i>→</i><span>Relevant CRM leads selected</span><i>→</i><span>WhatsApp campaign sent</span><i>→</i><span>Replies qualified</span><i>→</i><span>Agent handoff</span>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.industrySection}>
        <div className={styles.shell}>
          <div className={styles.heading}>
            <span className={styles.eyebrow}>Not limited to real estate</span>
            <h2>The operating model can be adapted to almost any customer-facing industry.</h2>
            <p>Real estate is the example here. The same architecture can be configured around the events, customer data, follow-up rules, and human handoffs that matter in another business.</p>
          </div>
          <div className={styles.industryGrid}>
            {industryExamples.map(([title,text])=><article key={title}><h3>{title}</h3><p>{text}</p></article>)}
          </div>
        </div>
      </section>

      <section className={styles.outcomesSection}>
        <div className={styles.shell}>
          <div className={styles.heading}>
            <span className={styles.eyebrow}>Business impact</span>
            <h2>What improves for the company and the customer.</h2>
          </div>
          <div className={styles.outcomeColumns}>
            <article><h3>For the real estate company</h3>{["Faster responses","Better-qualified leads","Campaigns sent from CRM context","Fewer forgotten prospects","More inspection opportunities progressing","Stronger long-term customer relationships","Cleaner CRM records","Better management visibility","Smoother handoff to human agents"].map(item=><p key={item}><CheckCircle2 size={15}/>{item}</p>)}</article>
            <article><h3>For the customer</h3>{["Quicker answers","Clearer next steps","Property information without repeated waiting","Easier inspection scheduling","Timely reminders","Relevant updates instead of random messages","Birthday and relationship greetings where configured","Less need to repeat information","Human support when the conversation becomes serious"].map(item=><p key={item}><CheckCircle2 size={15}/>{item}</p>)}</article>
          </div>
        </div>
      </section>

      <section className={styles.leoSection}>
        <div className={styles.shell}>
          <div className={styles.leoCard}>
            <div><span className={styles.eyebrow}>Leo admin layer</span><h2>Automation with management visibility.</h2><p>Leo gives the team a control layer over what Maia is doing, helping administrators understand lead activity, campaigns, follow-up status, scheduled inspections, relationship automations, and conversations that need human attention.</p></div>
            <div className={styles.leoPanel}><div><span className={styles.liveDot}/> Operations live</div><strong>12 leads progressing</strong><p>4 qualified · 3 inspections scheduled · 2 need human attention</p><small>Illustrative dashboard view · Lead context and next actions remain connected.</small></div>
          </div>
        </div>
      </section>

      <section className={styles.priceSection}>
        <div className={styles.shell}>
          <div className={styles.priceCard}>
            <div>
              <span className={styles.eyebrow}>Plan required</span>
              <h2>This type of connected system starts at Business+.</h2>
              <p>Business+ is the current tier designed for connected customer automation across follow-up, reminders, email, CRM, scheduling, campaigns, admin visibility, and deeper workflow automation.</p>
            </div>
            <div className={styles.priceBox}>
              <small>Nigeria · current rate</small>
              <strong>₦400,000</strong>
              <span>first month</span>
              <em>₦250,000/month after</em>
              <small className={styles.international}>International: $1,200 first month · $700/month after</small>
              <Link className={styles.primary} href="/pricing" data-cta="maia-business-plus-pricing">View Business+ pricing <ArrowRight size={17}/></Link>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.finalCta}>
        <div className={styles.shell}>
          <span className={styles.eyebrow}>Choose the level that fits</span>
          <h2>See where this system fits within Fluxknight pricing.</h2>
          <p>Maia is an example of the kind of connected customer operating system available at the Business+ level and above, with deeper customization available for organizations that need more.</p>
          <Link className={styles.primary} href="/pricing" data-cta="maia-case-study-final-pricing">See pricing <ArrowRight size={17}/></Link>
        </div>
      </section>
    </main>
  );
}
