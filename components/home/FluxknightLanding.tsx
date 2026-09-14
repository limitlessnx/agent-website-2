"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import PricingCarousel from "@/components/PricingCarousel";
import { ArrowRight, Bot, CalendarDays, CheckCircle2, Database, MessageSquareText, Network, Search, ShieldCheck, Sparkles, Workflow } from "@/components/admin/ServerIcons";

type Icon = ComponentType<{ size?: number }>;
type Pillar = { icon: Icon; title: string; text: string; detail: string };
type Plan = { icon: Icon; slug: string; name: string; firstMonth: string; ongoing: string; description: string; features: string[]; cta: string; featured?: boolean; custom?: boolean };

const agentCards = [
  { icon: MessageSquareText, name: "Support Agent", text: "Answers approved questions, captures context, and knows when a person should take over." },
  { icon: Network, name: "Lead Agent", text: "Understands new enquiries, qualifies interest, and keeps the right next action visible." },
  { icon: Workflow, name: "Follow-up Agent", text: "Keeps conversations moving with timely follow-up, reminders, and re-engagement." },
  { icon: CalendarDays, name: "Booking Agent", text: "Turns intent into scheduled appointments while keeping records and owners up to date." },
];

const industries = ["Real Estate", "Hospitality", "Healthcare", "Sales Companies", "E-commerce", "Professional Services"];

