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
        <div className={styles.proofVisual} aria-label="Prospect and Maia conversation workflow preview" data-device-layout="dual-samsung-ultra">
          <div className={styles.visualAura} aria-hidden="true" />

          <div className={styles.deviceRow}>
          <div className={`${styles.device} ${styles.prospectPhone}`}><span className={styles.sideKeyA} /><span className={styles.sideKeyB} /><div className={styles.screen}>
            <div className={styles.samsungCamera} aria-hidden="true" />
            <div className={styles.phoneTop}>
              <span>9:41</span>
              <div className={styles.phoneStatus}><i /><i /><i /><b>⌁</b></div>
            </div>
            <div className={styles.phoneAppHeader}>
              <div className={styles.whatsappMini}><WhatsAppMark /></div>
              <img className={styles.avatar} src="/prospect-avatar.svg" alt="" aria-hidden="true" />
              <div className={styles.phoneIdentity}><strong>Prospect</strong><small>online</small></div>
              <span className={styles.chatMenu}>•••</span>
            </div>
            <div className={styles.phoneMessages}>
              <div className={styles.messageIncoming}>Hi, I&apos;m interested in the property at 12 Riverdale Ave. Is it still available?<small>10:24 AM</small></div>
              <div className={styles.messageOutgoing}>Thanks for your enquiry! I can help with that. Would you like to book an inspection?<small>10:24 AM ✓✓</small></div>
              <div className={styles.messageIncoming}>Yes, please!<small>10:25 AM</small></div>
            </div>
            <div className={styles.messageBar}><span>＋</span><em>Type a message…</em><b>➤</b></div>
            </div>
          </div>

          <div className={styles.agentBridge}>
            <span>✦</span>
            <div><small>AI Sales Agent</small><strong>Maia</strong></div>
          </div>
          <div className={styles.connectorLine} aria-hidden="true" />

          <div className={`${styles.device} ${styles.samsung}`}><span className={styles.sideKeyA} /><span className={styles.sideKeyB} /><div className={styles.screen}>
            <div className={styles.samsungCamera} aria-hidden="true" />
            <div className={styles.phoneTop}>
              <span>9:41</span>
              <div className={styles.phoneStatus}><i /><i /><i /><b>⌁</b></div>
            </div>
            <div className={styles.maiaHeader}>
              <span className={styles.maiaMark}>✦</span>
              <div className={styles.phoneIdentity}><strong>Maia</strong><small>Handling enquiry</small></div>
              <span className={styles.liveState}>LIVE</span>
            </div>
            <div className={styles.maiaConversation}>
              <div className={styles.maiaBubble}>New property enquiry received from Alex Chen.</div>
              <div className={styles.maiaBubbleAccent}>Prospect qualified. Budget confirmed and inspection requested.</div>
            </div>
            <div className={styles.leadPanel}>
              <div className={styles.leadPanelHead}><Database size={14} /><span>Limitless Realty</span></div>
              <div className={styles.propertyRow}>
                <div className={styles.propertyThumb} />
                <div><small>New lead</small><strong>Alex Chen</strong></div>
                <span className={styles.qualified}>Qualified</span>
              </div>
              <dl className={styles.leadDetails}>
                <div><dt>Interested in</dt><dd>12 Riverdale Ave</dd></div>
                <div><dt>Budget</dt><dd>$1.2M – $1.4M</dd></div>
                <div><dt>Next step</dt><dd>Inspection booked</dd></div>
              </dl>
              <div className={styles.inspection}><CalendarCheck2 size={14} /><div><small>Inspection scheduled</small><strong>Sat, 16 Nov · 10:00 AM</strong></div></div>
            </div>
            </div>
          </div>

          </div>
          <div className={styles.annotation}>More conversations.<br />More inspections.<br />More sold.</div>
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
