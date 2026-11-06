"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, MessageCircle, RotateCcw } from "lucide-react";
import styles from "./MaiaInteractiveDemo.module.css";

const scenarios = [
  {
    id: "property",
    label: "Property enquiry",
    description: "A prospective buyer asks about available property.",
    steps: [
      { speaker: "Customer", message: "Hi, I'm interested in a property. Can you help?" },
      { speaker: "Maia", message: "Certainly. Which location are you considering, and what is your budget range?" },
      { speaker: "Customer", message: "I'm looking around Benin City. I'd also like to arrange an inspection." },
      { speaker: "Maia", message: "Thanks. I'll capture your preferred inspection date and share the request with the team for confirmation." },
    ],
    outcome: "Buyer preferences captured · Inspection request prepared for human confirmation",
  },
  {
    id: "hotel",
    label: "Guest enquiry",
    description: "A guest asks about a room booking.",
    steps: [
      { speaker: "Customer", message: "Hello, do you have rooms available next weekend?" },
      { speaker: "Maia", message: "I can help with your request. What dates and how many guests should I note?" },
      { speaker: "Customer", message: "Friday to Sunday, for two people." },
      { speaker: "Maia", message: "I've noted your dates and party size. I'll pass the request to the team to confirm availability." },
    ],
    outcome: "Guest details captured · Availability awaits staff confirmation",
  },
  {
    id: "service",
    label: "Service enquiry",
    description: "A customer needs an appointment.",
    steps: [
      { speaker: "Customer", message: "I'd like to book a consultation. How does it work?" },
      { speaker: "Maia", message: "I can explain the process and collect a few details. What service do you need?" },
      { speaker: "Customer", message: "I'd like a consultation this week." },
      { speaker: "Maia", message: "I'll record your preferred day and pass the request to the team for confirmation." },
    ],
    outcome: "Service intent captured · Consultation request ready for review",
  },
] as const;

export default function MaiaInteractiveDemo() {
  const [scenarioId, setScenarioId] = useState<string>("property");
  const [visible, setVisible] = useState(2);
  const scenario = scenarios.find((item) => item.id === scenarioId) ?? scenarios[0];

  return (
    <section className={styles.section} id="maia-demo" aria-labelledby="maia-demo-title">
      <div className={styles.shell}>
        <div className={styles.copy}>
          <span className={styles.eyebrow}>Meet Maia · Interactive walkthrough</span>
          <h2 id="maia-demo-title">From the first message to a clear next step.</h2>
          <p>Explore how an AI customer-facing agent can answer approved questions, collect the right details and prepare a human handoff. This is a scripted demonstration, not a live chat or confirmed booking.</p>
          <div className={styles.scenarios} role="group" aria-label="Choose a conversation example">
            {scenarios.map((item) => (
              <button key={item.id} type="button" className={scenarioId === item.id ? styles.active : styles.choice} aria-pressed={scenarioId === item.id} onClick={() => { setScenarioId(item.id); setVisible(2); }}>{item.label}</button>
            ))}
          </div>
          <p className={styles.scenarioDescription}>{scenario.description}</p>
          <Link href="/case-studies/maia" className={styles.caseLink}>See the Limitless Realty case study <ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
        <div className={styles.phone} aria-label="Scripted Maia conversation preview">
          <div className={styles.phoneTop}>
            <div className={styles.avatar}><MessageCircle size={21} aria-hidden="true" /></div>
            <div><strong>Maia</strong><small>Example customer conversation</small></div>
            <span className={styles.demo}>DEMO</span>
          </div>
          <div className={styles.messages} aria-live="polite" aria-relevant="additions text">
            {scenario.steps.slice(0, visible).map((step, index) => (
              <div className={step.speaker === "Customer" ? styles.customer : styles.maia} key={`${scenario.id}-${index}`}>
                <span>{step.speaker}</span><p>{step.message}</p>
              </div>
            ))}
          </div>
          <div className={styles.phoneFooter}>
            {visible < scenario.steps.length ? (
              <button type="button" className={styles.next} onClick={() => setVisible((current) => Math.min(current + 1, scenario.steps.length))}>Continue conversation <ArrowRight size={16} aria-hidden="true" /></button>
            ) : (
              <div className={styles.result}><strong>Next step</strong><p>{scenario.outcome}</p><button type="button" onClick={() => setVisible(2)}><RotateCcw size={14} aria-hidden="true" /> Replay</button></div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
