"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CalendarCheck2,
  CheckCircle2,
  Database,
  MessageSquareText,
} from "@/components/admin/ServerIcons";
import styles from "./MaiaCaseStudyTeaser.module.css";

const outcomes = [
  { icon: MessageSquareText, label: "24/7 replies" },
  { icon: CheckCircle2, label: "Faster follow-up" },
  { icon: CalendarCheck2, label: "Booked inspections" },
];

export default function MaiaCaseStudyTeaser() {
  return (
    <section className={styles.section} id="maia-case-study" aria-labelledby="maia-case-study-title">
      <div className={styles.glow} aria-hidden="true" />
      <motion.article
        className={styles.card}
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.45 }}
      >
        <div className={styles.proofVisual} aria-label="Maia real estate enquiry and lead workflow preview">
          <img
            className={styles.proofImage}
            src="/maia-hero-generated.webp"
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
          />
          <div className={styles.visualShade} aria-hidden="true" />

          <div className={styles.chatPanel}>
            <div className={styles.panelHead}>
              <span className={styles.statusDot} />
              <div><strong>Prospect</strong><small>online</small></div>
            </div>
            <div className={styles.messageIncoming}>Hi, I&apos;m interested in this property. Is it still available?</div>
            <div className={styles.messageOutgoing}>Thanks for your enquiry. I can help with that. Would you like to book an inspection?</div>
            <div className={styles.messageIncoming}>Yes, please!</div>
            <div className={styles.messageBar}>Type a message… <span>➤</span></div>
          </div>

          <div className={styles.agentBadge}><span>✦</span><div><small>AI</small><strong>Maia Sales Agent</strong></div></div>
          <div className={styles.connectorLine} aria-hidden="true" />

          <div className={styles.leadPanel}>
            <div className={styles.leadPanelHead}><Database size={14} /><span>Limitless Realty</span></div>
            <div className={styles.propertyRow}>
              <div className={styles.propertyThumb} />
              <div><small>New lead</small><strong>Property enquiry</strong></div>
              <span className={styles.qualified}>Qualified</span>
            </div>
            <dl className={styles.leadDetails}>
              <div><dt>Budget</dt><dd>Qualified</dd></div>
              <div><dt>Interest</dt><dd>3-bed home</dd></div>
              <div><dt>Next step</dt><dd>Inspection booked</dd></div>
            </dl>
            <div className={styles.inspection}><CalendarCheck2 size={14} /><div><small>Inspection scheduled</small><strong>Buyer + property connected</strong></div></div>
          </div>
        </div>

        <div className={styles.content}>
          <span className={styles.eyebrow}>Real estate · AI sales</span>
          <h2 id="maia-case-study-title">From enquiry to <span>booked inspection.</span></h2>
          <p>
            See how Maia captures property enquiries, qualifies prospects, follows up automatically, and moves serious buyers toward inspections while keeping the team and CRM updated.
          </p>

          <div className={styles.outcomes} aria-label="Maia case study outcomes">
            {outcomes.map(({ icon: Icon, label }) => (
              <div className={styles.outcome} key={label}>
                <Icon size={18} />
                <span>{label}</span>
              </div>
            ))}
          </div>

          <div className={styles.attribution}>Limitless Realty <span>×</span> Fluxknight</div>

          <Link className={styles.primary} href="/case-studies/maia" data-cta="maia-case-study-home">
            View case study <ArrowRight size={18} />
          </Link>
        </div>
      </motion.article>
    </section>
  );
}
