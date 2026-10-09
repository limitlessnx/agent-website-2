import Link from "next/link";
import { ArrowRight } from "@/components/admin/ServerIcons";
import ChannelAutomationCarousel from "./ChannelAutomationCarousel";
import styles from "./AutomationJourney.module.css";

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
    <section
      className={styles.section}
      id="services"
      aria-label="Fluxknight customer operations automation"
    >
      <div className={styles.intro} id="how-it-works">
        <p className={styles.eyebrow}>How it works</p>
        <h2>From enquiry to follow-through.</h2>
        <div className={styles.steps}>
          <article><span>01</span><strong>Tell us the outcome</strong><p>Share where slow replies, missed follow-up or disconnected records cost your team opportunities.</p></article>
          <article><span>02</span><strong>Connect the work</strong><p>Fluxknight brings conversations, qualification, booking and updates into one operating flow.</p></article>
          <article><span>03</span><strong>Launch with oversight</strong><p>AI handles the repetitive path while your team keeps control of judgement, approvals and handoffs.</p></article>
        </div>
      </div>
      <ChannelAutomationCarousel />
      <div className={styles.frame}>
        <div
          className={styles.visual}
          aria-label="Fluxknight team growth and customer operations visual"
        >
          <div className={styles.visualImage}>
            <img
              src="https://d2ol7oe51mr4n9.cloudfront.net/user_3GTV38w6zCm0fb6vRYkPEmmsNnH/43aa0778-58d6-4317-bb5b-6460fc38674c.png"
              alt="Fluxknight team collaborating around a laptop with customer growth, enquiries, bookings, and follow-up automation"
              loading="lazy"
              decoding="async"
            />
          </div>
        </div>

        <div className={styles.supportingCopy}>
          <p>
            One system keeping customer operations moving across the channels you
            already use.
          </p>
          <ActionLink />
        </div>
      </div>
    </section>
  );
}
