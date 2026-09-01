"use client";

import { Bot, CalendarCheck2, CheckCircle2, Database, MessageSquareText, Zap } from "lucide-react";
import { motion } from "framer-motion";
import type { CSSProperties } from "react";

const steps = [
  "Inbound message received",
  "Leo selects the sales agent",
  "CRM and workflow updated",
  "Human-ready follow-up returned",
];

export default function AiOperationsCanvas() {
  return (
    <motion.div
      className="ops-canvas-shot"
      initial={false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.9, delay: 0.25 }}
      aria-label="Fluxknight AI operations workflow animation"
    >
      <div className="ops-canvas-shell">
        <div className="ops-canvas-topbar">
          <span><span className="visual-live-dot" /> AI Operations Canvas</span>
          <em>Live sequence</em>
        </div>

        <div className="ops-canvas">
          <div className="ops-depth-layer layer-one" />
          <div className="ops-depth-layer layer-two" />

          <svg className="ops-routes" viewBox="0 0 1100 620" aria-hidden="true">
            <defs>
              <linearGradient id="routeViolet" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#d8b8ff" stopOpacity=".1" />
                <stop offset="45%" stopColor="#b98aff" />
                <stop offset="100%" stopColor="#83dbae" />
              </linearGradient>
              <linearGradient id="routeAmber" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#83dbae" />
                <stop offset="48%" stopColor="#f3bd68" />
                <stop offset="100%" stopColor="#caa7ff" stopOpacity=".16" />
              </linearGradient>
            </defs>
            <path className="ops-route base" d="M88 260 C260 118 400 142 544 296" />
            <path className="ops-route active route-one" d="M88 260 C260 118 400 142 544 296" />
            <path className="ops-route base" d="M556 284 C680 96 870 128 1018 244" />
            <path className="ops-route active route-two" d="M556 284 C680 96 870 128 1018 244" />
            <path className="ops-route base" d="M574 338 C728 444 872 444 1028 356" />
            <path className="ops-route active route-three" d="M574 338 C728 444 872 444 1028 356" />
            <path className="ops-route base" d="M520 354 C374 514 206 502 80 392" />
            <path className="ops-route active route-four" d="M520 354 C374 514 206 502 80 392" />
          </svg>

          <div className="ops-orbit orbit-one" />
          <div className="ops-orbit orbit-two" />
          <div className="ops-orbit orbit-three" />

          <div className="ops-signal signal-one" />
          <div className="ops-signal signal-two" />
          <div className="ops-signal signal-three" />

          <div className="ops-message-stream">
            <span><MessageSquareText size={14} /> WhatsApp</span>
            <strong>Can your AI handle leads and follow-ups?</strong>
          </div>

          <div className="ops-leo-node">
            <Bot size={27} />
            <strong>LEO</strong>
            <span>Reasoning core</span>
          </div>

          <div className="ops-decision-strip">
            <span>Intent: sales enquiry</span>
            <span>Confidence 97%</span>
            <span>Route: sales + CRM</span>
          </div>

          <div className="ops-agent-rail rail-sales">
            <span><Zap size={14} /> Sales</span>
            <strong>Lead qualified</strong>
          </div>

          <div className="ops-agent-rail rail-crm">
            <span><Database size={14} /> CRM</span>
            <strong>Record enriched</strong>
          </div>

          <div className="ops-agent-rail rail-reply">
            <span><CalendarCheck2 size={14} /> Return</span>
            <strong>Demo route queued</strong>
          </div>

          <div className="ops-timeline" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>

          <div className="ops-status-stack">
            {steps.map((step, index) => (
              <span style={{ "--step": index } as CSSProperties} key={step}>
                <CheckCircle2 size={14} />
                {step}
              </span>
            ))}
          </div>

          <div className="ops-metrics">
            <div><span>Lead time saved</span><strong>92%</strong></div>
            <div><span>Workflow state</span><strong>Live</strong></div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
