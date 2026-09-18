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
import maiaPhoneVisual from "./maiaPhoneVisual";

const outcomes = [
  { icon: MessageSquareText, label: "24/7 replies" },
  { icon: CheckCircle2, label: "Faster follow-up" },
  { icon: CalendarCheck2, label: "Booked inspections" },
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
      <motion.article
        className={styles.card}
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.45 }}
      >
        <div className={styles.referenceVisual} aria-label="Maia real-phone conversation and CRM workflow">
          <img className={styles.referenceVisualImage} src={maiaPhoneVisual} alt="Prospect WhatsApp conversation beside Maia AI sales agent and Limitless Realty CRM" />
        </div>

        <div className={styles.content}>
          <span className={styles.eyebrow}>Real estate · AI sales</span>
          <h2 id="maia-case-study-title">From enquiry to <span>booked inspection</span></h2>
          <p>How Maia helped automate lead capture, follow-up, qualification and inspection booking for Limitless Realty.</p>

          <div className={styles.outcomes} aria-label="Maia case study outcomes">
            {outcomes.map(({ icon: Icon, label }) => (
              <div className={styles.outcome} key={label}>
                <Icon size={19} />
                <span>{label}</span>
              </div>
            ))}
          </div>

          <div className={styles.attribution}>Limitless Realty <span>×</span> Fluxknight</div>

          <Link className={styles.primary} href="/case-studies/maia" data-cta="maia-case-study-home">
            View case study <ArrowRight size={19} />
          </Link>
        </div>
      </motion.article>
    </section>
  );
}
