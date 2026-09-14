"use client";

import { CalendarCheck2, CheckCircle2, Clock3, MessageSquareText, Send, UserCheck } from "@/components/admin/ServerIcons";

const storyCopy = "Fluxknight keeps the customer journey moving with qualification, follow-up, reminders and scheduling until the next action is completed.";

const steps = [
  { icon: MessageSquareText, title: "New Lead", meta: "WhatsApp enquiry received", align: "left" },
  { icon: UserCheck, title: "Maia Qualifies", meta: "Intent and next step captured", align: "right" },
  { icon: Send, title: "Follow-up Sent", meta: "Automatic follow-up delivered", align: "left" },
  { icon: Clock3, title: "Reminder Scheduled", meta: "Tomorrow · 10:00 AM", align: "right" },
  { icon: CalendarCheck2, title: "Appointment Booked", meta: "Added to the calendar", align: "left" },
  { icon: CheckCircle2, title: "Customer", meta: "Deal Closed", align: "right", outcome: true },
];

export default function FluxStoryJourney() {
  return (
    <section className="fk-story-section">
      <div className="fk-story-shell">
        <div className="fk-story-copy">
          <span>From lead to revenue</span>
          <h2>From first message to closed deal.</h2>
          <p>{storyCopy.split(" ").map((word, index) => <span data-flux-word key={`${word}-${index}`}>{word} </span>)}</p>
        </div>

        <div className="fk-story-canvas" aria-label="Fluxknight customer journey">
          <div className="fk-story-line" />
          {steps.map(({ icon: Icon, ...step }, index) => (
            <article
              className={`fk-story-card is-${step.align}${step.outcome ? " is-outcome" : ""}`}
              key={step.title}
              data-flux-step
            >
              <div className="fk-story-card-top"><i><Icon size={15} /></i><small>{String(index + 1).padStart(2, "0")}</small></div>
              <strong>{step.title}</strong>
              <span>{step.meta}</span>
              {step.outcome && <b>Closed</b>}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
