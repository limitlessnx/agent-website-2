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
    meta: "2m",
    text: "Interested in the 2-bedroom apartment…",
    icon: MessageSquareText,
  },
  {
    tone: "booking",
    label: "Booking confirmed",
    meta: "15m",
    text: "Inspection · Sat, 10:00 AM",
    icon: CalendarDays,
  },
  {
    tone: "followup",
    label: "Follow-up",
    meta: "1h",
    text: "Reminder scheduled",
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
          <h2 id="automation-journey-title">
            From customer enquiries to sales, bookings, follow-ups <span>and more.</span>
          </h2>
        </div>

        <div className={styles.visual} aria-label="Customer activity being handled across business channels">
          <div className={styles.visualImage}>
            <img
              src="https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1800&q=88"
              alt="Team collaborating around a laptop and discussing business growth"
              loading="lazy"
              decoding="async"
            />
          </div>

          <div className={styles.activityLayer}>
            {activityCards.map(({ tone, label, meta, text, icon: Icon }) => (
              <article className={`${styles.activity} ${styles[tone]}`} key={label}>
                <span className={styles.activityIcon} aria-hidden="true">
                  <Icon size={16} />
                </span>
                <div className={styles.activityCopy}>
                  <div className={styles.activityTopline}>
                    <strong>{label}</strong>
                    <small>{meta}</small>
                  </div>
                  <p>{text}</p>
                  {tone === "followup" && (
                    <span className={styles.confirmed}>✓ Scheduled</span>
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
