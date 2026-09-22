import Link from "next/link";
import {
  ArrowRight,
  BarChart2,
  CalendarDays,
  MessageSquareText,
  Megaphone,
  Settings2,
  UserRound,
} from "@/components/admin/ServerIcons";
import styles from "./AutomationJourney.module.css";

const steps = [
  { number: "01", title: "Replies to Enquiries", text: "Answers common questions from your website, WhatsApp, social media, email and other customer channels.", icon: MessageSquareText, tone: "cyan" },
  { number: "02", title: "Helps With Sales & Orders", text: "Collects the details your team needs, helps customers move forward and keeps sales or order requests organised.", icon: UserRound, tone: "violet" },
  { number: "03", title: "Follows Up Automatically", text: "Checks back with leads and customers so good opportunities do not go cold because someone forgot to follow up.", icon: Megaphone, tone: "green" },
  { number: "04", title: "Handles Bookings & Reminders", text: "Books calls, appointments, inspections or meetings and sends reminders without the usual back and forth.", icon: CalendarDays, tone: "blue" },
  { number: "05", title: "Keeps Records Updated", text: "Saves customer details, updates records and keeps important information organised for your team.", icon: Settings2, tone: "pink" },
  { number: "06", title: "Hands Important Work to Your Team", text: "Passes serious, urgent or unusual requests to the right person with the conversation details already attached.", icon: BarChart2, tone: "gold" },
] as const;

function ActionLink({ className = "" }: { className?: string }) {
  return (
    <Link className={`${styles.actionLink} ${className}`} href="/case-studies/maia" data-cta="automation-maia-case-study">
      <span className={styles.playMark} aria-hidden="true"><span /></span>
      <span className={styles.actionCopy}>
        <strong>See a real example</strong>
        <small>See how Maia works in real estate</small>
      </span>
      <ArrowRight className={styles.actionArrow} size={24} />
    </Link>
  );
}

export default function AutomationJourney() {
  return (
    <section className={styles.section} id="services" aria-labelledby="automation-journey-title">
      <div className={styles.frame}>
        <div className={styles.copy}>
          <span className={styles.eyebrow}>What Fluxknight can handle</span>
          <h2 id="automation-journey-title">Here are some of the things<br />Fluxknight can handle<br />for <span>your business.</span></h2>
          <p>Customer enquiries, sales, orders, follow-up, bookings, reminders and record updates can all take time. Fluxknight helps handle the repetitive parts so your team can focus on the work that needs a person.</p>
          <ActionLink className={styles.desktopAction} />
        </div>

        <div className={styles.journey} aria-label="Fluxknight automation workflow">
          <svg className={`${styles.connector} ${styles.desktopConnector}`} viewBox="0 0 560 620" preserveAspectRatio="none" aria-hidden="true">
            <path d="M168 46 C130 72 130 78 168 100 C206 122 206 128 168 150 C130 172 130 178 168 200 C206 222 206 228 168 250 C130 272 130 278 168 300 C206 322 206 328 168 350 C130 372 130 378 168 400 C206 422 206 428 168 450 C130 472 130 478 168 500 C206 522 206 528 168 550" />
          </svg>
          <svg className={`${styles.connector} ${styles.mobileConnector}`} viewBox="0 0 340 500" preserveAspectRatio="none" aria-hidden="true">
            <path d="M88 38 C112 57 113 73 92 89 C69 107 69 124 92 141 C116 159 116 176 92 193 C69 211 69 228 92 245 C116 263 116 280 92 297 C69 315 69 332 92 349 C116 367 116 384 92 401 C72 416 76 435 101 452 C122 466 126 477 126 490" />
          </svg>

          {steps.map(({ number, title, text, icon: Icon, tone }, index) => (
            <article className={`${styles.step} ${styles[`step${index + 1}`]} ${styles[tone]}`} key={number}>
              <span className={styles.number}>{number}</span>
              <span className={styles.node} aria-hidden="true"><span /></span>
              <div className={styles.card}>
                <span className={styles.iconWrap} aria-hidden="true"><span className={styles.iconCore}><Icon size={26} strokeWidth={2} /></span></span>
                <div className={styles.cardCopy}><h3>{title}</h3><p>{text}</p></div>
              </div>
            </article>
          ))}

          <span className={styles.signature} aria-hidden="true">Less work.<br />More growth.</span>
        </div>
        <ActionLink className={styles.stackedAction} />
      </div>
    </section>
  );
}
