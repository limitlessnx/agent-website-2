"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Database, MessageSquareText, Network, Workflow } from "@/components/admin/ServerIcons";

const integrations = ["WhatsApp", "Gmail", "Google Calendar", "Resend", "ElevenLabs", "n8n"];
const activity = [
  { label: "New lead", meta: "WhatsApp · 2m ago" },
  { label: "Maia qualified lead", meta: "Intent captured · ready" },
  { label: "Follow-up scheduled", meta: "Tomorrow · 10:00 AM" },
];

export default function FluxRebuildHero() {
  return (
    <>
      <section className="fk-rebuild-hero">
        <div className="fk-rebuild-ambient fk-rebuild-ambient-a" />
        <div className="fk-rebuild-ambient fk-rebuild-ambient-b" />
        <div className="fk-rebuild-hero-shell">
          <motion.div className="fk-rebuild-copy" initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            <h1>Grow your organization <span>without growing the workload.</span></h1>
            <p>Fluxknight builds AI systems that handle customer conversations and the work that follows, from enquiry and support to follow-up, scheduling, CRM updates, and human handoff.</p>
            <div className="fk-rebuild-actions">
              <Link className="fk-rebuild-primary" href="/evaluation">Evaluate My Business <ArrowRight size={17} /></Link>
              <Link className="fk-rebuild-secondary" href="#services">See What We Automate <ArrowRight size={16} /></Link>
            </div>
          </motion.div>

          <motion.div className="fk-rebuild-dashboard-wrap" initial={{ opacity: 0, y: 48, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.85, delay: 0.18 }}>
            <div className="fk-rebuild-dashboard-glow" />
            <div className="fk-rebuild-dashboard">
              <aside className="fk-rebuild-sidebar">
                <div className="fk-rebuild-brandmark"><span>F</span></div>
                <nav>
                  <span className="is-active"><Network size={17} /> Overview</span>
                  <span><MessageSquareText size={17} /> Conversations</span>
                  <span><Workflow size={17} /> Automations</span>
                  <span><Database size={17} /> CRM & Pipeline</span>
                </nav>
                <div className="fk-rebuild-sidebar-foot"><small>System status</small><strong><i /> All systems active</strong></div>
              </aside>

              <div className="fk-rebuild-dashboard-main">
                <div className="fk-rebuild-dashboard-topbar"><div><small>Customer operations</small><h2>Overview</h2></div><span>Live activity</span></div>
                <div className="fk-rebuild-metrics">
                  <article><small>Active conversations</small><strong>128</strong><span>+12.8%</span></article>
                  <article><small>Qualified leads</small><strong>46</strong><span>+8.2%</span></article>
                  <article><small>Appointments</small><strong>21</strong><span>+5.1%</span></article>
                </div>
                <div className="fk-rebuild-dashboard-grid">
                  <article className="fk-rebuild-activity-card">
                    <header><div><small>Live activity</small><h3>Customer journey</h3></div><span>Live</span></header>
                    <div className="fk-rebuild-activity-list">{activity.map((item) => <div className="fk-rebuild-activity-row" key={item.label}><i /><div><strong>{item.label}</strong><small>{item.meta}</small></div><b>›</b></div>)}</div>
                  </article>
                  <article className="fk-rebuild-conversion-card">
                    <div className="fk-rebuild-ring"><span>68%</span></div>
                    <small>Lead conversion</small><strong>Moving in the right direction</strong>
                    <div className="fk-rebuild-conversion-foot"><span>Qualified</span><b>46</b></div>
                  </article>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="fk-rebuild-integrations"><div className="fk-rebuild-integrations-shell"><p>Works with the tools your business already uses.</p><div className="fk-rebuild-integration-viewport"><div className="fk-rebuild-integration-row">{[...integrations, ...integrations].map((name, index) => <span key={`${name}-${index}`} aria-hidden={index >= integrations.length}>{name}</span>)}</div></div></div></section>
    </>
  );
}