export default function FluxknightLanding({ automationPillars, pricingPlans }: { automationPillars: Pillar[]; pricingPlans: Plan[] }) {
  return (
    <div className="fk-platform">
      <section className="fk-platform-hero" id="top">
        <div className="fk-platform-hero-copy">
          <span className="fk-platform-kicker"><Sparkles size={14} /> The operating layer for modern organizations</span>
          <h1>Specialized AI agents for the work your business already does.</h1>
          <p>Fluxknight connects the conversations, follow-up, and operations that move a customer from first enquiry to meaningful business outcome.</p>
          <div className="fk-platform-actions"><Link className="fk-platform-primary" href="/pricing">Start a Trial <ArrowRight size={16} /></Link><Link className="fk-platform-secondary" href="/evaluation">Evaluate My Business <ArrowRight size={16} /></Link></div>
        </div>
        <div className="fk-platform-orbit" aria-hidden="true"><span /><span /><span /><span /></div>
        <div className="fk-command-window" data-fk-reveal>
          <div className="fk-command-sidebar"><div className="fk-command-logo">F</div><span className="is-active">Command Center</span><span>Conversations</span><span>Agent activity</span><span>Workflows</span><span>Approvals</span><small>6 agents active</small></div>
          <div className="fk-command-main">
            <div className="fk-command-top"><div><small>Fluxknight Command Center</small><h2>Good morning, Alex</h2></div><span className="fk-command-status"><i /> All systems active</span></div>
            <div className="fk-command-columns">
              <div className="fk-command-panel fk-conversation-panel"><header><span>Conversations</span><b>24 new</b></header><div className="fk-conversation active"><i><MessageSquareText size={14} /></i><div><strong>Website enquiry</strong><small>Interested in a 3 bed villa...</small></div><em>2m</em></div><div className="fk-conversation"><i><Bot size={14} /></i><div><strong>Maia qualified a lead</strong><small>Ready for property matching</small></div><em>5m</em></div><div className="fk-conversation"><i><CalendarDays size={14} /></i><div><strong>Viewing requested</strong><small>Thursday, 10:00 AM</small></div><em>12m</em></div><div className="fk-conversation"><i><CheckCircle2 size={14} /></i><div><strong>Follow-up completed</strong><small>CRM record updated</small></div><em>18m</em></div></div>
              <div className="fk-command-panel fk-agent-panel"><header><span>Agents working together</span><b>Live</b></header><div className="fk-agent-map"><div className="fk-agent-core">F</div>{["Conversation", "Qualification", "Property", "Scheduling", "CRM"].map((name, index) => <div className={`fk-agent-node fk-agent-node-${index}`} key={name}><span>{index === 0 ? <MessageSquareText size={13} /> : index === 1 ? <Search size={13} /> : index === 2 ? <Database size={13} /> : index === 3 ? <CalendarDays size={13} /> : <CheckCircle2 size={13} />}</span>{name}</div>)}</div><div className="fk-command-flow"><span>Understand</span><ArrowRight size={13} /><span>Qualify</span><ArrowRight size={13} /><span>Act</span><ArrowRight size={13} /><span>Convert</span></div></div>
              <div className="fk-command-panel fk-outcome-panel"><header><span>Outcomes</span><b>Today</b></header>{[["Qualified leads", "24"], ["Appointments", "12"], ["Follow-up sent", "18"], ["CRM updates", "36"], ["Deals progressing", "7"]].map(([label, value], index) => <div className="fk-outcome" key={label}><i className={`fk-outcome-icon fk-outcome-${index}`} /><span>{label}</span><strong>{value}</strong><small>↗</small></div>)}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="fk-platform-intro" id="agents"><div className="fk-section-heading"><span>One connected system</span><h2>Every conversation has a next step.</h2><p>Fluxknight gives each part of the customer journey a clear owner, a useful memory, and a reliable way to move work forward.</p></div><div className="fk-agent-grid" data-fk-stagger>{agentCards.map(({ icon: AgentIcon, name, text }) => <article className="fk-agent-card" key={name}><span className="fk-agent-card-icon"><AgentIcon size={19} /></span><h3>{name}</h3><p>{text}</p><Link href="/services">See how it works <ArrowRight size={14} /></Link></article>)}</div></section>

      <section className="fk-platform-journey" id="maia"><div className="fk-journey-copy"><span>Real estate, made visible</span><h2>Maia connects the complete property journey.</h2><p>Maia is Fluxknight’s complete real-estate agent system. It helps teams keep every enquiry, viewing, follow-up, and deal moving in one clear flow.</p><Link className="fk-platform-secondary" href="/case-studies/maia">Explore Maia <ArrowRight size={16} /></Link></div><div className="fk-maia-flow" data-fk-reveal><div className="fk-maia-head"><div><strong>Maia</strong><span>Complete real-estate agent system</span></div><span className="fk-command-status"><i /> Working</span></div><div className="fk-maia-steps">{[[Search, "Property enquiry", "Captured"], [Database, "Property matching", "12 matches"], [CalendarDays, "Viewing", "Booked"], [Workflow, "Follow-up", "Scheduled"], [CheckCircle2, "Deal progression", "Moving"]].map(([StepIcon, label, state]) => <div className="fk-maia-step" key={label}><span><StepIcon size={17} /></span><strong>{label}</strong><small>{state}</small></div>)}</div><div className="fk-maia-footer"><span>Last activity</span><b>Maia updated the customer record and scheduled the next reminder.</b><em><i /> Live</em></div></div></section>

      <section className="fk-platform-capabilities" id="services"><div className="fk-section-heading"><span>Built for the way work moves</span><h2>One system. Different industries.</h2><p>Start with the work that matters most, then connect the next part of the operation as your organization grows.</p></div><div className="fk-capability-layout"><div className="fk-capability-list">{automationPillars.map(({ icon: PillarIcon, title, text, detail }, index) => <article className="fk-capability" key={title}><span className="fk-capability-number">0{index + 1}</span><PillarIcon size={19} /><div><h3>{title}</h3><p>{text}</p><small>{detail}</small></div><ArrowRight size={17} /></article>)}</div><div className="fk-industry-rail"><span>Fluxknight works across</span>{industries.map((industry, index) => <Link href={`/industries/${index === 0 ? "real-estate" : ""}`} key={industry}>{industry}<ArrowRight size={14} /></Link>)}</div></div></section>

      <section className="fk-platform-pricing" id="pricing"><div className="fk-section-heading"><span>Start at the level that fits</span><h2>Make the first useful step.</h2><p>Choose a starting point, see what the trial includes, and add more channels, agents, and workflows as the business grows.</p></div><PricingCarousel plans={pricingPlans} showDurationSelector /><div className="fk-pricing-link"><Link href="/pricing">See full pricing and package details <ArrowRight size={15} /></Link></div></section>

      <section className="fk-platform-cta" id="evaluation"><div><span>Show us where work slows down.</span><h2>We’ll help you find the first system worth connecting.</h2></div><div><p>Start with a trial or evaluate your business before choosing the right level of automation.</p><div className="fk-platform-actions"><Link className="fk-platform-primary" href="/pricing">Start a Trial <ArrowRight size={16} /></Link><Link className="fk-platform-secondary" href="/evaluation">Evaluate My Business <ArrowRight size={16} /></Link></div></div></section>
    </div>
  );
}
