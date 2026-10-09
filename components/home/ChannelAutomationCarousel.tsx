"use client";

import { useEffect, useState, type ComponentType } from "react";
import { AtSign, Mail, MessageCircle, PhoneCall, Send } from "lucide-react";
import styles from "./ChannelAutomationCarousel.module.css";

type Channel = {
  name: string;
  label: string;
  outcome: string;
  description: string;
  Icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  accent: string;
};

const channels: Channel[] = [
  {
    name: "Voice call agent",
    label: "VOICE",
    outcome: "Answer, qualify and route calls",
    description: "Give every caller a useful first response, capture intent and hand urgent moments to your team.",
    Icon: PhoneCall,
    accent: "#f59e0b",
  },
  {
    name: "WhatsApp agent",
    label: "WHATSAPP",
    outcome: "Turn chats into next steps",
    description: "Respond to enquiries, qualify leads, send reminders and keep the conversation moving.",
    Icon: MessageCircle,
    accent: "#4ade80",
  },
  {
    name: "Telegram agent",
    label: "TELEGRAM",
    outcome: "Support communities and customers",
    description: "Automate useful replies, collect requests and route conversations without losing context.",
    Icon: Send,
    accent: "#60a5fa",
  },
  {
    name: "Automated email",
    label: "EMAIL",
    outcome: "Follow up without forgetting",
    description: "Send timely sequences, confirmations and internal updates while your team stays in control.",
    Icon: Mail,
    accent: "#c084fc",
  },
  {
    name: "Instagram automation",
    label: "INSTAGRAM",
    outcome: "Capture interest from social",
    description: "Turn comments and direct messages into organised enquiries, follow-up and handoffs.",
    Icon: AtSign,
    accent: "#f472b6",
  },
];

export default function ChannelAutomationCarousel() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (paused || reducedMotion) return;
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % channels.length);
    }, 4500);
    return () => window.clearInterval(timer);
  }, [paused, reducedMotion]);

  const current = channels[active];
  const Icon = current.Icon;

  return (
    <section
      className={styles.carousel}
      aria-label="Channels Fluxknight can automate"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
    >
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Channels that can keep moving</p>
          <h3>Meet customers where they already are.</h3>
        </div>
        <span className={styles.status}>{paused || reducedMotion ? "Paused" : "Auto-rotating"}</span>
      </div>

      <div className={styles.slide} style={{ "--channel-accent": current.accent } as React.CSSProperties}>
        <div className={styles.iconWrap} aria-hidden="true"><Icon size={28} strokeWidth={1.8} /></div>
        <div className={styles.copy}>
          <span className={styles.channelLabel}>{current.label}</span>
          <strong>{current.name}</strong>
          <h4>{current.outcome}</h4>
          <p>{current.description}</p>
        </div>
        <div className={styles.channelRail} aria-hidden="true">
          {channels.map((channel, index) => <span key={channel.label} className={index === active ? styles.activeRail : undefined} style={{ "--rail-accent": channel.accent } as React.CSSProperties} />)}
        </div>
      </div>

      <div className={styles.controls}>
        <button type="button" onClick={() => setActive((active - 1 + channels.length) % channels.length)} aria-label="Previous automation channel">←</button>
        <div className={styles.dots} role="tablist" aria-label="Automation channels">
          {channels.map((channel, index) => <button key={channel.label} type="button" role="tab" aria-selected={index === active} aria-label={`Show ${channel.name}`} className={index === active ? styles.activeDot : undefined} onClick={() => setActive(index)} />)}
        </div>
        <button type="button" onClick={() => setActive((active + 1) % channels.length)} aria-label="Next automation channel">→</button>
      </div>
    </section>
  );
}
