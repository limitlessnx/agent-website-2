"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, BellRing, CheckCircle2, MessageSquareText, Network, UsersRound } from "@/components/admin/ServerIcons";
import styles from "./FluxMobileProduct.module.css";

const mobileItems = [
  { icon: MessageSquareText, title: "Customer messages", value: "128 active" },
  { icon: BellRing, title: "Follow-ups", value: "18 due today" },
  { icon: UsersRound, title: "Human handoff", value: "6 assigned" },
];

export default function FluxMobileProduct() {
  return (
    <section className={styles.section} aria-labelledby="flux-mobile-title">
      <div className={styles.shell}>
        <motion.div
          className={styles.copy}
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 0.48 }}
        >
          <h2 id="flux-mobile-title">Fluxknight also works on your phone.</h2>
          <p>
            Fluxknight gives teams a clear view of conversations, follow-ups, reminders, appointments, and handoffs without waiting for someone to open a spreadsheet.
          </p>
          <div className={styles.actions}>
            <Link href="/portal">Open client portal <ArrowRight size={16} /></Link>
            <Link href="/evaluation">Evaluate My Business <ArrowRight size={16} /></Link>
          </div>
        </motion.div>

        <motion.div
          className={styles.deviceWrap}
          initial={{ opacity: 0, y: 30, scale: 0.97 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, amount: 0.28 }}
          transition={{ duration: 0.58, delay: 0.06 }}
        >
          <div className={styles.device} data-flux-media>
            <div className={styles.deviceHeader}>
              <span>Today</span>
              <Network size={17} />
            </div>
            <div className={styles.heroCard}>
              <small>Pipeline health</small>
              <strong>Customer work is moving</strong>
              <div><CheckCircle2 size={15} /> 12 appointments ready</div>
            </div>
            <div className={styles.rows}>
              {mobileItems.map(({ icon: Icon, title, value }) => (
                <article key={title}>
                  <span><Icon size={16} /></span>
                  <div>
                    <strong>{title}</strong>
                    <small>{value}</small>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className={styles.secondDevice} data-flux-media>
            <div className={styles.secondTop}><span>Customer journey</span><Network size={16} /></div>
            <div className={styles.secondGraphic}><span>Fluxknight</span><strong>One connected view</strong></div>
            <div className={styles.secondRows}>
              <span>New Lead <b>Captured</b></span>
              <span>Maia Qualifies <b>Complete</b></span>
              <span>Follow-up Sent <b>Delivered</b></span>
              <span>Customer / Deal Closed <b>Complete</b></span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
