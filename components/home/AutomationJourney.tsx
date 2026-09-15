"use client";

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
  {
    number: "01",
    title: "Captures Enquiries",
    text: "Automatically collects leads from your website, Facebook, Instagram, WhatsApp, email and more.",
    icon: MessageSquareText,
    tone: "cyan",
  },
  {
    number: "02",
    title: "Engages & Qualifies",
    text: "Chat and voice agents answer questions, qualify leads and guide them to the next step.",
    icon: UserRound,
    tone: "violet",
  },
  {
    number: "03",
    title: "Books Appointments",
    text: "Schedules calls, viewings or meetings directly to your calendar — no back and forth.",
    icon: CalendarDays,
    tone: "blue",
  },
  {
    number: "04",
    title: "Handles Operations",
    text: "Syncs with your CRM, updates records, sends reminders and keeps your pipeline organised.",
    icon: Settings2,
    tone: "pink",
  },
  {
    number: "05",
    title: "Runs Marketing",
    text: "Sends follow-ups, broadcasts and personalised messages to nurture leads and clients.",
    icon: Megaphone,
    tone: "green",
  },
  {
    number: "06",
    title: "Tracks Results",
    text: "Monitors performance, provides insights and helps you make better decisions.",
    icon: BarChart2,
    tone: "gold",
  },
] as const;

export default function AutomationJourney() {
  return (
    <section className={styles.section} id="services" aria-labelledby="automation-journey-title">
      <div className={styles.frame}>
        <div className={styles.copy}>
          <span className={styles.eyebrow}>What Fluxknight automates</span>
          <h2 id="automation-journey-title">
            From enquiries<br />
            to revenue,<br />
            on <span>autopilot.</span>
          </h2>
          <p>
            Fluxknight automates the repetitive work across your sales, support,
            operations and marketing — so you can focus on growth.
          </p>
          <Link className={styles.cta} href="/pricing" data-cta="automation-pricing">
            See Pricing <ArrowRight size={20} />
          </Link>
          <small>Same tools. Real results. Less manual work.</small>
        </div>

        <div className={styles.journey} aria-label="Fluxknight automation workflow">
          <svg className={styles.connector} viewBox="0 0 560 820" preserveAspectRatio="none" aria-hidden="true">
            <path d="M330 0 C330 70 355 74 355 112 C355 165 450 150 450 215 C450 270 355 255 355 318 C355 375 455 360 455 420 C455 485 355 470 355 525 C355 590 450 575 450 640 C450 700 355 690 355 745 C355 785 390 790 390 820" />
          </svg>

          {steps.map(({ number, title, text, icon: Icon, tone }, index) => (
            <article
              className={`${styles.step} ${styles[`step${index + 1}`]} ${styles[tone]}`}
              key={number}
            >
              <span className={styles.number}>{number}</span>
              <span className={styles.node} aria-hidden="true"><span /></span>
              <div className={styles.card}>
                <span className={styles.iconWrap} aria-hidden="true">
                  <span className={styles.iconCore}><Icon size={26} strokeWidth={2} /></span>
                </span>
                <div className={styles.cardCopy}>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </div>
            </article>
          ))}

          <span className={styles.endDot} aria-hidden="true" />
          <span className={styles.signature} aria-hidden="true">Less work.<br />More growth.</span>
        </div>
      </div>
    </section>
  );
}
