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
  { number: "01", title: "Captures Enquiries", text: "Automatically collects leads from your website, Facebook, Instagram, WhatsApp, email and more.", icon: MessageSquareText, tone: "cyan" },
  { number: "02", title: "Engages & Qualifies", text: "Chat and voice agents answer questions, qualify leads and guide them to the next step.", icon: UserRound, tone: "violet" },
  { number: "03", title: "Books Appointments", text: "Schedules calls, viewings or meetings directly to your calendar — no back and forth.", icon: CalendarDays, tone: "blue" },
  { number: "04", title: "Handles Operations", text: "Syncs with your CRM, updates records, sends reminders and keeps your pipeline organised.", icon: Settings2, tone: "pink" },
  { number: "05", title: "Runs Marketing", text: "Sends follow-ups, broadcasts and personalised messages to nurture leads and clients.", icon: Megaphone, tone: "green" },
  { number: "06", title: "Tracks Results", text: "Monitors performance, provides insights and helps you make better decisions.", icon: BarChart2, tone: "gold" },
] as const;

function ActionLink({ className = "" }: { className?: string }) {
  return (
    <Link className={`${styles.actionLink} ${className}`} href="/case-studies/maia" data-cta="automation-maia-case-study">
      <span className={styles.playMark} aria-hidden="true"><span /></span>
      <span className={styles.actionCopy}>
        <strong>See Fluxknight in action</strong>
        <small>Watch the Maia case study</small>
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
          <span className={styles.eyebrow}>What Fluxknight automates</span>
          <h2 id="automation-journey-title">From enquiries<br />to revenue,<br />on <span>autopilot.</span></h2>
          <p>Fluxknight automates the repetitive work across your sales, support, operations and marketing — so you can focus on growth.</p>
          <ActionLink className={styles.desktopAction} />
        </div>

        <div className={styles.journey} aria-label="Fluxknight automation workflow">
          <svg className={styles.connector} viewBox="0 0 560 620" preserveAspectRatio="none" aria-hidden="true">
            <path d="M168 46 C130 72 130 78 168 100 C206 122 206 128 168 150 C130 172 130 178 168 200 C206 222 206 228 168 250 C130 272 130 278 168 300 C206 322 206 328 168 350 C130 372 130 378 168 400 C206 422 206 428 168 450 C130 472 130 478 168 500 C206 522 206 528 168 550" />
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
