import styles from "./CommandCenterExpansion.module.css";

type PulseValue = number | string | null;
type AgentState = "active" | "idle" | "attention" | "disabled";
type HealthState = "operational" | "attention" | "down" | "unknown";

type Props = {
  pulse: {
    leads: PulseValue;
    conversations: PulseValue;
    conversions: PulseValue;
    activeClients: PulseValue;
    aiResolutions: PulseValue;
    valueGenerated: PulseValue;
    creditsUsed: PulseValue;
  };
  workforce: Array<{ name: string; role: string; state: AgentState; note?: string }>;
  health: Array<{ name: string; state: HealthState; note?: string }>;
  compact?: boolean;
  leo: {
    summary: string;
    recommendation: string;
    requiresApproval?: boolean;
  };
};

function show(value: PulseValue) {
  return value === null || value === undefined || value === "" ? "Unavailable" : value;
}

export default function CommandCenterExpansion({ pulse, workforce, health, leo, compact = false }: Props) {
  const pulseItems = [
    ["Leads", pulse.leads],
    ["Conversations", pulse.conversations],
    ["Conversions", pulse.conversions],
    ["Active clients", pulse.activeClients],
    ["AI resolutions", pulse.aiResolutions],
    ["Value generated", pulse.valueGenerated],
    ["Credits used", pulse.creditsUsed],
  ] as const;

  return (
    <section className={`${styles.wrap} ${compact ? styles.compact : ""}`} aria-label="Command center expansion">
      <div className={styles.sectionHead}>
        <div><span>BUSINESS PULSE</span><h2>What the business is doing</h2></div>
        <small>Only connected evidence is shown. Missing sources stay unavailable.</small>
      </div>

      <div className={styles.pulseGrid}>
        {pulseItems.map(([label, value]) => (
          <article key={label} className={styles.pulseCard}>
            <span>{label}</span>
            <strong className={show(value) === "Unavailable" ? styles.unavailable : ""}>{show(value)}</strong>
          </article>
        ))}
      </div>

      <div className={styles.mainGrid}>
        <article className={`${styles.panel} ${styles.leoPanel}`}>
          <div className={styles.panelHead}><div><span>LEO</span><h3>Operating brief</h3></div><b>Contextual</b></div>
          <p className={styles.leoSummary}>{leo.summary}</p>
          <div className={styles.recommendation}>
            <span>Recommended next move</span>
            <strong>{leo.recommendation}</strong>
            <small>{leo.requiresApproval ? "Approval required before execution." : "Safe to review without making a sensitive change."}</small>
          </div>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHead}><div><span>AI WORKFORCE</span><h3>Agents</h3></div><b>{workforce.length}</b></div>
          <div className={styles.stack}>
            {workforce.map((agent) => (
              <div className={styles.row} key={agent.name}>
                <i className={`${styles.dot} ${styles[agent.state]}`} />
                <div><strong>{agent.name}</strong><small>{agent.role}{agent.note ? ` · ${agent.note}` : ""}</small></div>
                <span className={`${styles.state} ${styles[agent.state]}`}>{agent.state}</span>
              </div>
            ))}
          </div>
        </article>
      </div>

      <article className={styles.panel}>
        <div className={styles.panelHead}><div><span>SYSTEM HEALTH</span><h3>Connected services</h3></div><small>Secondary infrastructure view</small></div>
        <div className={styles.healthGrid}>
          {health.map((item) => (
            <div className={styles.healthItem} key={item.name}>
              <div><i className={`${styles.dot} ${styles[item.state]}`} /><strong>{item.name}</strong></div>
              <span className={`${styles.state} ${styles[item.state]}`}>{item.state}</span>
              {item.note ? <small>{item.note}</small> : null}
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
