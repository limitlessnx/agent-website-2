"use client";

import Link from "next/link";
import { ArrowRight, BarChart2, Bot, Database, LineChart, Network, ShieldCheck, Sparkles } from "@/components/admin/ServerIcons";

const features = [
  { icon: Database, title: "Unify Your Data", text: "Bring conversations, customer records, follow-up, and operations into one clear working view.", className: "astral-feature-wide" },
  { icon: LineChart, title: "Real-time Insights", text: "See what is moving, what needs attention, and where the next opportunity sits.", className: "astral-feature-tall" },
  { icon: Bot, title: "Automate Smarter", text: "Turn repeatable decisions into dependable workflows with Maia and connected AI agents.", className: "astral-feature-tall" },
  { icon: ShieldCheck, title: "Enterprise Ready", text: "Keep ownership, approvals, records, and team visibility organized as the business grows.", className: "astral-feature-wide" },
];

export default function AstralInsights() {
  return (
    <section className="astral-insights" id="insights" aria-labelledby="astral-title">
      <div className="astral-shell">
        <div className="astral-intro">
          <div>
            <span className="astral-mono"><Sparkles size={14} /> AI-Powered Insights</span>
            <h2 id="astral-title">Turn complexity into clarity. <em>Move faster.</em></h2>
          </div>
          <p>Astral brings the signals behind your customer operations into focus, then turns the next action into a workflow your team can trust.</p>
        </div>

        <div className="astral-dashboard" data-astral-reveal>
          <div className="astral-dashboard-top"><div><span className="astral-mono">Workspace overview</span><h3>Good morning, Alex</h3></div><span className="astral-live"><i /> All systems active</span></div>
          <div className="astral-dashboard-grid">
            <div className="astral-metric astral-metric-primary"><span>Pipeline value</span><strong>₦24.8m</strong><small><LineChart size={13} /> 18.4% this month</small><div className="astral-sparkline"><i /><i /><i /><i /><i /><i /><i /></div></div>
            <div className="astral-metric"><span>Qualified leads</span><strong>1,284</strong><small>Across 8 active workflows</small></div>
            <div className="astral-metric"><span>Response time</span><strong>2.4m</strong><small>Down 34% this week</small></div>
            <div className="astral-chart"><div className="astral-chart-head"><span>Customer momentum</span><BarChart2 size={16} /></div><div className="astral-chart-lines"><i /><i /><i /><i /><i /><svg viewBox="0 0 520 130" preserveAspectRatio="none" aria-hidden="true"><path d="M0 111 C42 108 52 84 92 92 S142 72 181 81 S228 33 264 58 S314 44 350 48 S396 16 430 31 S484 15 520 7" /></svg></div><div className="astral-chart-labels"><span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span></div></div>
            <div className="astral-activity"><div className="astral-chart-head"><span>Live activity</span><Network size={16} /></div><div className="astral-activity-row"><b>Maia qualified a lead</b><small>2 min ago</small></div><div className="astral-activity-row"><b>Follow-up sequence started</b><small>8 min ago</small></div><div className="astral-activity-row"><b>Appointment booked</b><small>14 min ago</small></div></div>
          </div>
        </div>

        <div className="astral-features" data-astral-stagger>
          {features.map(({ icon: Icon, title, text, className }) => <article className={`astral-feature ${className}`} key={title}><span className="astral-feature-icon"><Icon size={18} /></span><div><h3>{title}</h3><p>{text}</p><Link href="/services">Explore <ArrowRight size={15} /></Link></div></article>)}
        </div>
      </div>
    </section>
  );
}
