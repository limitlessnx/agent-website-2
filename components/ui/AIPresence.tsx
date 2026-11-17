import { aiPresenceLabels, type AIPresenceState } from "@/lib/ai-presence";
import styles from "./AIPresence.module.css";

/** A passive display. Callers supply observed application state; this never starts an agent. */
export default function AIPresence({ state, name, label, hero = false }: { state: AIPresenceState; name: string; label?: string; hero?: boolean }) {
  return <span className={`${styles.presence} ${hero ? styles.hero : ""}`} data-ai-presence data-state={state} role="status" aria-live="polite" aria-atomic="true">
    <span className={styles.orb} aria-hidden="true"><span className={styles.halo} /><span className={styles.wave}><i /><i /><i /><i /><i /></span></span>
    <span className={styles.caption}><strong>{name}</strong><span>{label || aiPresenceLabels[state]}</span></span>
  </span>;
}
