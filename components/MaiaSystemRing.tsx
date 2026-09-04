"use client";

import { motion } from "framer-motion";
import {
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
import styles from "./MaiaSystemRing.module.css";

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
  [500, 78], [290, 90], [110, 205], [85, 390], [175, 585],
  [385, 690], [615, 690], [825, 585], [915, 390], [890, 205], [710, 90],
];

export default function MaiaSystemRing() {
  return (
    <motion.div
      className={styles.visual}
      initial={{ opacity: 0, scale: 0.98 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, amount: 0.12 }}
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

      <motion.div className={styles.centerCard} animate={{ y: [0, -5, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}>
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
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.34, delay: index * 0.04 }}
          >
            <span><Icon size={16} /></span>
            <div><strong>{label}</strong><small>{detail}</small></div>
          </motion.div>
        ))}
      </div>

      <motion.div className={styles.activityCard} animate={{ y: [0, -3, 0] }} transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}>
        <span className={styles.activityDot} />
        <div><strong>Buyer qualified</strong><small>Inspection follow-up scheduled for tomorrow</small></div>
        <em>Just now</em>
      </motion.div>
    </motion.div>
  );
}
