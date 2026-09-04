"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "@/components/admin/ServerIcons";
import styles from "./MaiaCaseStudyTeaser.module.css";

export default function MaiaCaseStudyTeaser() {
  return (
    <section className={styles.section} id="maia-case-study" aria-labelledby="maia-case-study-title">
      <div className={styles.glow} />
      <motion.div
        className={styles.card}
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.45 }}
      >
        <div className={styles.copy}>
          <span className={styles.eyebrow}>Case study · Maia</span>
          <h2 id="maia-case-study-title">See what Fluxknight looks like <span>in practice.</span></h2>
          <p>
            Maia is a real estate AI system that connects enquiries, qualification, follow-up, scheduling, support, CRM updates, admin visibility, and human handoff in one working customer journey.
          </p>
        </div>

        <Link className={styles.primary} href="/case-studies/maia" data-cta="maia-case-study-home">
          Explore the Maia case study <ArrowRight size={17} />
        </Link>
      </motion.div>
    </section>
  );
}
