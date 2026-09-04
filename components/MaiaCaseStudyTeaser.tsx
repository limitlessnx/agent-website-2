"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Network } from "@/components/admin/ServerIcons";
import styles from "./MaiaCaseStudyTeaser.module.css";

export default function MaiaCaseStudyTeaser() {
  return (
    <section className={styles.section} id="maia-case-study" aria-labelledby="maia-case-study-title">
      <div className={styles.glow} />
      <motion.div
        className={styles.card}
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.25 }}
        transition={{ duration: 0.5 }}
      >
        <div className={styles.copy}>
          <span className={styles.eyebrow}>Flagship system · Maia</span>
          <h2 id="maia-case-study-title">Want to see a real <span>agentic system</span> at work?</h2>
          <p>
            Explore how Maia connects enquiry handling, lead qualification, WhatsApp and email follow-up, scheduling, support, CRM, admin visibility, and human handoff inside one real-estate workflow.
          </p>
          <Link className={styles.primary} href="/case-studies/maia" data-cta="maia-case-study-home">
            See Maia in action <ArrowRight size={17} />
          </Link>
        </div>

        <div className={styles.signal} aria-hidden="true">
          <div className={styles.signalGlow} />
          <span className={styles.icon}><Network size={28} /></span>
          <small>Real estate AI operating system</small>
          <strong>Maia</strong>
          <em>11 connected capabilities · one operating flow</em>
        </div>
      </motion.div>
    </section>
  );
}
