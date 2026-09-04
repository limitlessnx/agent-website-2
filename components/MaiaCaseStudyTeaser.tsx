"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Bot,
  CalendarCheck2,
  CheckCircle2,
  Database,
  Mail,
  MessageSquareText,
  Network,
  UsersRound,
  Workflow,
} from "@/components/admin/ServerIcons";
import styles from "./MaiaCaseStudyTeaser.module.css";

const nodes = [
  { icon: MessageSquareText, label: "Lead capture", detail: "New enquiry captured", className: styles.nodeOne },
  { icon: CheckCircle2, label: "Lead qualification", detail: "Budget + intent scored", className: styles.nodeTwo },
  { icon: MessageSquareText, label: "WhatsApp follow-up", detail: "Follow-up active", className: styles.nodeThree },
  { icon: Mail, label: "Email follow-up", detail: "Nurture sequence sent", className: styles.nodeFour },
  { icon: CalendarCheck2, label: "Scheduling", detail: "Inspection booked", className: styles.nodeFive },
  { icon: Workflow, label: "Reminders", detail: "Next action protected", className: styles.nodeSix },
  { icon: Database, label: "CRM", detail: "Lead record updated", className: styles.nodeSeven },
  { icon: Bot, label: "Leo admin", detail: "Admin visibility live", className: styles.nodeEight },
  { icon: UsersRound, label: "Human handoff", detail: "Agent takes over", className: styles.nodeNine },
];

export default function MaiaCaseStudyTeaser() {
  return (
    <section className={styles.section} id="maia-case-study" aria-labelledby="maia-case-study-title">
      <div className={styles.glow} />
      <div className={styles.shell}>
        <motion.div
          className={styles.copy}
          initial={{ opacity: 0, y: 26 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.5 }}
        >
          <span className={styles.eyebrow}>Flagship case study · Maia</span>
          <h2 id="maia-case-study-title">From enquiry to inspection, automatically.</h2>
          <p>
            Maia is a complete real estate automation system that captures leads, qualifies buyers, follows up across WhatsApp and email, schedules inspections, sends reminders, updates CRM records, and gives admins visibility through Leo.
          </p>

          <div className={styles.benefits}>
            <span><CheckCircle2 size={16} /> Never lose a serious property enquiry</span>
            <span><CheckCircle2 size={16} /> Qualify buyers before agents spend time</span>
            <span><CheckCircle2 size={16} /> Keep follow-up moving across channels</span>
            <span><CheckCircle2 size={16} /> Give management clear operational visibility</span>
          </div>

          <div className={styles.actions}>
            <Link className={styles.primary} href="/case-studies/maia" data-cta="maia-case-study-home">
              View the full case study <ArrowRight size={17} />
            </Link>
            <Link className={styles.secondary} href="/evaluation" data-cta="maia-evaluation-home">
              Evaluate my real estate workflow
            </Link>
          </div>
        </motion.div>

        <motion.div
          className={styles.visual}
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6 }}
        >
          <div className={styles.orbitOne} />
          <div className={styles.orbitTwo} />
          <div className={styles.pulseRing} />
          <div className={styles.connectorCore} />

          <motion.div
            className={styles.centerCard}
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          >
            <span className={styles.centerIcon}><Network size={22} /></span>
            <small>Real estate AI operating system</small>
            <strong>Maia</strong>
            <em><span /> System active</em>
          </motion.div>

          {nodes.map(({ icon: Icon, label, detail, className }, index) => (
            <motion.div
              className={`${styles.node} ${className}`}
              key={label}
              initial={{ opacity: 0, scale: 0.85 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: index * 0.05 }}
              animate={{ y: [0, index % 2 === 0 ? -4 : 4, 0] }}
            >
              <span><Icon size={15} /></span>
              <div><strong>{label}</strong><small>{detail}</small></div>
            </motion.div>
          ))}

          <div className={styles.activityCard}>
            <span className={styles.activityDot} />
            <div><strong>Buyer qualified</strong><small>Inspection follow-up scheduled for tomorrow</small></div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
