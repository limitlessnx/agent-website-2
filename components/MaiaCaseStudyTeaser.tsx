import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck2,
  CheckCircle2,
  MessageSquareText,
  BarChart2,
} from "@/components/admin/ServerIcons";
import styles from "./MaiaCaseStudyTeaser.module.css";

const outcomes = [
  { icon: MessageSquareText, label: "More customer conversations" },
  { icon: CheckCircle2, label: "More qualified opportunities" },
  { icon: CalendarCheck2, label: "More bookings" },
];

const capabilities = [
  "Responds to new property enquiries",
  "Qualifies budget, location and requirements",
  "Recommends relevant configured properties",
  "Shares property information and media where configured",
  "Keeps conversation context for follow-up",
  "Helps schedule inspections and reminders",
  "Hands serious prospects to a human with context",
  "Keeps lead stages visible to management",
];

export default function MaiaCaseStudyTeaser() {
  return (
    <section className={styles.section} id="maia-case-study" aria-labelledby="maia-case-study-title">
      <div className={styles.glow} aria-hidden="true" />
      <article className={styles.card}>
        <div className={styles.referenceVisual} aria-label="A business team reviewing customer growth and operations">
          <img
            className={styles.referenceVisualImage}
            src="https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1800&q=88"
            alt="Business team collaborating around a table and reviewing growth"
            loading="lazy"
            decoding="async"
            fetchPriority="low"
          />
          <div className={styles.visualShade} aria-hidden="true" />
          <div className={styles.growthBadge}>
            <span className={styles.growthIcon}><BarChart2 size={15} /></span>
            <span>
              <small>Customer growth</small>
              <strong>More opportunities in motion</strong>
            </span>
          </div>
          <div className={styles.signalStack} aria-label="Business growth signals">
            <span><MessageSquareText size={13} /> Enquiries ↑</span>
            <span><CalendarCheck2 size={13} /> Bookings ↑</span>
            <span><CheckCircle2 size={13} /> Follow-ups ↑</span>
          </div>
        </div>

        <div className={styles.content}>
          <span className={styles.eyebrow}>A real example · Real estate</span>
          <h2 id="maia-case-study-title">See how Fluxknight works in <span>a real business.</span></h2>
          <p>Maia helps Limitless Realty reply to property enquiries, collect buyer details, follow up with interested buyers and book inspections.</p>

          <div className={styles.outcomes} aria-label="Maia case study outcomes">
            {outcomes.map(({ icon: Icon, label }) => (
              <div className={styles.outcome} key={label}>
                <Icon size={19} />
                <span>{label}</span>
              </div>
            ))}
          </div>

          <div className={styles.capabilities} aria-label="What Maia can support in a real-estate customer journey">
            {capabilities.map((label) => (
              <span key={label}><CheckCircle2 size={15} /> {label}</span>
            ))}
          </div>

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
