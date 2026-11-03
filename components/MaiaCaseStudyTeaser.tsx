import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck2,
  CheckCircle2,
  Database,
  MessageSquareText,
} from "@/components/admin/ServerIcons";
import styles from "./MaiaCaseStudyTeaser.module.css";

const outcomes = [
  { icon: MessageSquareText, label: "Replies day and night" },
  { icon: CheckCircle2, label: "Follows up with buyers" },
  { icon: CalendarCheck2, label: "Coordinates inspection requests" },
];

const journey = [
  {
    step: "01",
    title: "Capture every enquiry",
    description: "Maia responds across connected channels, so new property enquiries get a timely first response instead of sitting in an inbox.",
  },
  {
    step: "02",
    title: "Understand the buyer",
    description: "She asks about budget, preferred location and property requirements, then shares relevant configured estates and property details.",
  },
  {
    step: "03",
    title: "Keep the conversation moving",
    description: "Maia retains context and follows up with interested prospects, helping the team pick up where the conversation left off.",
  },
  {
    step: "04",
    title: "Coordinate the next step",
    description: "She collects inspection requests and passes serious prospects, along with their conversation context, to the team for confirmation.",
  },
];

function WhatsAppMark() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path
        fill="currentColor"
        d="M16 3.2A12.6 12.6 0 0 0 5.2 22.3L3.5 28.5l6.4-1.7A12.6 12.6 0 1 0 16 3.2Zm0 22.9c-2 0-4-.6-5.6-1.7l-.4-.2-3.8 1 1-3.7-.2-.4A10.2 10.2 0 1 1 16 26.1Zm5.6-7.6c-.3-.2-1.8-.9-2.1-1-.3-.1-.5-.2-.7.2-.2.3-.8 1-1 1.2-.2.2-.4.2-.7.1-1.8-.9-3.1-1.7-4.3-3.8-.3-.5.3-.5.9-1.7.1-.2 0-.5-.1-.7l-1-2.3c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.2-1.2 2.9s1.2 3.3 1.4 3.6c.2.2 2.4 3.7 5.9 5.2 3.5 1.5 3.5 1 4.1.9.6-.1 1.8-.8 2.1-1.5.3-.7.3-1.3.2-1.5-.1-.2-.4-.3-.7-.5Z"
      />
    </svg>
  );
}

export default function MaiaCaseStudyTeaser() {
  return (
    <section className={styles.section} id="maia-case-study" aria-labelledby="maia-case-study-title">
      <div className={styles.glow} aria-hidden="true" />
      <article className={styles.card}>
        <div className={styles.referenceVisual} aria-label="Maia real-phone conversation and CRM workflow">
          <img className={styles.referenceVisualImage} src="https://d2ol7oe51mr4n9.cloudfront.net/user_3GTV38w6zCm0fb6vRYkPEmmsNnH/9366e3a0-ece8-4429-9be8-bcd6d241dd7d.jpg" alt="Prospect using WhatsApp with Maia to explore Lagos property options" loading="lazy" decoding="async" fetchPriority="low" />
        </div>

        <div className={styles.content}>
          <span className={styles.eyebrow}>A real example · Real estate</span>
          <h2 id="maia-case-study-title">See how Fluxknight works in <span>a real business.</span></h2>
          <p className={styles.lead}>Every property enquiry is a potential sale. The challenge is responding quickly, understanding what each buyer needs and making sure interested prospects do not get forgotten.</p>
          <p>When buyers reach Limitless Realty through connected channels, Maia becomes the first point of contact. She answers property questions, gathers buyer preferences, shares relevant estate information and keeps each conversation moving.</p>
          <p>When a prospect is ready for the next step, Maia collects the inspection request and hands the conversation to the sales team with the context they need to follow through.</p>

          <div className={styles.outcomes} aria-label="Maia case study outcomes">
            {outcomes.map(({ icon: Icon, label }) => (
              <div className={styles.outcome} key={label}>
                <Icon size={19} />
                <span>{label}</span>
              </div>
            ))}
          </div>

          <div className={styles.journey} aria-label="How Maia supports the property sales journey">
            {journey.map(({ step, title, description }) => (
              <article className={styles.journeyStep} key={step}>
                <span className={styles.journeyNumber}>{step}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
              </article>
            ))}
          </div>
          <p className={styles.result}><strong>The result:</strong> your sales team spends less time chasing conversations and more time engaging informed prospects and coordinating property inspections.</p>

          <div className={styles.attribution}>Limitless Realty <span>×</span> Fluxknight</div>

          <div className={styles.actions}>
            <Link className={styles.primary} href="/case-studies/maia" data-cta="maia-case-study-home">
              See the Maia case study <ArrowRight size={19} />
            </Link>
            <Link className={styles.secondary} href="/#talk-to-leo" data-cta="maia-talk-to-leo">
              Talk to our support & inquiry agent
            </Link>
            <Link className={styles.secondary} href="/evaluation?industry=real-estate" data-cta="maia-evaluate-business">
              Evaluate your lead process
            </Link>
          </div>
        </div>
      </article>
    </section>
  );
}
