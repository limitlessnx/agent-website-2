"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, CalendarCheck2, MessageSquareText, Network, Workflow } from "@/components/admin/ServerIcons";
import styles from "./FluxNumbers.module.css";

const stats = [
  { value: "24/7", label: "Customer response" },
  { value: "5", label: "Core automation layers" },
  { value: "1", label: "Connected customer journey" },
];

const tasks = [
  { icon: MessageSquareText, title: "Enquiry captured", meta: "WhatsApp, website, voice" },
  { icon: Workflow, title: "Follow-up prepared", meta: "Next action stays visible" },
  { icon: CalendarCheck2, title: "Appointment ready", meta: "Reminder scheduled" },
];

export default function FluxNumbers() {
  return (
    <section className={styles.section} aria-labelledby="flux-numbers-title">
      <div className={styles.shell}>
        <motion.div
          className={styles.copy}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 0.5 }}
        >
          <h2 id="flux-numbers-title">Fluxknight in numbers.</h2>
          <p>
            Fluxknight keeps response, qualification, follow-up, reminders, scheduling, CRM updates, and human handoff in one customer operations flow.
          </p>

          <div className={styles.stats} aria-label="Fluxknight customer operations numbers">
            {stats.map((stat) => (
              <article key={stat.label} className={styles.statCard}>
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </article>
            ))}
          </div>
        </motion.div>

        <motion.div
          className={styles.visual}
          initial={{ opacity: 0, y: 34, scale: 0.97 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, delay: 0.08 }}
          aria-label="Fluxknight mobile operations preview"
        >
          <div className={styles.phone} data-flux-media>
            <div className={styles.phoneTop}>
              <span>Fluxknight</span>
              <Network size={17} />
            </div>
            <div className={styles.search}>Search leads, tasks, messages</div>
            <div className={styles.highlight}>
              <small>Today</small>
              <strong>46 qualified leads</strong>
              <span>12 appointments ready</span>
            </div>
            <div className={styles.taskList}>
              {tasks.map(({ icon: Icon, title, meta }) => (
                <div className={styles.taskRow} key={title}>
                  <span className={styles.taskIcon}><Icon size={15} /></span>
                  <div>
                    <strong>{title}</strong>
                    <small>{meta}</small>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.floatCard}>
            <span>Live</span>
            <strong>Customer journey is moving</strong>
            <Link href="/evaluation">
              Evaluate My Business <ArrowRight size={14} />
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
