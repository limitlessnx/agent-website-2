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
  { icon: MessageSquareText, label: "Inquiry", detail: "Questions answered", className: styles.nodeOne },
  { icon: MessageSquareText, label: "Lead capture", detail: "New enquiry captured", className: styles.nodeTwo },
  { icon: UsersRound, label: "Human handoff", detail: "Agent takes over", className: styles.nodeThree },
  { icon: MessageSquareText, label: "WhatsApp follow-up", detail: "Follow-up active", className: styles.nodeFour },
  { icon: CalendarCheck2, label: "Scheduling", detail: "Inspection booked", className: styles.nodeFive },
  { icon: Database, label: "CRM", detail: "Lead record updated", className: styles.nodeSix },
  { icon: Bot, label: "Leo admin", detail: "Admin visibility live", className: styles.nodeSeven },
  { icon: Workflow, label: "Reminders", detail: "Next action protected", className: styles.nodeEight },
  { icon: Mail, label: "Email follow-up", detail: "Nurture sequence sent", className: styles.nodeNine },
  { icon: Bot, label: "Support desk", detail: "Support routed", className: styles.nodeTen },
  { icon: CheckCircle2, label: "Lead qualification", detail: "Budget + intent scored", className: styles.nodeEleven },
];

const connectorPoints = [
  [500, 78],
  [290, 90],
  [110, 205],
  [85, 390],
  [175, 585],
  [385, 690],
  [615, 690],
  [825, 585],
  [915, 390],
  [890, 205],
  [710, 90],
];

export default function MaiaCaseStudyTeaser() {
  return (
    <section className={styles.section} id="maia-case-study" aria-labelledby="maia-case-study-title">
      <div className={styles.glow} />
      <div className={styles.shell}>
        <motion.div
          className={styles.copy}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.22 }}
          transition={{ duration: 0.5 }}
        >
          <span className={styles.eyebrow}>Flagship case study · Maia</span>
          <h2 id="maia-case-study-title">Maia in action: <span>Real estate, reimagined.</span></h2>
          <p>
            Maia is a connected real estate AI operating system that handles inquiries, captures and qualifies leads, follows up across WhatsApp and email, schedules inspections, sends reminders, supports customers, updates CRM records, gives admins visibility through Leo, and hands serious conversations to human agents with context intact.
          </p>

          <div className={styles.benefits}>
            <span><CheckCircle2 size={16} /> Never lose a serious property enquiry</span>
            <span><CheckCircle2 size={16} /> Qualify buyers before agents spend time</span>
            <span><CheckCircle2 size={16} /> Keep follow-up and support moving across channels</span>
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
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.65 }}
        >
          <div className={styles.visualHalo} />
          <svg className={styles.connections} viewBox="0 0 1000 770" preserveAspectRatio="none" aria-hidden="true">
            <ellipse className={styles.flowTrack} cx="500" cy="385" rx="405" ry="305" />
            <ellipse className={styles.flowGlow} cx="500" cy="385" rx="405" ry="305" />
            <ellipse className={styles.innerTrack} cx="500" cy="385" rx="315" ry="230" />
            {connectorPoints.map(([x, y], index) => (
              <line className={styles.spoke} key={`${x}-${y}`} x1="500" y1="385" x2={x} y2={y} style={{ animationDelay: `${index * -0.34}s` }} />
            ))}
          </svg>

          <motion.div
            className={styles.centerCard}
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          >
            <span className={styles.centerIcon}><Network size={24} /></span>
            <small>Real estate AI operating system</small>
            <strong>Maia</strong>
            <em><span /> System active</em>
          </motion.div>

          <div className={styles.nodeLayer} role="list" aria-label="Maia connected automation capabilities">
            {nodes.map(({ icon: Icon, label, detail, className }, index) => (
              <motion.div
                className={`${styles.node} ${className}`}
                key={label}
                role="listitem"
                initial={{ opacity: 0, scale: 0.88 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.36, delay: index * 0.045 }}
              >
                <span><Icon size={16} /></span>
                <div><strong>{label}</strong><small>{detail}</small></div>
              </motion.div>
            ))}
          </div>

          <motion.div
            className={styles.activityCard}
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <span className={styles.activityDot} />
            <div><strong>Buyer qualified</strong><small>Inspection follow-up scheduled for tomorrow</small></div>
            <em>Just now</em>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
