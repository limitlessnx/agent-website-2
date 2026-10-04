import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  MessageSquareText,
  UserRound,
} from "@/components/admin/ServerIcons";
import styles from "./AutomationJourney.module.css";

const activityCards = [
  {
    tone: "whatsapp",
    label: "New enquiry",
    meta: "2m ago",
    text: "Hi, I’m interested in the 3 bedroom apartment in Lekki. Is it still available?",
    icon: MessageSquareText,
  },
  {
    tone: "booking",
    label: "Booking confirmed",
    meta: "15m ago",
    text: "Property inspection scheduled for Sat, 12 Oct · 10:00 AM",
    icon: CalendarDays,
  },
  {
    tone: "followup",
    label: "Follow-up",
    meta: "1h ago",
    text: "Reminder sent to client about document submission.",
    icon: UserRound,
  },
] as const;

function ActionLink() {
  return (
    <Link
      className={styles.actionLink}
      href="/case-studies/maia"
      data-cta="automation-maia-case-study"
    >
      <span className={styles.playMark} aria-hidden="true">
        <span />
      </span>
      <span className={styles.actionCopy}>
        <strong>See how Maia works</strong>
        <small>See a real example in real estate</small>
      </span>
      <ArrowRight className={styles.actionArrow} size={22} />
    </Link>
  );
}

export default function AutomationJourney() {
  return (
    <section className={styles.section} id="services" aria-labelledby="automation-journey-title">
      <div className={styles.frame}>
        <div className={styles.heading}>
          <span className={styles.eyebrow}>Customer operations</span>
          <h2 id="automation-journey-title">
            From customer enquiries to sales, bookings, follow-ups <span>and more.</span>
          </h2>
        </div>

        <div className={styles.visual} aria-label="Customer activity being handled across business channels">
          <div className={styles.visualImage}>
            <img
              src="https://d2ol7oe51mr4n9.cloudfront.net/user_3GTV38w6zCm0fb6vRYkPEmmsNnH/9366e3a0-ece8-4429-9be8-bcd6d241dd7d.jpg"
              alt="Business professional reviewing customer conversations and property enquiries"
              loading="lazy"
              decoding="async"
            />
          </div>

          <div className={styles.activityLayer}>
            {activityCards.map(({ tone, label, meta, text, icon: Icon }) => (
              <article className={`${styles.activity} ${styles[tone]}`} key={label}>
                <span className={styles.activityIcon} aria-hidden="true">
                  <Icon size={18} />
                </span>
                <div className={styles.activityCopy}>
                  <div className={styles.activityTopline}>
                    <strong>{label}</strong>
                    <small>{meta}</small>
                  </div>
                  <p>{text}</p>
                  {tone === "followup" && (
                    <span className={styles.confirmed}>✓ Follow-up scheduled</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className={styles.supportingCopy}>
          <p>One system keeping customer operations moving across the channels you already use.</p>
          <ActionLink />
        </div>
      </div>
    </section>
  );
}
