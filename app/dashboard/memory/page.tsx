import { BrainCircuit, History, ShieldCheck } from "@/components/admin/ServerIcons";
import { getPlatformEngineSummary, humanize } from "@/lib/platform-engine";
import styles from "../PlatformControl.module.css";

export const dynamic = "force-dynamic";

function confidenceLabel(value: number) {
  if (value >= 0.8) return "High confidence";
  if (value >= 0.5) return "Medium confidence";
  return "Low confidence";
}

export default async function MemoryPage() {
  const { memories, errors } = await getPlatformEngineSummary();
  const customers = new Set(memories.map((item) => item.customer_key)).size;
  const sourceTypes = new Set(memories.map((item) => item.source_type).filter(Boolean)).size;
  const highConfidence = memories.filter((item) => Number(item.confidence || 0) >= 0.8).length;

  return (
    <main className={`${styles.page} admin-page`}>
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className="admin-kicker">Memory control</p>
          <h1>Memory Center</h1>
          <p>Inspect durable customer context with confidence and source provenance so persisted memory stays distinct from ordinary conversation history.</p>
        </div>
        <span className={`${styles.heroStatus} ${errors.length ? styles.warn : styles.good}`}><ShieldCheck size={14} /> {errors.length ? "Memory visibility degraded" : "Memory visibility available"}</span>
      </header>

      <section className={styles.metrics} aria-label="Memory summary">
        <article className={styles.metric}><span className={styles.metricLabel}><BrainCircuit size={14} /> Memories</span><strong>{memories.length}</strong><small>Recent durable records</small></article>
        <article className={styles.metric}><span className={styles.metricLabel}><History size={14} /> Customers</span><strong>{customers}</strong><small>Distinct memory profiles</small></article>
        <article className={styles.metric}><span className={styles.metricLabel}><ShieldCheck size={14} /> High confidence</span><strong>{highConfidence}</strong><small>Records at 80% confidence or above</small></article>
        <article className={styles.metric}><span className={styles.metricLabel}><DatabaseIcon /></span><strong>{sourceTypes}</strong><small>Distinct recorded source types</small></article>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}><div><h2>Recent durable memory</h2><p>Each record remains customer-scoped and carries memory type, confidence and source provenance from the platform engine.</p></div><BrainCircuit size={18} /></div>
        <div className={styles.list}>
          {memories.map((item) => {
            const confidence = Number(item.confidence || 0);
            return (
              <div className={styles.row} key={item.id}>
                <div className={styles.rowMain}>
                  <strong>{item.customer_key}</strong>
                  <span>{item.summary}</span>
                  <small>{humanize(item.memory_type)} · {Math.round(confidence * 100)}% confidence · Source: {item.source_type ? humanize(item.source_type) : "Recorded"}</small>
                </div>
                <em className={`${styles.status} ${confidence >= 0.8 ? styles.good : confidence < 0.5 ? styles.warn : ""}`}>{confidenceLabel(confidence)}</em>
              </div>
            );
          })}
          {!memories.length ? <p className={styles.empty}>No durable customer memories are currently recorded. Conversation history is not treated as memory unless the platform has explicitly persisted verified context.</p> : null}
        </div>
      </section>

      {errors.length ? <section className={styles.panel}><div className={styles.panelHeader}><div><h2>Memory source warning</h2><p>Some memory sources could not be read during this request.</p></div><ShieldCheck size={17} /></div><p className={styles.note}>{errors.join(" · ")}</p></section> : null}
    </main>
  );
}

function DatabaseIcon() {
  return <BrainCircuit size={14} />;
}
