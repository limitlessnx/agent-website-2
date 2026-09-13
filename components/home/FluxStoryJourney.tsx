"use client";

import { motion } from "framer-motion";

const steps = [
  { title: "New lead", meta: "WhatsApp enquiry · just now", align: "left" },
  { title: "Maia qualifies the lead", meta: "Intent and next step captured", align: "right" },
  { title: "Follow-up sent", meta: "Automatic follow-up · WhatsApp", align: "left" },
  { title: "Reminder scheduled", meta: "Tomorrow · 10:00 AM", align: "right" },
  { title: "Appointment booked", meta: "Added to calendar", align: "left" },
  { title: "Customer", meta: "Deal Closed", align: "right", outcome: true },
];

export default function FluxStoryJourney() {
  return (
    <section className="fk-story-section">
      <div className="fk-story-shell">
        <div className="fk-story-copy">
          <span>From lead to revenue</span>
          <h2>From first message to closed deal.</h2>
          <p>Fluxknight keeps the customer journey moving with qualification, follow-up, reminders and scheduling until the next action is completed.</p>
        </div>

        <div className="fk-story-canvas" aria-label="Fluxknight customer journey">
          <div className="fk-story-line" />
          {steps.map((step, index) => (
            <motion.article
              className={`fk-story-card is-${step.align}${step.outcome ? " is-outcome" : ""}`}
              key={step.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.35 }}
              transition={{ duration: 0.45, delay: index * 0.04 }}
            >
              <div className="fk-story-card-top"><i /><small>{index + 1}</small></div>
              <strong>{step.title}</strong>
              <span>{step.meta}</span>
              {step.outcome && <b>Closed</b>}
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
