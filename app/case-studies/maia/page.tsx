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
import styles from "./page.module.css";

const maiaDescription =
  "See how Maia helps a real estate business turn property enquiries into qualified buyer conversations, follow-up, inspections, CRM activity, and human handoff.";

export const metadata: Metadata = {
  title: "Maia for Real Estate | Fluxknight",
  description: maiaDescription,
  alternates: { canonical: "/case-studies/maia" },
  openGraph: {
    type: "website",
    url: "/case-studies/maia",
    title: "Maia for Real Estate | Fluxknight",
    description: maiaDescription,
    siteName: "Fluxknight",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Maia real estate automation system by Fluxknight" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Maia for Real Estate | Fluxknight",
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
  { icon: Workflow, title: "Reminders", text: "Protect inspections, promised follow-ups, installment due dates, and other important next actions so they do not depend on staff memory." },
  { icon: Database, title: "CRM", text: "Keep lead details, status, history, payment dates, important dates, preferences, and next actions organized in one operational record." },
  { icon: Bot, title: "Leo admin", text: "Give administrators visibility into conversations, campaigns, follow-up status, inspections, reminders, and leads that need attention." },
  { icon: UsersRound, title: "Human handoff", text: "Escalate the right conversations to an agent when judgement, negotiation, or closing requires a person." },
];

const beforeItems = [
  "Property enquiries sit in WhatsApp until an agent is available",
  "Lead details live across chats, notes and staff memory",
  "Follow-up becomes inconsistent once the prospect pauses",
  "Inspection scheduling and reminders require manual chasing",
];

const afterItems = [
  "Maia answers immediately and captures the enquiry context",
  "Budget, location, property type and intent become structured lead data",
  "Follow-up and reminders continue without depending on memory",
  "Qualified buyers move toward inspections with the team entering at the right moment",
];

const visualJourney = [
  {
    step: "01",
    eyebrow: "First enquiry",
    title: "A buyer shows interest while the intent is still fresh.",
    text: "The customer sends a property enquiry. Maia can respond immediately, answer the first questions, and preserve the conversation before the lead becomes another unread chat.",
    image: "https://images.unsplash.com/photo-1758874384950-c77e4b6a336a?auto=format&fit=crop&w=1600&q=82",
    alt: "Buyer using a smartphone in a modern apartment setting",
    status: "New enquiry captured",
    detail: "Response active · context saved",
    chips: ["WhatsApp", "Property enquiry", "Instant response"],
  },
  {
    step: "02",
    eyebrow: "Qualification",
    title: "The conversation becomes useful buyer data.",
    text: "Instead of handing an agent a vague message, Maia can capture budget, preferred location, property type, urgency and buying intent so the next conversation starts with context.",
    image: "https://images.pexels.com/photos/1181251/pexels-photo-1181251.jpeg?auto=compress&cs=tinysrgb&w=1600",
    alt: "Professional woman using a laptop in a modern office",
    status: "Lead qualified",
    detail: "Budget · Location · Intent",
    chips: ["₦ Budget", "Location", "Buying intent"],
  },
  {
    step: "03",
    eyebrow: "Follow-up",
    title: "Interest does not disappear because the buyer paused.",
    text: "When the prospect needs time, misses a response, or says they will come back later, Maia can keep the next action alive through timely WhatsApp or email follow-up.",
    image: "https://images.pexels.com/photos/1181727/pexels-photo-1181727.jpeg?auto=compress&cs=tinysrgb&w=1600",
    alt: "Professional woman working from a laptop in a modern office",
    status: "Follow-up active",
    detail: "Next touchpoint protected",
    chips: ["WhatsApp", "Email", "Reminder"],
  },
  {
    step: "04",
    eyebrow: "Inspection",
    title: "A qualified conversation moves into the real world.",
    text: "Once the buyer is ready, the journey moves toward inspection. Appointment details, property context and the next action stay connected instead of bouncing between chats and staff memory.",
    image: "https://images.pexels.com/photos/7489096/pexels-photo-7489096.jpeg?auto=compress&cs=tinysrgb&w=1600",
    alt: "Real estate agent showing clients a property",
    status: "Inspection scheduled",
    detail: "Buyer + agent + property context",
    chips: ["Calendar", "Inspection", "Agent notified"],
  },
  {
    step: "05",
    eyebrow: "CRM & visibility",
    title: "The team can see what happened and what happens next.",
    text: "Lead history, status, reminders and next actions can remain organized in the CRM while Leo gives administrators a clearer view of conversations that are progressing or need attention.",
    image: "https://images.pexels.com/photos/6694486/pexels-photo-6694486.jpeg?auto=compress&cs=tinysrgb&w=1600",
    alt: "Business professional working at a laptop with organized workspace",
    status: "Customer record updated",
    detail: "Context visible to the team",
    chips: ["CRM", "Leo admin", "Next action"],
  },
  {
    step: "06",
    eyebrow: "Human handoff",
    title: "The human enters when judgement and closing actually matter.",
    text: "Maia does not need to pretend to be the closer. When negotiation, reassurance or a serious buying decision needs a person, the agent receives the conversation with context instead of starting again from zero.",
    image: "https://images.pexels.com/photos/8962526/pexels-photo-8962526.jpeg?auto=compress&cs=tinysrgb&w=1600",
    alt: "Real estate professional meeting with a client in a modern apartment",
    status: "Agent handoff ready",
    detail: "Qualified context transferred",
    chips: ["Human agent", "Full context", "Serious buyer"],
  },
];

const relationshipAutomations = [
  { title: "New property campaigns", text: "When a new property or offer arrives, a real estate company can select relevant, eligible leads from the CRM and send a WhatsApp campaign through Maia instead of manually contacting every prospect." },
  { title: "Installment payment reminders", text: "If a property is being paid for in installments, Maia can use the client's payment schedule to send reminders before the due date, on the due date, and follow up on overdue balances while keeping the account record visible to the team." },
  { title: "Personal client reminders", text: "Create a specific reminder for one customer based on what matters to that relationship, whether it is a promised follow-up, inspection date, document reminder, payment date, or future check-in." },
  { title: "Birthday messages", text: "Save a client's birthday in the CRM and let Maia send a personalized birthday greeting from the business automatically when the date arrives." },
  { title: "Anniversary and seasonal greetings", text: "Automate meaningful relationship messages such as anniversaries, festive greetings, seasonal notes, and other dates that matter to the customer rather than contacting them only when the business wants another sale." },
  { title: "Periodic relationship check-ins", text: "Schedule thoughtful periodic messages that keep the business present in the customer's mind without turning every interaction into a sales request." },
  { title: "CRM-driven personalization", text: "Use stored preferences, previous enquiries, payment status, important dates, and customer history to determine what message should be sent, when it should be sent, and when a human should step in." },
];

const industryExamples = [
  ["Photography", "Store a couple's wedding date and automatically send a thoughtful anniversary message each year. New photography packages or seasonal campaigns can also be shared with the right past clients."],
  ["Gyms & fitness", "Track membership expiry and renewal dates so members can receive reminders before renewal, on the due date, and after expiry. Birthdays, membership milestones, missed visits, and personalized check-ins can also be automated while staff step in when needed."],
  ["Hotels & hospitality", "Welcome returning guests, send seasonal greetings, re-engage previous guests with relevant offers, and keep booking conversations connected to guest history."],
  ["Professional & service businesses", "Remember customer preferences, important follow-up dates, completed jobs, payment dates, anniversaries, and periodic check-ins so relationships continue after the first transaction."],
];

export default function MaiaCaseStudyPage() {
  return (
    <main className={styles.page}>
      <style>{`
        .maiaJourney{padding:108px 0;background:linear-gradient(180deg,#080411 0%,#06020d 48%,#090414 100%);overflow:hidden}
        .maiaJourneyHeader{max-width:860px;margin:0 auto 62px;text-align:center}
        .maiaJourneyHeader h2{margin:12px 0 0;font-size:clamp(2.35rem,5.4vw,4.7rem);line-height:.96;letter-spacing:-.055em}
        .maiaJourneyHeader p{max-width:690px;margin:20px auto 0;color:#9f92ae;line-height:1.72}
        .maiaStory{display:grid;gap:88px}
        .maiaStoryRow{display:grid;grid-template-columns:minmax(0,.86fr) minmax(440px,1.14fr);gap:58px;align-items:center}
        .maiaStoryRow:nth-child(even){grid-template-columns:minmax(440px,1.14fr) minmax(0,.86fr)}
        .maiaStoryRow:nth-child(even) .maiaStoryVisual{order:1}
        .maiaStoryRow:nth-child(even) .maiaStoryCopy{order:2}
        .maiaStoryStep{display:flex;align-items:center;gap:11px;color:#8d7e9b;font-size:.68rem;font-weight:800;letter-spacing:.16em;text-transform:uppercase}
        .maiaStoryStep b{display:inline-flex;width:38px;height:38px;align-items:center;justify-content:center;border:1px solid rgba(188,143,255,.2);border-radius:12px;background:rgba(137,68,238,.12);color:#c89fff;font-size:.67rem}
        .maiaStoryCopy h3{max-width:570px;margin:18px 0 14px;font-size:clamp(2rem,4.2vw,3.65rem);line-height:.98;letter-spacing:-.05em}
        .maiaStoryCopy>p{max-width:570px;margin:0;color:#9f94aa;font-size:.94rem;line-height:1.72}
        .maiaStoryChips{display:flex;flex-wrap:wrap;gap:8px;margin-top:22px}
        .maiaStoryChips span{padding:8px 10px;border:1px solid rgba(188,143,255,.14);border-radius:999px;background:rgba(255,255,255,.025);color:#b5a8c0;font-size:.68rem;font-weight:760}
        .maiaStoryVisual{position:relative;min-height:570px;overflow:hidden;border:1px solid rgba(191,145,255,.16);border-radius:28px;background:#0d0814;box-shadow:0 28px 90px rgba(0,0,0,.42),0 0 70px rgba(116,54,212,.08)}
        .maiaStoryVisual img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:saturate(.78) contrast(1.03) brightness(.78)}
        .maiaStoryVisual:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(5,2,9,.08),rgba(6,3,10,.15) 40%,rgba(6,3,10,.83) 100%),linear-gradient(120deg,rgba(104,42,192,.16),transparent 48%)}
        .maiaStoryStatus{position:absolute;left:22px;right:22px;bottom:22px;z-index:3;display:flex;align-items:flex-end;justify-content:space-between;gap:18px;padding:18px;border:1px solid rgba(255,255,255,.12);border-radius:17px;background:rgba(9,6,13,.78);backdrop-filter:blur(18px);box-shadow:0 18px 46px rgba(0,0,0,.25)}
        .maiaStoryStatus small,.maiaStoryStatus strong,.maiaStoryStatus span{display:block}
        .maiaStoryStatus small{color:#bd91ff;font-size:.61rem;font-weight:900;letter-spacing:.12em;text-transform:uppercase}
        .maiaStoryStatus strong{margin-top:6px;font-size:1rem;color:#fff}
        .maiaStoryStatus span{margin-top:5px;color:#8d8297;font-size:.68rem}
        .maiaStoryLive{display:inline-flex!important;align-items:center;gap:7px!important;flex:0 0 auto;margin:0!important;padding:8px 10px;border:1px solid rgba(177,123,255,.18);border-radius:999px;background:rgba(129,63,226,.12);color:#d8bcff!important;font-size:.63rem!important;font-weight:800}
        .maiaStoryLive:before{content:"";width:6px;height:6px;border-radius:50%;background:#a855f7;box-shadow:0 0 14px rgba(168,85,247,.8)}
        .maiaIllustrative{margin-top:12px;color:#6e6378;font-size:.61rem;line-height:1.45}
        @media(max-width:900px){.maiaJourney{padding:82px 0}.maiaStory{gap:64px}.maiaStoryRow,.maiaStoryRow:nth-child(even){grid-template-columns:1fr;gap:28px}.maiaStoryRow:nth-child(even) .maiaStoryVisual,.maiaStoryRow:nth-child(even) .maiaStoryCopy{order:initial}.maiaStoryCopy{text-align:left}.maiaStoryVisual{min-height:500px}}
        @media(max-width:640px){.maiaJourney{padding:68px 0}.maiaJourneyHeader{margin-bottom:42px;text-align:left}.maiaJourneyHeader h2{font-size:clamp(2.15rem,11.4vw,3.25rem)}.maiaJourneyHeader p{margin-left:0}.maiaStory{gap:52px}.maiaStoryRow{gap:22px}.maiaStoryCopy h3{font-size:clamp(1.9rem,9.4vw,2.75rem)}.maiaStoryCopy>p{font-size:.88rem;line-height:1.62}.maiaStoryVisual{min-height:420px;border-radius:20px}.maiaStoryStatus{left:14px;right:14px;bottom:14px;padding:14px;border-radius:14px}.maiaStoryStatus{align-items:flex-start;flex-direction:column}.maiaStoryLive{align-self:flex-start}.maiaStoryChips{margin-top:18px}.maiaStoryChips span{font-size:.64rem}}
      `}</style>

      <section className={styles.hero}>
        <div className={styles.heroGlow} />
        <div className={styles.shell}>
          <div className={styles.heroLayout}>
            <div className={styles.heroCopy}>
              <span className={styles.eyebrow}>Maia for real estate</span>
              <h1>Turn property enquiries into qualified buyer conversations.</h1>
              <p>Maia helps a real estate business respond faster, qualify buyer intent, keep follow-up moving, coordinate inspections, and preserve customer context until the right human needs to step in.</p>
              <div className={styles.actions}>
                <Link className={styles.primary} href="/pricing" data-cta="maia-case-study-pricing">See pricing <ArrowRight size={17} /></Link>
                <Link className={styles.secondary} href="#maia-story">See how it works</Link>
              </div>
              <div className={styles.heroProof}>
                <span>Enquiry handling</span><span>Lead qualification</span><span>Follow-up</span><span>Inspection scheduling</span>
              </div>
            </div>
            <div className={styles.heroVisual} role="img" aria-label="Real estate buyer journey supported by Maia">
              <div className={styles.heroVisualShade} />
              <div className={`${styles.heroUiCard} ${styles.heroUiTop}`}><small>New enquiry</small><strong>“Is the 4-bedroom still available?”</strong><span>Maia replied · now</span></div>
              <div className={`${styles.heroUiCard} ${styles.heroUiBottom}`}><small>Lead status</small><strong>Qualified buyer</strong><span>Inspection next step</span></div>
              <div className={styles.heroImageCaption}><span>Customer journey</span><strong>From first enquiry to serious buyer action</strong></div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.problemSection}>
        <div className={styles.shell}>
          <div className={styles.sectionIndex}>01 · The problem</div>
          <div className={styles.problemLayout}>
            <div className={styles.problemIntro}>
              <span className={styles.eyebrow}>Before Maia</span>
              <h2>Interest arrives quickly. Operations often move slower.</h2>
              <p>Real estate businesses can generate enquiries and still lose serious buyers because the customer journey breaks between the first message and the next meaningful action.</p>
            </div>
            <div className={styles.problemGrid}>
              {["Slow replies cool buyer intent","Agents restart conversations from zero","Follow-up depends on memory","Inspection coordination gets delayed","Important dates get missed","Past prospects disappear after the first conversation"].map((item, index) => (
                <article key={item}><span className={styles.problemNumber}>{String(index + 1).padStart(2, "0")}</span><span>{item}</span></article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className={styles.beforeAfterSection} id="maia-story">
        <div className={styles.shell}>
          <div className={styles.sectionIndex}>02 · The shift</div>
          <div className={styles.heading}>
            <span className={styles.eyebrow}>Before → after</span>
            <h2>The customer journey stops depending on whoever remembers what happens next.</h2>
            <p>Maia does not remove the agent. It gives the agent a cleaner, better-prepared conversation to enter.</p>
          </div>
          <div className={styles.beforeAfterGrid}>
            <article className={styles.beforeCard}><div className={styles.stateLabel}><span className={styles.stateDot} />Before</div><h3>Manual, fragmented and easy to lose.</h3><div className={styles.stateList}>{beforeItems.map(item=><p key={item}><span>×</span>{item}</p>)}</div></article>
            <div className={styles.shiftRail} aria-hidden="true"><span>Maia</span><ArrowRight size={18} /></div>
            <article className={styles.afterCard}><div className={styles.stateLabel}><span className={styles.stateDot} />With Maia</div><h3>Responsive, structured and ready for human action.</h3><div className={styles.stateList}>{afterItems.map(item=><p key={item}><CheckCircle2 size={15}/>{item}</p>)}</div></article>
          </div>
        </div>
      </section>

      <section className={styles.capabilitiesSection}>
        <div className={styles.shell}>
          <div className={styles.heading}><span className={styles.eyebrow}>What connects underneath</span><h2>Eleven connected capabilities. One customer journey.</h2></div>
          <div className={styles.capabilityGrid}>{capabilities.map(({icon:Icon,title,text})=><article key={title}><span className={styles.icon}><Icon size={19}/></span><h3>{title}</h3><p>{text}</p></article>)}</div>
        </div>
      </section>

      <section className="maiaJourney" aria-labelledby="maia-visual-story-title">
        <div className={styles.shell}>
          <div className="maiaJourneyHeader">
            <span className={styles.eyebrow}>03 · The buyer journey</span>
            <h2 id="maia-visual-story-title">See the effect at every stage, not just the automation behind it.</h2>
            <p>This is the human side of the system: what the buyer experiences, what the team receives, and where Maia keeps the journey moving.</p>
          </div>
          <div className="maiaStory">
            {visualJourney.map((stage) => (
              <article className="maiaStoryRow" key={stage.step}>
                <div className="maiaStoryCopy">
                  <div className="maiaStoryStep"><b>{stage.step}</b><span>{stage.eyebrow}</span></div>
                  <h3>{stage.title}</h3>
                  <p>{stage.text}</p>
                  <div className="maiaStoryChips">{stage.chips.map(chip=><span key={chip}>{chip}</span>)}</div>
                  <div className="maiaIllustrative">Illustrative customer journey visual. Final deployment behavior depends on the configured workflow and connected systems.</div>
                </div>
                <div className="maiaStoryVisual">
                  <img src={stage.image} alt={stage.alt} loading="lazy" />
                  <div className="maiaStoryStatus">
                    <div><small>{stage.eyebrow}</small><strong>{stage.status}</strong><span>{stage.detail}</span></div>
                    <span className="maiaStoryLive">Maia active</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.relationshipSection}>
        <div className={styles.shell}>
          <div className={styles.heading}><span className={styles.eyebrow}>Beyond the first conversion</span><h2>Maia can help the business remember the customer, not only the sale.</h2><p>Automation can nurture relationships long after the first enquiry. The CRM becomes useful memory for the business, while Maia turns that memory into thoughtful action at the right time.</p></div>
          <div className={styles.relationshipGrid}>{relationshipAutomations.map(({title,text})=><article key={title}><span className={styles.relationshipIcon}><Workflow size={18}/></span><h3>{title}</h3><p>{text}</p></article>)}</div>
        </div>
      </section>

      <section className={styles.campaignSection}>
        <div className={styles.shell}><div className={styles.campaignCard}><div><span className={styles.eyebrow}>Campaign example</span><h2>A new property arrives. Maia already knows who may care.</h2><p>A manager can identify the relevant customer segment from the CRM, prepare an approved campaign, and send the message through WhatsApp to eligible contacts. Replies return into the same customer context, where Maia can answer questions, qualify renewed interest, schedule the next action, or hand the conversation to an agent.</p></div><div className={styles.campaignFlow}><span>New property added</span><i>→</i><span>Relevant CRM leads selected</span><i>→</i><span>WhatsApp campaign sent</span><i>→</i><span>Replies qualified</span><i>→</i><span>Agent handoff</span></div></div></div>
      </section>

      <section className={styles.industrySection}>
        <div className={styles.shell}><div className={styles.heading}><span className={styles.eyebrow}>Not limited to real estate</span><h2>The operating model can be adapted to other customer-facing industries.</h2><p>Real estate is the example here. The same architecture can be configured around the events, customer data, renewal cycles, payment dates, follow-up rules, and human handoffs that matter in another business.</p></div><div className={styles.industryGrid}>{industryExamples.map(([title,text])=><article key={title}><h3>{title}</h3><p>{text}</p></article>)}</div></div>
      </section>

      <section className={styles.outcomesSection}>
        <div className={styles.shell}><div className={styles.heading}><span className={styles.eyebrow}>Business impact</span><h2>What improves for the company and the customer.</h2></div><div className={styles.outcomeColumns}><article><h3>For the real estate company</h3>{["Faster responses","Better-qualified leads","Fewer forgotten prospects","More inspection opportunities progressing","Cleaner CRM records","Better management visibility","Smoother handoff to human agents"].map(item=><p key={item}><CheckCircle2 size={15}/>{item}</p>)}</article><article><h3>For the customer</h3>{["Quicker answers","Clearer next steps","Easier inspection scheduling","Relevant updates instead of random messages","Less need to repeat information","Human support when the conversation becomes serious"].map(item=><p key={item}><CheckCircle2 size={15}/>{item}</p>)}</article></div></div>
      </section>

      <section className={styles.leoSection}>
        <div className={styles.shell}><div className={styles.leoCard}><div><span className={styles.eyebrow}>Leo admin layer</span><h2>Automation with management visibility.</h2><p>Leo gives the team a control layer over what Maia is doing, helping administrators understand lead activity, campaigns, follow-up status, scheduled inspections, payment reminders, relationship automations, and conversations that need human attention.</p></div><div className={styles.leoPanel}><div><span className={styles.liveDot}/> Operations live</div><strong>12 leads progressing</strong><p>4 qualified · 3 inspections scheduled · 2 need human attention</p><small>Illustrative dashboard view · Lead context and next actions remain connected.</small></div></div></div>
      </section>

      <section className={styles.priceSection}>
        <div className={styles.shell}><div className={styles.priceCard}><div><span className={styles.eyebrow}>Plan required</span><h2>This type of connected system starts at Business+.</h2><p>Business+ is the current tier designed for connected customer automation across follow-up, reminders, email, CRM, scheduling, campaigns, admin visibility, and deeper workflow automation.</p></div><div className={styles.priceBox}><small>Nigeria · current rate</small><strong>₦400,000</strong><span>first month</span><em>₦250,000/month after</em><small className={styles.international}>International: $1,200 first month · $700/month after</small><Link className={styles.primary} href="/pricing" data-cta="maia-business-plus-pricing">View Business+ pricing <ArrowRight size={17}/></Link></div></div></div>
      </section>

      <section className={styles.finalCta}>
        <div className={styles.shell}><span className={styles.eyebrow}>Choose the right level</span><h2>See the package that activates this kind of connected system.</h2><p>Business+ is the starting point for this Maia-style setup. More complex multi-agent, multi-department, database, membership, and custom operating systems can be scoped under Custom.</p><Link className={styles.primary} href="/pricing" data-cta="maia-case-study-final-pricing">See pricing <ArrowRight size={17}/></Link></div>
      </section>
    </main>
  );
}
