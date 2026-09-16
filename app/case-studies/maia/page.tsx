import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarCheck2, CheckCircle2, Database, MessageSquareText, UsersRound } from "@/components/admin/ServerIcons";
import styles from "./page.module.css";

const description = "See how Maia helps real estate teams turn enquiries into qualified buyer conversations, follow-up, inspections, CRM visibility and human handoff.";

export const metadata: Metadata = {
  title: "Maia for Real Estate | Fluxknight",
  description,
  alternates: { canonical: "/case-studies/maia" },
};

const problems = [
  ["Slow responses", "Leads wait too long for a useful reply."],
  ["Lost context", "Agents restart conversations from scratch."],
  ["Missed follow-ups", "Interested buyers quietly go cold."],
  ["Delayed inspections", "Scheduling depends on manual chasing."],
  ["Lower conversion", "Good enquiries fail to become real next steps."],
];

const journey = [
  ["01", "First enquiry", "A prospective buyer reaches out. Maia responds quickly, answers the first questions and captures the enquiry context."],
  ["02", "Lead qualification", "Budget, location, property type, urgency and buying intent become structured lead information."],
  ["03", "Follow-up & nurture", "When the prospect pauses, Maia keeps the conversation alive with timely follow-up and reminders."],
  ["04", "Inspection", "Qualified interest moves toward a scheduled inspection with buyer, property and appointment context connected."],
  ["05", "CRM & admin visibility", "The team can see lead history, status, reminders, inspections and the next action in one operational view."],
  ["06", "Human handoff", "When judgement, negotiation or closing needs a person, the agent enters with the full conversation context."],
];

const impacts = [
  ["Faster response", "Buyer intent is handled while it is still fresh."],
  ["Better qualification", "Agents receive useful context instead of vague enquiries."],
  ["Consistent follow-up", "Next actions stop depending entirely on staff memory."],
  ["Clearer visibility", "The team can see what is moving and where human attention is needed."],
];

export default function MaiaCaseStudyPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.glow} />
        <div className={styles.shell}>
          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <span className={styles.eyebrow}>Case study · Maia for real estate</span>
              <h1>From enquiries <span>to real opportunities.</span></h1>
              <p>See how Maia helps real estate companies capture, qualify, follow up and move more serious buyers toward the next action.</p>
              <div className={styles.actions}>
                <Link className={styles.primary} href="/pricing">See pricing <ArrowRight size={17} /></Link>
                <a className={styles.secondary} href="#journey">See how it works</a>
              </div>
              <div className={styles.heroBenefits}>
                <span><CheckCircle2 size={14} /> More qualified leads</span>
                <span><CheckCircle2 size={14} /> Faster response</span>
                <span><CheckCircle2 size={14} /> Better follow-through</span>
              </div>
            </div>
            <div className={styles.heroImage} aria-label="Generated Maia real estate buyer journey visual">
              <img
                src="/maia-hero-generated.webp"
                alt=""
                aria-hidden="true"
                decoding="async"
                fetchPriority="high"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: "center",
                  display: "block",
                }}
              />
              <div className={styles.chatCardTop}><small>Prospect</small><strong>Is this property still available?</strong><span>New enquiry · now</span></div>
              <div className={styles.chatCardBottom}><small>Maia</small><strong>Enquiry captured</strong><span>Buyer context saved</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.problemSection}>
        <div className={styles.shell}>
          <div className={styles.problemGrid}>
            <div className={styles.problemIntro}>
              <span className={styles.eyebrow}>The problem</span>
              <h2>Great opportunities get lost every day.</h2>
              <p>Real estate teams can generate enquiries and still lose serious buyers when replies, context, follow-up and inspections are handled as separate manual tasks.</p>
            </div>
            <div className={styles.problemCards}>
              {problems.map(([title, text], index) => (
                <article key={title}>
                  <span className={styles.problemIcon}>{index === 3 ? <CalendarCheck2 size={18} /> : <MessageSquareText size={18} />}</span>
                  <strong>{title}</strong>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className={styles.shiftSection}>
        <div className={styles.shell}>
          <div className={styles.shiftGrid}>
            <article className={styles.beforeCard}>
              <span>Before Maia</span>
              <h3>Manual customer operations</h3>
              <ul>
                <li>Manual responses</li>
                <li>Scattered lead records</li>
                <li>Inconsistent follow-up</li>
                <li>Missed opportunities</li>
                <li>Limited visibility</li>
              </ul>
            </article>
            <div className={styles.shiftArrow}>→</div>
            <article className={styles.afterCard}>
              <span>With <b>Maia</b></span>
              <h3>Connected buyer progression</h3>
              <ul>
                <li>Instant first response</li>
                <li>Qualified buyer context</li>
                <li>Automated follow-up</li>
                <li>Organized CRM activity</li>
                <li>Human handoff with context</li>
              </ul>
            </article>
            <div className={styles.dashboardMock}>
              <div className={styles.dashboardHead}><Database size={17} /><span>Lead activity</span></div>
              <div className={styles.dashboardStats}><b>Qualified</b><b>Inspection</b><b>Follow-up</b></div>
              <div className={styles.dashboardRows}><span>New enquiry · captured</span><span>Buyer intent · qualified</span><span>Inspection · next action</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.journeySection} id="journey">
        <div className={styles.shell}>
          <div className={styles.journeyHeading}>
            <div><span className={styles.eyebrow}>The journey</span><h2>A complete customer journey, powered by <span>Maia.</span></h2></div>
            <p>From the first message to the right human handoff, Maia keeps context and next actions connected.</p>
          </div>
          <div className={styles.journeyGrid}>
            {journey.map(([step, title, text], index) => (
              <article key={step} className={styles.journeyCard}>
                <div
                  className={styles.journeyVisual}
                  aria-label={`Generated visual for ${title}`}
                  style={{ position: "relative", overflow: "hidden" }}
                >
                  <img
                    src="/maia-journey-generated.webp"
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    decoding="async"
                    style={{
                      position: "absolute",
                      top: 0,
                      bottom: 0,
                      left: `${index * -100}%`,
                      width: "600%",
                      maxWidth: "none",
                      height: "100%",
                      objectFit: "fill",
                      display: "block",
                    }}
                  />
                </div>
                <div className={styles.journeyBody}>
                  <div className={styles.journeyTitle}><b>{step}</b><strong>{title}</strong></div>
                  <p>{text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.impactSection}>
        <div className={styles.shell}>
          <div className={styles.impactHeader}>
            <span className={styles.eyebrow}>The impact</span>
            <h2>Better customer operations without pretending automation is the closer.</h2>
            <p>These are the operational outcomes Maia is designed to improve. Real performance depends on the business, traffic quality, workflow configuration and team execution.</p>
          </div>
          <div className={styles.impactGrid}>
            {impacts.map(([title, text], index) => (
              <article key={title}>
                <span>{index === 3 ? <UsersRound size={19} /> : <CheckCircle2 size={19} />}</span>
                <strong>{title}</strong>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.ctaSection}>
        <div className={styles.shell}>
          <div className={styles.ctaCard}>
            <div><h2>Ready to build a connected customer journey?</h2><p>See the Fluxknight plans built for customer automation, follow-up, CRM and business workflows.</p></div>
            <div className={styles.ctaActions}>
              <Link className={styles.primary} href="/pricing">See pricing <ArrowRight size={17} /></Link>
              <Link className={styles.secondary} href="/evaluation">Talk to Fluxknight</Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
